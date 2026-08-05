/**
 * Campus events — real events at the student's own school, matched to what they
 * said they care about.
 *
 * The division of labour here is the whole safety model:
 *
 *   the FEED decides what exists  — every event comes from the school's own
 *                                   Localist calendar via the campusEvents
 *                                   backend function
 *   the MODEL decides what's useful — it ranks events it was handed and writes
 *                                     the "what to do when you get there"
 *
 * The model never authors an event. Recommendations are joined back to the feed
 * by id and anything it invents is dropped on the floor, so the worst a bad
 * model response can do is recommend nothing.
 *
 * ## Nothing was checking that a recommendation was relevant
 *
 * The ranking asked the model to pick what was worth a student's time and let it
 * return zero, and it essentially never did. A campus calendar is mostly staff
 * trainings, arts lectures and info sessions; asked for the best of that set, a
 * model picks the best of that set. Then the prompt required a sentence saying
 * why, so it wrote one. A student testing investment banking was led with a talk
 * on wartime diplomacy under a heading that said "worth your time", with a
 * paragraph explaining why it secretly was.
 *
 * So relevance is now a label the model has to commit to per event, against
 * definitions written down below, and only two of the three get through. The
 * floor is enforced here rather than asked for in prose, because "return fewer,
 * even zero" was already in the prompt and is exactly the instruction a model
 * talks itself out of one event at a time.
 *
 * An empty ranking is a normal outcome of this, not a failure. Every surface
 * already falls back to plain chronological events with no reason attached, and
 * a student reading "nothing this month connects to what you are testing" is
 * being told something true.
 */

import { base44 } from '@/api/base44Client';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { reportAiFailure } from '@/lib/ai-failures';

const MAX_RECOMMENDATIONS = 3;

// ── Not asking twice ────────────────────────────────────────────────────────

/**
 * Both calls behind this module are expensive and neither answer moves.
 *
 * The feed reads a school's whole calendar over the network; the ranking is a
 * model call we pay for. The picker sits in a modal a student opens, closes and
 * opens again, and every one of those mounts used to run both from scratch —
 * the same twenty events, re-fetched, re-ranked, re-billed, to render what was
 * already on screen a moment earlier.
 *
 * So each is remembered for as long as its answer stays true. A campus calendar
 * does not change in ten minutes, and a ranking of the same events for the same
 * student does not change at all.
 *
 * Deliberately in memory, not storage: it should survive moving around the app
 * and not survive a reload, because a reload is what a student does when they
 * think something is stale.
 */
const FEED_TTL_MS = 10 * 60 * 1000;
const RANKING_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_ENTRIES = 24;

const cache = new Map();

function cached(key, ttl, produce) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) {
    // Re-insert so a used answer moves to the back of the queue. The calendar
    // is read once and then ranked against over and over, so without this it
    // stays the oldest key in the map and a run of rankings evicts the one
    // entry all of them depend on.
    cache.delete(key);
    cache.set(key, hit);
    return hit.value;
  }

  const value = produce();
  const entry = { at: Date.now(), value };
  cache.set(key, entry);

  // There are two ways a ranking fails to be an answer, and they are handled in
  // two different places. Do not collapse them:
  //
  //   it RETURNED a failure — the model call errored, or answered something we
  //     could not read. `recommendCampusEvents` sees `outcome.failed` and drops
  //     the key itself. That is the incumbent path and it stays where it is.
  //   it THREW — nothing after the model call is wrapped, so anything that
  //     raises leaves a REJECTED PROMISE in the map. `outcome.failed` is never
  //     reached to clear it, and every later read re-throws the same stale
  //     failure until the TTL runs out.
  //
  // This covers the second. Nothing is memoised that did not resolve.
  if (value && typeof value.then === 'function') {
    value.then(undefined, () => {
      if (cache.get(key) === entry) cache.delete(key);
    });
  }

  // The oldest key is the first one Map iterates, so this is the whole eviction.
  while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);

  return value;
}

