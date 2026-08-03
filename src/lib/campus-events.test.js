import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/base44Client', () => ({
  base44: {
    functions: { invoke: vi.fn() },
    integrations: { Core: { InvokeLLM: vi.fn() } },
  },
}));

import { base44 } from '@/api/base44Client';
import {
  daysUntil,
  fetchCampusEvents,
  formatEventPlace,
  formatEventWhen,
  eventSearchUrl,
  eventSourceHost,
  recommendCampusEvents,
  schoolEventsSearchUrl,
  submitCalendarUrl,
  SUBMISSION_REJECTIONS,
} from './campus-events';

/** Shaped like normalizeEvent() in the campusEvents backend function. */
function calendarEvent(overrides = {}) {
  return {
    id: '1',
    title: 'Finance Career Panel',
    description: 'Alumni analysts on the first two years at a desk.',
    url: 'https://events.fairfield.edu/event/finance-panel',
    ics_url: 'https://events.fairfield.edu/event/finance-panel.ics',
    start: '2026-10-14T17:00:00-04:00',
    end: '2026-10-14T18:30:00-04:00',
    all_day: false,
    location: 'Dolan School of Business',
    room: '220',
    address: '1073 North Benson Road',
    is_free: true,
    ticket_url: '',
    has_register: true,
    departments: ['Dolan School of Business'],
    topics: ['Finance'],
    types: ['Panel'],
    audience: ['Students'],
    keywords: ['finance'],
    ...overrides,
  };
}

const PROFILE = { college: 'Fairfield University', major: 'Finance', school_year: 'Junior' };

afterEach(() => {
  vi.resetAllMocks();
});

