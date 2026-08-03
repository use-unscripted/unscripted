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
 */

import { base44 } from '@/api/base44Client';

const MAX_RECOMMENDATIONS = 3;

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
    free: event.is_free,
    registration_required: event.has_register,
  };
}

const RECOMMENDATION_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          event_id: { type: 'string' },
          fit_reason: { type: 'string' },
          what_to_do: { type: 'array', items: { type: 'string' } },
          questions_to_ask: { type: 'array', items: { type: 'string' } },
          proof_to_capture: { type: 'string' },
        },
      },
    },
  },
};

/**
 * InvokeLLM's return shape depends on which model answered.
 *
 * Verified against the live app on 2026-07-31 with an identical prompt and
 * schema: no `model` set returns the schema object bare, `gemini_3_flash`
 * returns it bare, and `claude_sonnet_4_6` nests it under `response`. Reading
 * the wrong one yields undefined rather than an error, so the failure is
 * silent — this function returned zero recommendations every single time and
 * looked exactly like "your campus has no matching events".
 *
 * This is not specific to campus events. The other ten InvokeLLM call sites in
 * this app all read the bare shape and all currently omit `model`; pinning a
 * Claude model on any of them breaks it the same quiet way. See
 * docs/ai-generation.md.
 */
function unwrapLLM(result) {
  if (!result || typeof result !== 'object') return null;
  // Only unwrap a nesting the model added — never a real field named "response".
  const inner = result.response;
  return inner && typeof inner === 'object' && !Array.isArray(inner) ? inner : result;
}

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

## Rules

1. Use ONLY the event_id values above. Never invent an event, a date, a room, or
   a speaker. If something is not in the JSON, it does not exist.
2. Recommend AT MOST ${MAX_RECOMMENDATIONS}, and fewer — even zero — when the
   rest are genuinely irrelevant. A padded list is worse than a short one; this
   student will physically walk across campus based on what you say.
3. Never restate the event's own date, time, or location in your text. The app
   renders those from the calendar record itself.
4. "fit_reason" is ONE sentence naming the specific thing this student gets that
   they cannot get from a Google search. Not "great networking opportunity."
5. "what_to_do" is 3–4 concrete physical actions in order, each doable by a
   nervous 20-year-old who knows nobody in the room. Start before they arrive
   and end with how to leave with something. Say what to actually say out loud.
   "Network with attendees" is a failure. "Ask the person setting up the food
   table who organized this, then ask them who they'd introduce you to" is right.
6. "questions_to_ask" is 2–3 questions written out verbatim, ready to say. Ones
   that get a real answer from someone who does the work — not "what do you do?"
7. "proof_to_capture" names the specific artifact that will exist afterward — a
   photo of the panel, a name and title written in their notes app, a LinkedIn
   connection confirmation. One that they can upload as evidence.
8. Voice: direct, warm, no filler. Short sentences. No corporate language.`;
}

/**
 * Real events from the student's campus calendar, already keyword-matched to
 * their profile server-side.
 *
 * Never throws — an unavailable calendar is a normal, non-blocking outcome, and
 * every caller renders nothing in that case.
 */
export async function fetchCampusEvents({ days = 45, limit = 20 } = {}) {
  try {
    const response = await base44.functions.invoke('campusEvents', { days, limit });
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

  let result;
  try {
    result = await base44.integrations.Core.InvokeLLM({
      prompt: buildPrompt(events, profile, pathName),
      model: 'claude_sonnet_4_6',
      response_json_schema: RECOMMENDATION_SCHEMA,
    });
  } catch {
    return [];
  }

  const byId = new Map(events.map(e => [String(e.id), e]));
  const seen = new Set();
  const picks = [];

  // Anything other than a list is as much a bad response as a hallucinated id.
  // The picker awaits this inside an effect with no catch, so throwing here
  // leaves the student on a spinner that never resolves.
  const payload = unwrapLLM(result);
  const recommendations = Array.isArray(payload?.recommendations) ? payload.recommendations : [];

  for (const rec of recommendations) {
    const id = String(rec?.event_id || '');
    const event = byId.get(id);
    // An id we did not send is a hallucinated event. Drop it silently.
    if (!event || seen.has(id)) continue;
    seen.add(id);

    picks.push({
      ...event,
      guidance: {
        fit_reason: rec.fit_reason || '',
        what_to_do: (rec.what_to_do || []).filter(Boolean),
        questions_to_ask: (rec.questions_to_ask || []).filter(Boolean),
        proof_to_capture: rec.proof_to_capture || '',
      },
    });

    if (picks.length >= MAX_RECOMMENDATIONS) break;
  }

  return picks;
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
function parseEventStart(value) {
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