/** Forget an answer, so the next ask goes back to the source. */
function forget(prefix) {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** Tests and the retry button both need a way back to a cold start. */
export function resetCampusEventCache() {
  cache.clear();
}

/** Enough context to judge fit, small enough to send a dozen of. */
function forModel(event) {
  return {
    event_id: event.id,
    title: event.title,
    when: event.start,
    location: [event.location, event.room].filter(Boolean).join(' '),
    description: (event.description || '').slice(0, 400),
    topics: event.topics,
    types: event.types,
    departments: event.departments,
    // Omitted entirely when the calendar didn't say. Sending `free: null` would
    // invite the model to write "free" or "paid" into a fit reason off a field
    // that means neither.
    ...(typeof event.is_free === 'boolean' ? { free: event.is_free } : {}),
    registration_required: event.has_register,
  };
}

/**
 * The labels that clear the floor, best first.
 *
 * Anything else the model writes here, including "general" and including the
 * field being missing, is not a recommendation and never reaches a student.
 */
const CONNECTION_RANK = { direct: 0, adjacent: 1 };

/**
 * Judgment before justification, deliberately.
 *
 * Structured output is generated in the order the properties are declared, so
 * the model names the words in the event that connect it to this student, then
 * commits to a label, and only then writes the sentence a student reads. Asked
 * the other way round it writes the sentence first and the label becomes a
 * description of a case it has already made.
 */
const RECOMMENDATION_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          event_id: { type: 'string' },
          connection_evidence: { type: 'string' },
          connection: { type: 'string', enum: ['direct', 'adjacent', 'general'] },
          fit_reason: { type: 'string' },
          what_to_do: { type: 'array', items: { type: 'string' } },
          questions_to_ask: { type: 'array', items: { type: 'string' } },
          proof_to_capture: { type: 'string' },
        },
      },
    },
  },
};

function buildPrompt(events, profile, pathName) {
  return `You are Unscripted, a career-experimentation coach for college students.

Below are REAL upcoming events pulled from ${profile?.college || 'the student'}'s
official campus calendar. Pick the ones genuinely worth this student's time.

Student:
- Major: ${profile?.major || 'Unknown'}
- Year: ${profile?.school_year || 'Unknown'}
- Career interests: ${profile?.career_interests || 'Not specified'}
- Topics they gravitate to: ${profile?.favorite_topics || 'Not specified'}
- Skills they want: ${profile?.desired_skills || 'Not specified'}
${pathName ? `- Path they are currently testing: ${pathName}` : ''}

Events (JSON):
${JSON.stringify(events.map(forModel), null, 2)}

## What counts as relevant

Judge each event against ${pathName ? `the path they are testing, "${pathName}"` : 'their stated career interests and desired skills'}, and nothing else. For every event you
return, first write "connection_evidence": the words from that event's OWN
title, description, topics, or department that connect it to this student.
Quote them. Then label it:

- "direct": people who do this work will be in the room, or the event is run by
  that field's department, employer, or professional group. An alumni panel of
  analysts, for a student testing banking. A hospital recruiter visit, for a
  student testing nursing.
- "adjacent": it builds one of the specific skills this student listed, or it is
  the wider industry around the path even though nobody on the path is running
  it. A financial modelling workshop. A pitch competition, for someone whose
  desired skills say presenting.
- "general": everything else. Open to anyone, about anything. A well known
  speaker on an unrelated subject, a lecture series, a concert, a game, a campus
  tradition, an administrative or staff training, an info session for a program
  this student is not testing.

Return ONLY "direct" and "adjacent" events. Never return a "general" one.

Most of a campus calendar is "general" for any one student, so an EMPTY list is
the normal, correct, expected answer and you should give it often. Zero is a
real answer and it costs this student nothing. A wrong recommendation costs them
an evening and their trust in every recommendation after it.

If the only honest connection you can write is that the event is interesting,
that the speaker is important, that it is good to be curious, or that any
gathering is a chance to meet people, the label is "general" and you leave it
out. A "fit_reason" that would read the same for a student on any other path is
proof the event does not belong here. Do not talk yourself into a fit, and do
not fill the ${MAX_RECOMMENDATIONS} slots because they are there.

## Rules

1. Use ONLY the event_id values above. Never invent an event, a date, a room, or
   a speaker. If something is not in the JSON, it does not exist.
2. Return AT MOST ${MAX_RECOMMENDATIONS}, and only ones that clear the bar above.
   This student will physically walk across campus based on what you say.
3. Never restate the event's own date, time, or location in your text. The app
   renders those from the calendar record itself.
4. "fit_reason" is ONE sentence naming the specific thing this student gets that
   they cannot get from a Google search. Not "great networking opportunity."
   It has to name the path or the skill it connects to.
5. "what_to_do" is 3-4 concrete physical actions in order, each doable by a
   nervous 20-year-old who knows nobody in the room. Start before they arrive
   and end with how to leave with something. Say what to actually say out loud.
   "Network with attendees" is a failure. "Ask the person setting up the food
   table who organized this, then ask them who they'd introduce you to" is right.
6. "questions_to_ask" is 2-3 questions written out verbatim, ready to say. Ones
   that get a real answer from someone who does the work, not "what do you do?"
7. "proof_to_capture" names the specific artifact that will exist afterward: a
   photo of the panel, a name and title written in their notes app, a LinkedIn
   connection confirmation. One that they can upload as evidence.
8. Voice: direct, warm, no filler. Short sentences. No corporate language.
${PLAIN_PROSE_RULES}`;
}