describe('recommendCampusEvents', () => {
  it('returns the full calendar record with guidance attached', async () => {
    const event = calendarEvent();
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [
        {
          event_id: '1',
          fit_reason: 'Three of the panelists do the job you are testing.',
          what_to_do: ['Arrive early', 'Ask the organiser who to meet'],
          questions_to_ask: ['What does your week actually look like?'],
          proof_to_capture: 'a photo of the panel',
        },
      ],
    });

    const picks = await recommendCampusEvents([event], PROFILE);

    expect(picks).toEqual([
      {
        ...event,
        guidance: {
          fit_reason: 'Three of the panelists do the job you are testing.',
          what_to_do: ['Arrive early', 'Ask the organiser who to meet'],
          questions_to_ask: ['What does your week actually look like?'],
          proof_to_capture: 'a photo of the panel',
        },
      },
    ]);
  });

  // The whole safety model: the feed decides what exists and when. A model that
  // restates the time wrongly must not be able to overwrite the calendar record.
  it('ignores calendar fields the model tries to restate', async () => {
    const event = calendarEvent();
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [
        {
          event_id: '1',
          title: 'Finance Mixer',
          start: '2026-10-13T19:00:00-04:00',
          location: 'The Levee',
          room: '101',
          url: 'https://example.com/not-real',
          has_register: false,
          fit_reason: 'Good fit.',
        },
      ],
    });

    const [pick] = await recommendCampusEvents([event], PROFILE);

    expect(pick.title).toBe('Finance Career Panel');
    expect(pick.start).toBe('2026-10-14T17:00:00-04:00');
    expect(pick.location).toBe('Dolan School of Business');
    expect(pick.room).toBe('220');
    expect(pick.url).toBe('https://events.fairfield.edu/event/finance-panel');
    expect(pick.has_register).toBe(true);
  });

  it('drops an event_id that was never sent to the model', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [
        { event_id: '1', fit_reason: 'Real.' },
        { event_id: '999', fit_reason: 'Invented out of thin air.' },
        { event_id: '', fit_reason: 'No id at all.' },
        { fit_reason: 'No id key at all.' },
        null,
      ],
    });

    const picks = await recommendCampusEvents([calendarEvent()], PROFILE);

    expect(picks.map(p => p.id)).toEqual(['1']);
  });

  it('collapses a duplicated event_id to one pick', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [
        { event_id: '1', fit_reason: 'First.' },
        { event_id: '1', fit_reason: 'Same event again.' },
      ],
    });

    const picks = await recommendCampusEvents([calendarEvent()], PROFILE);

    expect(picks).toHaveLength(1);
    expect(picks[0].guidance.fit_reason).toBe('First.');
  });

  it('matches ids across types, so a numeric id still joins', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [{ event_id: 7, fit_reason: 'Real.' }],
    });

    const picks = await recommendCampusEvents([calendarEvent({ id: 7 })], PROFILE);

    expect(picks).toHaveLength(1);
  });

  it('returns at most three', async () => {
    const events = ['1', '2', '3', '4', '5'].map(id => calendarEvent({ id }));
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: events.map(e => ({ event_id: e.id, fit_reason: 'Fits.' })),
    });

    const picks = await recommendCampusEvents(events, PROFILE);

    expect(picks.map(p => p.id)).toEqual(['1', '2', '3']);
  });

  it('defaults missing guidance sub-fields instead of leaving them undefined', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [{ event_id: '1' }],
    });

    const [pick] = await recommendCampusEvents([calendarEvent()], PROFILE);

    expect(pick.guidance).toEqual({
      fit_reason: '',
      what_to_do: [],
      questions_to_ask: [],
      proof_to_capture: '',
    });
  });

  it('drops empty strings out of the guidance lists', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [{ event_id: '1', what_to_do: ['Arrive early', '', null], questions_to_ask: [''] }],
    });

    const [pick] = await recommendCampusEvents([calendarEvent()], PROFILE);

    expect(pick.guidance.what_to_do).toEqual(['Arrive early']);
    expect(pick.guidance.questions_to_ask).toEqual([]);
  });

  // The picker awaits this inside an effect with no catch: anything thrown here
  // leaves the student staring at a spinner that never resolves.
  it('recommends nothing when the model call fails', async () => {
    base44.integrations.Core.InvokeLLM.mockRejectedValue(new Error('rate limited'));

    await expect(recommendCampusEvents([calendarEvent()], PROFILE)).resolves.toEqual([]);
  });

  it('recommends nothing rather than throwing on a malformed response', async () => {
    const malformed = [
      null,
      undefined,
      {},
      { recommendations: null },
      { recommendations: 'the finance panel' },
      { recommendations: { event_id: '1' } },
    ];

    for (const response of malformed) {
      base44.integrations.Core.InvokeLLM.mockResolvedValue(response);
      await expect(recommendCampusEvents([calendarEvent()], PROFILE)).resolves.toEqual([]);
    }
  });

  it('does not call the model when there is nothing to rank', async () => {
    for (const input of [[], null, undefined, 'not a list', {}]) {
      await expect(recommendCampusEvents(input, PROFILE)).resolves.toEqual([]);
    }
    expect(base44.integrations.Core.InvokeLLM).not.toHaveBeenCalled();
  });

  it('survives a profile that onboarding never filled in', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({ recommendations: [] });

    await expect(recommendCampusEvents([calendarEvent()], null)).resolves.toEqual([]);
    expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(1);
  });
});

