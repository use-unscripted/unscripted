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

  for (const rec of result?.recommendations || []) {
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

/** "Thu, Oct 14 · 5:00 PM" — or just the date for an all-day event. */
export function formatEventWhen(event) {
  if (!event?.start) return '';
  const date = new Date(event.start);
  if (Number.isNaN(date.getTime())) return '';

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
  if (!event?.start) return null;
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return null;

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