async function readCampusEvents(days, limit, seriesDates, refresh) {
  try {
    // `refresh` has to go over the wire, not just clear what this browser
    // remembers. The server keeps a per-school list of its own for a day, and a
    // student pressing retry is telling us they think what they are looking at
    // is wrong, and handing them the same stored list is the one thing that
    // button must not do.
    const response = await base44.functions.invoke('campusEvents', { days, limit, seriesDates, refresh });
    const data = response?.data ?? response;
    if (!data || !Array.isArray(data.events)) {
      return { status: 'feed_error', events: [], college: '' };
    }
    return data;
  } catch (err) {
    return { status: 'feed_error', events: [], college: '', error: err?.message || '' };
  }
}

/**
 * Real events from the student's campus calendar, already keyword-matched to
 * their profile server-side.
 *
 * Never throws — an unavailable calendar is a normal, non-blocking outcome, and
 * every caller renders nothing in that case.
 *
 * The answer is remembered, and the promise is what gets remembered rather than
 * the result — two mounts racing each other share one request instead of making
 * two. A school's server failing to answer is the one outcome not kept: the
 * student is looking at a retry button, and it has to mean something.
 *
 * `refresh` is that button.
 *
 * `seriesDates` is how many dates a repeating event contributes. Leave it at 1
 * for any list — a weekly club would otherwise take most of the slots to say
 * one thing. A month grid, where that club belongs on every Tuesday square,
 * is the caller that should raise it.
 */
export async function fetchCampusEvents({
  days = 45, limit = 20, seriesDates = 1, refresh = false,
} = {}) {
  const key = `feed:${days}:${limit}:${seriesDates}`;
  // Retry means start over, ranking included — an empty ranking and a model
  // that failed look the same from here, and only one of them is worth keeping.
  if (refresh) cache.clear();

  const pending = cached(key, FEED_TTL_MS, () => readCampusEvents(days, limit, seriesDates, refresh));
  const data = await pending;
  if (data?.status === 'feed_error') cache.delete(key);
  return data;
}

/**
 * Tell the backend where this student's school keeps its calendar.
 *
 * Returns the same shape as fetchCampusEvents, so a successful submission
 * flows into exactly the same rendering path as a feed we found ourselves —
 * the student sees their events on this request rather than a promise to look
 * into it later.
 *
 * Never throws, for the same reason fetchCampusEvents doesn't: a calendar is
 * an optional enhancement and nothing here is worth breaking a guide over.
 */