describe('fetchCampusEvents', () => {
  it('asks the backend for the window it was given', async () => {
    base44.functions.invoke.mockResolvedValue({ events: [], college: 'Fairfield University' });

    await fetchCampusEvents({ days: 30, limit: 5 });

    expect(base44.functions.invoke).toHaveBeenCalledWith('campusEvents', { days: 30, limit: 5 });
  });

  it('defaults the window when called with nothing', async () => {
    base44.functions.invoke.mockResolvedValue({ events: [] });

    await fetchCampusEvents();

    expect(base44.functions.invoke).toHaveBeenCalledWith('campusEvents', { days: 45, limit: 20 });
  });

  it('returns a raw response as-is', async () => {
    const feed = { status: 'ok', events: [calendarEvent()], college: 'Fairfield University' };
    base44.functions.invoke.mockResolvedValue(feed);

    await expect(fetchCampusEvents()).resolves.toEqual(feed);
  });

  it('unwraps a response nested under .data', async () => {
    const feed = { status: 'ok', events: [calendarEvent()], college: 'Fairfield University' };
    base44.functions.invoke.mockResolvedValue({ data: feed });

    await expect(fetchCampusEvents()).resolves.toEqual(feed);
  });

  // Every caller reads feed.events.length without checking, so the empty array
  // has to be there on every path out of this function.
  it('returns an empty feed when the response has no events array', async () => {
    for (const response of [null, undefined, {}, { events: null }, { events: 'none' }, 'nope']) {
      base44.functions.invoke.mockResolvedValue(response);
      await expect(fetchCampusEvents()).resolves.toEqual({ status: 'feed_error', events: [], college: '' });
    }
  });

  it('returns an empty feed when the backend call throws', async () => {
    base44.functions.invoke.mockRejectedValue(new Error('function timed out'));

    await expect(fetchCampusEvents()).resolves.toEqual({
      status: 'feed_error',
      events: [],
      college: '',
      error: 'function timed out',
    });
  });
});