export async function submitCalendarUrl(url, { days = 45, limit = 20 } = {}) {
  try {
    const response = await base44.functions.invoke('campusEvents', {
      action: 'submit_calendar_url',
      url,
      days,
      limit,
    });
    const data = response?.data ?? response;
    if (!data || typeof data !== 'object') {
      return { status: 'submission_failed', reason: '', events: [] };
    }
    // The school has a calendar now. Whatever we remembered about it is history.
    forget('feed:');
    return { events: [], ...data };
  } catch (err) {
    return { status: 'submission_failed', reason: err?.message || '', events: [] };
  }
}

/**
 * The review queue: every calendar link a student has sent us.
 *
 * Read through the backend function rather than the entity directly, so the
 * admin check is server-side and the page does not depend on whatever RLS the
 * submission entity ends up with.
 */
export async function listFeedSubmissions() {
  const response = await base44.functions.invoke('campusEvents', { action: 'list_submissions' });
  const data = response?.data ?? response;
  if (data?.error) throw new Error(data.error);
  return Array.isArray(data?.submissions) ? data.submissions : [];
}

/**
 * Approve or reject one submission.
 *
 * Approving is what turns a student's link into the calendar for their whole
 * school, so unlike everything else in this file it is allowed to throw — the
 * admin has to find out it did not take.
 */
export async function reviewFeedSubmission(id, decision) {
  const response = await base44.functions.invoke('campusEvents', {
    action: 'review_submission',
    id,
    decision,
  });
  const data = response?.data ?? response;
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Every school with a feed, and whether it is currently working.
 *
 * A resolved school is cached and never probed again, so nothing looks at a
 * calendar twice unless someone asks. This is the asking.
 */
export async function listCampusFeeds() {
  const response = await base44.functions.invoke('campusEvents', { action: 'list_feeds' });
  const data = response?.data ?? response;
  if (data?.error) throw new Error(data.error);
  return Array.isArray(data?.feeds) ? data.feeds : [];
}

/**
 * Fetch every school's calendar right now and record what happened.
 *
 * Slow on purpose — it reads whole calendars one at a time — so the caller has
 * to show that it is working.
 */
export async function checkCampusFeeds() {
  const response = await base44.functions.invoke('campusEvents', { action: 'check_feeds' });
  const data = response?.data ?? response;
  if (data?.error) throw new Error(data.error);
  return {
    checked: Array.isArray(data?.checked) ? data.checked : [],
    skipped: Number(data?.skipped) || 0,
  };
}

/**
 * A student telling us the calendar we found for their school is the wrong one.
 *
 * The one failure nothing on our side can detect: a feed that resolves, reads
 * cleanly, and belongs to the library or another campus entirely. Never throws
 * — a student reporting a problem must not be shown a second one.
 */
export async function reportFeedWrong(note = '') {
  try {
    const response = await base44.functions.invoke('campusEvents', { action: 'report_feed', note });
    const data = response?.data ?? response;
    return { status: data?.status || 'report_failed' };
  } catch (err) {
    return { status: 'report_failed', error: err?.message || '' };
  }
}

/** Why a link we refused to even try was refused, in the student's terms. */
export const SUBMISSION_REJECTIONS = {
  bad_url: "That doesn't look like a web address. Copy the whole thing from your browser's address bar.",
  blocked_port: 'We only read calendars published on the normal web address, without a port number.',
  wrong_school: 'That address is somewhere else. It has to be on your school’s own site, or a calendar service like Engage or CampusGroups.',
};

/**
 * Ranks real events and writes the on-the-ground playbook for each.
 *
 * Returns the full feed record with a `guidance` object attached, so callers
 * always render dates, rooms, and links from calendar data rather than from
 * anything the model wrote.
 */
export async function recommendCampusEvents(events, profile, { pathName = '' } = {}) {
  if (!Array.isArray(events) || events.length === 0) return [];

  // Same student, same events, same path — the model has already answered this.
  const key = `rank:${[
    pathName,
    profile?.college, profile?.major, profile?.school_year,
    profile?.career_interests, profile?.favorite_topics, profile?.desired_skills,
    events.map(e => e.id).join(','),
  ].join('|')}`;

  const outcome = await cached(key, RANKING_TTL_MS, () => rankCampusEvents(events, profile, pathName));

  // "The model judged none of these relevant" and "the model call failed" reach
  // the caller as the same empty list, and only the first is worth remembering
  // for half an hour. Keeping the second would leave a student who hit a blip
  // looking at the unranked list every time they reopened the picker, where
  // before the cache the next open simply asked again.
  if (outcome.failed) cache.delete(key);
  return outcome.picks;
}

/**
 * A list of non-empty strings, whatever the model actually sent.
 *
 * `response_json_schema` is a request, not a guarantee. A model asked for an
 * array of strings returns a bare string often enough that calling `.filter` on
 * it is a live crash — and this one throws from inside a promise the picker
 * awaits with no catch. A single string is read as the one step it plainly is;
 * anything else contributes nothing.
 */
function textList(value) {
  const items = Array.isArray(value) ? value : [value];
  return items.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim());
}

/** A string the student can be shown, or nothing. */
function text(value) {
  return typeof value === 'string' ? value : '';
}

async function rankCampusEvents(events, profile, pathName) {
  let result;
  try {
    result = await base44.integrations.Core.InvokeLLM({
      prompt: buildPrompt(events, profile, pathName),
      model: 'claude_sonnet_4_6',
      response_json_schema: RECOMMENDATION_SCHEMA,
    });
  } catch {
    reportAiFailure('campus_event_ranking', {
      stage: 'invoke_llm',
      codes: ['unexpected_error'],
      model: 'claude_sonnet_4_6',
    });
    return { picks: [], failed: true };
  }

  const byId = new Map(events.map(e => [String(e.id), e]));
  const seen = new Set();
  const kept = [];

  // Anything other than a list is as much a bad response as a hallucinated id.
  // The picker awaits this inside an effect with no catch, so throwing here
  // leaves the student on a spinner that never resolves.
  const payload = unwrapLLM(result);
  const malformed = !Array.isArray(payload?.recommendations);
  const recommendations = malformed ? [] : payload.recommendations;

  // How many events came back carrying a label we recognise, kept or dropped. A
  // response where NONE do is a model that ignored the floor, not one that
  // applied it strictly, and those two must not both read as "nothing fits".
  let labelled = 0;

  for (const rec of recommendations) {
    const id = String(rec?.event_id || '');
    const event = byId.get(id);
    // An id we did not send is a hallucinated event. Drop it silently.
    if (!event || seen.has(id)) continue;
    seen.add(id);

    const connection = text(rec?.connection).trim().toLowerCase();
    const rank = CONNECTION_RANK[connection];
    if (rank !== undefined || connection === 'general') labelled += 1;

    // The floor. "general" is the model's own word for "a fine event for
    // anybody", which is the one thing this section must never lead with. A
    // missing or unreadable label does not pass either: unlabelled is not
    // vetted, and treating it as vetted is precisely the old behaviour.
    if (rank === undefined) continue;

    kept.push({
      rank,
      pick: {
        ...event,
        guidance: {
          connection,
          connection_evidence: text(rec.connection_evidence),
          fit_reason: text(rec.fit_reason),
          what_to_do: textList(rec.what_to_do),
          questions_to_ask: textList(rec.questions_to_ask),
          proof_to_capture: text(rec.proof_to_capture),
        },
      },
    });
  }

  /*
    A direct fit outranks an adjacent one, whatever order they arrived in.

    Every surface takes the first pick it can use: the dashboard leads with a
    single event, and the picker anchors a whole guide to the one a student taps
    first. So this ordering is the recommendation, and the order the model
    happened to write them in is not reliably strength of fit. Ties keep that
    order, which is its own ranking within a tier.
  */
  kept.sort((a, b) => a.rank - b.rank);
  const picks = kept.slice(0, MAX_RECOMMENDATIONS).map(k => k.pick);

  /*
    Two outcomes that both arrive as an empty list and mean opposite things.

      "none of these fit" — labels came back and they were all general. A real
        verdict, and the answer this floor exists to make possible. Worth
        remembering for the half hour the cache holds it.
      the model skipped the labels — nothing carrying the field at all. That is
        a response we could not read, the same as a malformed one, and caching
        it would leave this student unranked for half an hour over one bad
        generation.
  */
  const ignoredTheFloor = recommendations.length > 0 && labelled === 0;

  // A response we could not read is a failure, not a verdict of "nothing fits".
  if (malformed || ignoredTheFloor) {
    // A malformed ranking is indistinguishable from "your campus has nothing on"
    // from the student's side, which is the outage this file already shipped
    // once. It needs a row precisely because nobody would report it.
    reportAiFailure('campus_event_ranking', {
      stage: 'validate',
      codes: [malformed ? 'recommendations_not_array' : 'connection_label_missing'],
      model: 'claude_sonnet_4_6',
    });
  }

  return { picks, failed: malformed || ignoredTheFloor };
}