describe('formatEventWhen', () => {
  // Built from the same Intl calls the app uses, so the assertions say which
  // calendar day and clock time got rendered without pinning a locale.
  const dayLabel = (y, m, d) =>
    new Date(y, m, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = (y, m, d, h, min) =>
    new Date(y, m, d, h, min).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  it('shows the day and the start time for a timed event', () => {
    expect(formatEventWhen(calendarEvent())).toBe(
      `${dayLabel(2026, 9, 14)} · ${timeLabel(2026, 9, 14, 17, 0)}`
    );
  });

  it('shows only the day for an all-day event', () => {
    const when = formatEventWhen(calendarEvent({ all_day: true, start: '2026-10-14T00:00:00-04:00' }));
    expect(when).toBe(dayLabel(2026, 9, 14));
  });

  // Localist only returns a timestamp when the event has an instance; without
  // one the backend falls back to `first_date`, which is date-only.
  it('reads a date-only value as that calendar day, not as UTC midnight', () => {
    expect(formatEventWhen(calendarEvent({ all_day: true, start: '2026-10-14' }))).toBe(dayLabel(2026, 9, 14));
  });

  it('returns nothing for a missing or unparseable date', () => {
    expect(formatEventWhen(calendarEvent({ start: '' }))).toBe('');
    expect(formatEventWhen(calendarEvent({ start: undefined }))).toBe('');
    expect(formatEventWhen(calendarEvent({ start: 'sometime next week' }))).toBe('');
    expect(formatEventWhen(null)).toBe('');
    expect(formatEventWhen(undefined)).toBe('');
  });
});

describe('daysUntil', () => {
  // A real clock would make these tests start failing on their own.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 14, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** An ISO instant N days from the pinned "now", at 5pm local. */
  const startInDays = n => ({ start: new Date(2026, 9, 14 + n, 17, 0, 0).toISOString() });

  it('counts from calendar day to calendar day, not from the hour', () => {
    expect(daysUntil(startInDays(0))).toBe('Today');
    expect(daysUntil(startInDays(1))).toBe('Tomorrow');
    expect(daysUntil(startInDays(6))).toBe('In 6 days');
    expect(daysUntil(startInDays(7))).toBe('Next week');
    expect(daysUntil(startInDays(13))).toBe('Next week');
    expect(daysUntil(startInDays(14))).toBe('In 2 weeks');
    expect(daysUntil(startInDays(21))).toBe('In 3 weeks');
  });

  it('still says Today for an event that started earlier today', () => {
    expect(daysUntil({ start: new Date(2026, 9, 14, 8, 0, 0).toISOString() })).toBe('Today');
  });

  it('returns null once the event is in the past', () => {
    expect(daysUntil(startInDays(-1))).toBeNull();
    expect(daysUntil(startInDays(-30))).toBeNull();
  });

  it('reads a date-only value as that calendar day', () => {
    expect(daysUntil({ start: '2026-10-14' })).toBe('Today');
    expect(daysUntil({ start: '2026-10-15' })).toBe('Tomorrow');
  });

  it('returns null for a missing or unparseable date', () => {
    expect(daysUntil({ start: '' })).toBeNull();
    expect(daysUntil({ start: 'next Thursday' })).toBeNull();
    expect(daysUntil({})).toBeNull();
    expect(daysUntil(null)).toBeNull();
  });
});

describe('formatEventPlace', () => {
  it('joins the venue and the room', () => {
    expect(formatEventPlace(calendarEvent())).toBe('Dolan School of Business, 220');
  });

  it('leaves out whichever part the calendar did not give', () => {
    expect(formatEventPlace(calendarEvent({ room: '' }))).toBe('Dolan School of Business');
    expect(formatEventPlace(calendarEvent({ location: '' }))).toBe('220');
    expect(formatEventPlace(calendarEvent({ location: '', room: '' }))).toBe('');
    expect(formatEventPlace(null)).toBe('');
  });
});

describe('eventSourceHost', () => {
  it('names the school, not the calendar subdomain', () => {
    expect(eventSourceHost({ url: 'https://events.fairfield.edu/event/x' })).toBe('fairfield.edu');
    expect(eventSourceHost({ url: 'https://calendar.qu.edu/event/1' })).toBe('qu.edu');
    expect(eventSourceHost({ url: 'https://www.trumba.com/calendars/tufts' })).toBe('trumba.com');
  });

  it('is empty rather than wrong when there is no usable url', () => {
    expect(eventSourceHost({ url: 'not a url' })).toBe('');
    expect(eventSourceHost({})).toBe('');
    expect(eventSourceHost(null)).toBe('');
  });
});

describe('eventSearchUrl', () => {
  it('scopes the search to the school so a generic title finds the right campus', () => {
    const url = eventSearchUrl(calendarEvent({ title: 'Career Fair' }));
    const q = decodeURIComponent(new URL(url).searchParams.get('q'));
    expect(q).toBe('"Career Fair" fairfield.edu');
  });

  it('quotes the title so the words are not scattered across results', () => {
    const q = new URL(eventSearchUrl(calendarEvent())).searchParams.get('q');
    expect(q.startsWith('"')).toBe(true);
  });

  // The whole point of this link is to survive our data being stale or wrong,
  // so it must not depend on the event carrying a working url.
  it('falls back to the college name when the event has no url', () => {
    const url = eventSearchUrl(calendarEvent({ url: '' }), 'Fairfield University');
    const q = decodeURIComponent(new URL(url).searchParams.get('q'));
    expect(q).toContain('Fairfield University');
  });

  it('still searches when it knows neither the host nor the college', () => {
    const url = eventSearchUrl(calendarEvent({ url: '' }), '');
    expect(decodeURIComponent(new URL(url).searchParams.get('q'))).toBe('"Finance Career Panel"');
  });

  it('escapes titles that would otherwise break the query', () => {
    const url = eventSearchUrl(calendarEvent({ title: 'R&D 101: "AI" & you?' }));
    expect(() => new URL(url)).not.toThrow();
    expect(decodeURIComponent(new URL(url).searchParams.get('q'))).toContain('R&D 101: "AI" & you?');
  });

  it('gives nothing rather than a useless search when there is no title', () => {
    expect(eventSearchUrl(calendarEvent({ title: '' }))).toBe('');
    expect(eventSearchUrl(null)).toBe('');
  });
});

// Regression: the shape InvokeLLM returns depends on which model answered.
// Pinning a Claude model nests the payload under `response`; reading the bare
// shape then silently yields nothing, which is indistinguishable from "your
// campus has no events". Verified against the live app on 2026-07-31.
describe('recommendCampusEvents — model-dependent response shape', () => {
  const events = [calendarEvent({ id: '1' })];

  it('reads the nested shape a Claude model returns', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      response: { recommendations: [{ event_id: '1', fit_reason: 'yes' }] },
    });
    const picks = await recommendCampusEvents(events, {});
    expect(picks).toHaveLength(1);
    expect(picks[0].guidance.fit_reason).toBe('yes');
  });

  it('still reads the bare shape the default and Gemini return', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [{ event_id: '1', fit_reason: 'yes' }],
    });
    expect(await recommendCampusEvents(events, {})).toHaveLength(1);
  });

  // Unwrapping must not swallow a legitimately-empty answer into a retry or a
  // crash — "nothing fits" is a correct outcome we rely on.
  it('treats a nested empty list as a real empty list', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({ response: { recommendations: [] } });
    expect(await recommendCampusEvents(events, {})).toEqual([]);
  });

  it('does not mistake a non-object response field for the payload', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [{ event_id: '1', fit_reason: 'yes' }],
      response: 'some string',
    });
    expect(await recommendCampusEvents(events, {})).toHaveLength(1);
  });
});