// ── Display helpers ─────────────────────────────────────────────────────────

/**
 * The calendar's start value as a local Date, or null if there isn't one.
 *
 * Localist only carries a timestamp when an event has an instance; without one
 * the feed falls back to a date-only `first_date`. `new Date('2026-10-14')` is
 * parsed as UTC midnight, which is the evening BEFORE anywhere west of
 * Greenwich — so the student is shown the wrong day for the one date they did
 * not choose themselves.
 */
export function parseEventStart(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Thu, Oct 14 · 5:00 PM" — or just the date for an all-day event. */
export function formatEventWhen(event) {
  const date = parseEventStart(event?.start);
  if (!date) return '';

  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (event.all_day) return day;

  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** "in 3 days" — the thing a self-set deadline can never give a student. */
export function daysUntil(event) {
  const start = parseEventStart(event?.start);
  if (!start) return null;

  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOfDay(start) - startOfDay(new Date())) / 86400000);

  if (diff < 0) return null;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return `In ${diff} days`;
  if (diff < 14) return 'Next week';
  return `In ${Math.round(diff / 7)} weeks`;
}

export function formatEventPlace(event) {
  return [event?.location, event?.room].filter(Boolean).join(', ');
}

/**
 * The school's own calendar host, for naming where an event came from.
 *
 * "events.fairfield.edu" reads as an address; "fairfield.edu" reads as the
 * school. Students should recognise the source at a glance to judge it.
 */
export function eventSourceHost(event) {
  try {
    const host = new URL(event?.url).hostname.replace(/^www\./, '');
    return host.replace(/^(events|calendar|calendars)\./, '');
  } catch {
    return '';
  }
}

/**
 * A search that lands on the school's own events page.
 *
 * The escape hatch for every state where we have no calendar to show. It costs
 * us nothing, it is never wrong, and for a student whose school we cannot read
 * it is the difference between "we failed" and "here is where to look."
 *
 * `looking` is what to search FOR, and it matters more than it looks. A school
 * we cannot read is a school whose main calendar page is a dead end for us —
 * measured at 0 for 12 — so pointing that student at "events calendar" sends
 * them to the one page that cannot help. The club portal is what resolves.
 */
export function schoolEventsSearchUrl(college, looking = 'events calendar') {
  const name = (college || '').trim();
  if (!name) return '';
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} ${looking}`)}`;
}

/**
 * A web search that finds this exact event on the school's own site.
 *
 * Every event we show is real, but a listing can be edited or cancelled after
 * we read it, and a permalink can rot. This is the escape hatch that does not
 * depend on our data still being current: the student searches the title and
 * sees whatever the school says today.
 *
 * Quoted title plus the school's domain, because event titles are generic
 * ("Career Fair") and would otherwise return someone else's campus.
 */
export function eventSearchUrl(event, college) {
  const title = (event?.title || '').trim();
  if (!title) return '';

  const source = eventSourceHost(event) || (college || '').trim();
  const query = source ? `"${title}" ${source}` : `"${title}"`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