// ── A calendar the student found for us ─────────────────────────────────────

describe('submitCalendarUrl', () => {
  it('sends the action the backend routes on, with the pasted URL', async () => {
    base44.functions.invoke.mockResolvedValue({ data: { status: 'ok', events: [], college: 'Babson' } });

    await submitCalendarUrl('engage.babson.edu', { days: 45, limit: 20 });

    expect(base44.functions.invoke).toHaveBeenCalledWith('campusEvents', {
      action: 'submit_calendar_url',
      url: 'engage.babson.edu',
      days: 45,
      limit: 20,
    });
  });

  it('returns the resolved feed in the same shape a found feed uses', async () => {
    const event = calendarEvent();
    base44.functions.invoke.mockResolvedValue({
      data: { status: 'ok', from_submission: true, college: 'Babson', events: [event] },
    });

    const result = await submitCalendarUrl('https://engage.babson.edu/events');

    expect(result.status).toBe('ok');
    expect(result.events).toEqual([event]);
  });

  // The whole point of the paste is that the student sees something. A thrown
  // error here would leave them on a spinner inside a modal they cannot leave.
  it('never throws when the function call fails', async () => {
    base44.functions.invoke.mockRejectedValue(new Error('network down'));

    const result = await submitCalendarUrl('https://events.example.edu');

    expect(result.status).toBe('submission_failed');
    expect(result.events).toEqual([]);
  });

  it('survives a response that is not an object', async () => {
    base44.functions.invoke.mockResolvedValue({ data: 'nope' });
    expect(await submitCalendarUrl('https://events.example.edu')).toEqual({
      status: 'submission_failed',
      reason: '',
      events: [],
    });
  });

  // Callers render result.events without guarding it, so a backend answer that
  // omits the key entirely must still arrive as a list.
  it('always carries an events array, even when the backend omits one', async () => {
    base44.functions.invoke.mockResolvedValue({ data: { status: 'submission_rejected', reason: 'wrong_school' } });

    const result = await submitCalendarUrl('https://someone-elses-site.com');

    expect(result.events).toEqual([]);
    expect(SUBMISSION_REJECTIONS[result.reason]).toBeTruthy();
  });
});

describe('schoolEventsSearchUrl', () => {
  it('searches for the school by name', () => {
    expect(schoolEventsSearchUrl('Sacred Heart University')).toBe(
      'https://www.google.com/search?q=Sacred%20Heart%20University%20events%20calendar',
    );
  });

  // The no-feed state must not send a student to the main events page: that is
  // the one page measured at 0 for 12 on schools we cannot read.
  it('can look for the club portal instead of the calendar', () => {
    expect(schoolEventsSearchUrl('Barnard College', 'student club portal get involved')).toBe(
      'https://www.google.com/search?q=Barnard%20College%20student%20club%20portal%20get%20involved',
    );
  });

  // Every empty state renders this link, including the one where we never
  // learned the school's name. An href of "undefined events calendar" is worse
  // than no link at all.
  it('has nothing to offer without a school name', () => {
    expect(schoolEventsSearchUrl('')).toBe('');
    expect(schoolEventsSearchUrl(undefined)).toBe('');
    expect(schoolEventsSearchUrl('   ')).toBe('');
  });
});
