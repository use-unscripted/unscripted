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
  resetCampusEventCache,
  schoolEventsSearchUrl,
  submitCalendarUrl,
  SUBMISSION_REJECTIONS,
  listFeedSubmissions,
  reviewFeedSubmission,
  listCampusFeeds,
  checkCampusFeeds,
  reportFeedWrong,
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
  // The feed and the ranking are both remembered between calls, so every test
  // has to start from a cold one or it reads the test before it.
  resetCampusEventCache();
});

describe('recommendCampusEvents', () => {
  it('returns the full calendar record with guidance attached', async () => {
    const event = calendarEvent();
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [
        {
          event_id: '1',
          connection_evidence: 'alumni analysts on the first two years at a desk',
          connection: 'direct',
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
          connection: 'direct',
          connection_evidence: 'alumni analysts on the first two years at a desk',
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
          connection: 'direct',
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
        { event_id: '1', connection: 'direct', fit_reason: 'Real.' },
        { event_id: '999', connection: 'direct', fit_reason: 'Invented out of thin air.' },
        { event_id: '', connection: 'direct', fit_reason: 'No id at all.' },
        { connection: 'direct', fit_reason: 'No id key at all.' },
        null,
      ],
    });

    const picks = await recommendCampusEvents([calendarEvent()], PROFILE);

    expect(picks.map(p => p.id)).toEqual(['1']);
  });

  it('collapses a duplicated event_id to one pick', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [
        { event_id: '1', connection: 'direct', fit_reason: 'First.' },
        { event_id: '1', connection: 'direct', fit_reason: 'Same event again.' },
      ],
    });

    const picks = await recommendCampusEvents([calendarEvent()], PROFILE);

    expect(picks).toHaveLength(1);
    expect(picks[0].guidance.fit_reason).toBe('First.');
  });

  it('matches ids across types, so a numeric id still joins', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [{ event_id: 7, connection: 'direct', fit_reason: 'Real.' }],
    });

    const picks = await recommendCampusEvents([calendarEvent({ id: 7 })], PROFILE);

    expect(picks).toHaveLength(1);
  });

  /*
    The relevance floor.

    A student testing investment banking was led with a talk on wartime
    diplomacy, under a heading saying it was worth their time, with a sentence
    underneath explaining why. Nothing was checking relevance: the model was
    asked for the best of a campus calendar and returned the best of a campus
    calendar, and the prompt required a reason, so it wrote one. The label is
    the check, and only two of its three values are a recommendation.
  */
  describe('the relevance floor', () => {
    it('drops an event the model itself called general', async () => {
      const events = [calendarEvent({ id: '1' }), calendarEvent({ id: '2', title: 'Open VISIONS Forum' })];
      base44.integrations.Core.InvokeLLM.mockResolvedValue({
        recommendations: [
          { event_id: '2', connection: 'general', fit_reason: 'An important speaker you cannot hear anywhere else.' },
          { event_id: '1', connection: 'direct', fit_reason: 'Analysts who do the job will be there.' },
        ],
      });

      const picks = await recommendCampusEvents(events, PROFILE);

      expect(picks.map(p => p.id)).toEqual(['1']);
    });

    // Unlabelled is not vetted. Passing it through is the old behaviour, and
    // the old behaviour is the bug.
    it('drops an event with no readable label', async () => {
      const events = ['1', '2', '3', '4'].map(id => calendarEvent({ id }));
      base44.integrations.Core.InvokeLLM.mockResolvedValue({
        recommendations: [
          { event_id: '1', fit_reason: 'No label at all.' },
          { event_id: '2', connection: '', fit_reason: 'Empty label.' },
          { event_id: '3', connection: ['direct'], fit_reason: 'Not even a string.' },
          { event_id: '4', connection: 'adjacent', fit_reason: 'Builds a skill they asked for.' },
        ],
      });

      const picks = await recommendCampusEvents(events, PROFILE);

      expect(picks.map(p => p.id)).toEqual(['4']);
    });

    it('reads the label whatever case and spacing it arrives in', async () => {
      base44.integrations.Core.InvokeLLM.mockResolvedValue({
        recommendations: [{ event_id: '1', connection: ' Direct ', fit_reason: 'Fits.' }],
      });

      const picks = await recommendCampusEvents([calendarEvent()], PROFILE);

      expect(picks.map(p => p.guidance.connection)).toEqual(['direct']);
    });

    /*
      Every surface takes the first pick it can use, so this ordering IS the
      recommendation. The model's own order is not reliably strength of fit.
    */
    it('leads with a direct fit over an adjacent one', async () => {
      const events = ['1', '2', '3'].map(id => calendarEvent({ id }));
      base44.integrations.Core.InvokeLLM.mockResolvedValue({
        recommendations: [
          { event_id: '1', connection: 'adjacent', fit_reason: 'Adjacent, and listed first.' },
          { event_id: '2', connection: 'direct', fit_reason: 'Direct.' },
          { event_id: '3', connection: 'adjacent', fit_reason: 'Adjacent, listed last.' },
        ],
      });

      const picks = await recommendCampusEvents(events, PROFILE);

      // Direct first, then the two adjacent ones in the order they arrived.
      expect(picks.map(p => p.id)).toEqual(['2', '1', '3']);
    });

    // An honest empty answer. This is the outcome the floor exists to make
    // possible, and it is worth remembering for as long as any other verdict.
    it('recommends nothing when everything on the calendar is general', async () => {
      base44.integrations.Core.InvokeLLM.mockResolvedValue({
        recommendations: [
          { event_id: '1', connection: 'general', fit_reason: 'Interesting for anyone.' },
        ],
      });

      await expect(recommendCampusEvents([calendarEvent()], PROFILE)).resolves.toEqual([]);

      await recommendCampusEvents([calendarEvent()], PROFILE);
      expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(1);
    });

    /*
      The one empty answer that is NOT a verdict.

      A model that skipped the label entirely has not judged anything, and
      caching that would leave this student with no recommendations for half an
      hour over one bad generation. It has to be asked again.
    */
    it('asks again when the model ignored the label entirely', async () => {
      base44.integrations.Core.InvokeLLM.mockResolvedValue({
        recommendations: [{ event_id: '1', fit_reason: 'No label anywhere in the response.' }],
      });

      await expect(recommendCampusEvents([calendarEvent()], PROFILE)).resolves.toEqual([]);

      await recommendCampusEvents([calendarEvent()], PROFILE);
      expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(2);
    });

    // A model that judged everything and found nothing sends an empty list. It
    // has not ignored anything, so this must stay a verdict.
    it('treats an empty list as a verdict, not a skipped label', async () => {
      base44.integrations.Core.InvokeLLM.mockResolvedValue({ recommendations: [] });

      await expect(recommendCampusEvents([calendarEvent()], PROFILE)).resolves.toEqual([]);

      await recommendCampusEvents([calendarEvent()], PROFILE);
      expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(1);
    });
  });

  it('returns at most three', async () => {
    const events = ['1', '2', '3', '4', '5'].map(id => calendarEvent({ id }));
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: events.map(e => ({ event_id: e.id, connection: 'direct', fit_reason: 'Fits.' })),
    });

    const picks = await recommendCampusEvents(events, PROFILE);

    expect(picks.map(p => p.id)).toEqual(['1', '2', '3']);
  });

  it('defaults missing guidance sub-fields instead of leaving them undefined', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [{ event_id: '1', connection: 'direct' }],
    });

    const [pick] = await recommendCampusEvents([calendarEvent()], PROFILE);

    expect(pick.guidance).toEqual({
      connection: 'direct',
      connection_evidence: '',
      fit_reason: '',
      what_to_do: [],
      questions_to_ask: [],
      proof_to_capture: '',
    });
  });

  it('drops empty strings out of the guidance lists', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [{ event_id: '1', connection: 'direct', what_to_do: ['Arrive early', '', null], questions_to_ask: [''] }],
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

  // `response_json_schema` is a request, not a guarantee. A model that answers
  // with a string where an array was asked for used to take the whole picker
  // down with a TypeError, thrown from inside a promise nothing was catching.
  it('degrades a wrongly-typed model field instead of throwing', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [{
        event_id: '1',
        connection: 'direct',
        fit_reason: 'Alumni who do the job.',
        what_to_do: 'Get there ten minutes early.',
        questions_to_ask: { first: 'What does your Tuesday look like?' },
        proof_to_capture: ['a photo of the panel'],
      }],
    });

    const [pick] = await recommendCampusEvents([calendarEvent()], PROFILE);

    expect(pick.guidance.what_to_do).toEqual(['Get there ten minutes early.']);
    expect(pick.guidance.questions_to_ask).toEqual([]);
    expect(pick.guidance.proof_to_capture).toBe('');
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

  // Most school calendars say nothing about money, and a model handed
  // "free: null" will happily write "and it's free" into a fit reason. The
  // field is left out entirely so there is nothing to read either way.
  it('tells the model nothing about price when the calendar did not say', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({ recommendations: [] });

    await recommendCampusEvents([calendarEvent({ is_free: null })], PROFILE);

    const { prompt } = base44.integrations.Core.InvokeLLM.mock.calls[0][0];
    expect(prompt).not.toContain('"free"');
  });

  it('tells the model the price when the calendar did say', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({ recommendations: [] });

    await recommendCampusEvents([calendarEvent({ is_free: false })], PROFILE);

    const { prompt } = base44.integrations.Core.InvokeLLM.mock.calls[0][0];
    expect(prompt).toContain('"free": false');
  });
});

describe('fetchCampusEvents', () => {
  it('asks the backend for the window it was given', async () => {
    base44.functions.invoke.mockResolvedValue({ events: [], college: 'Fairfield University' });

    await fetchCampusEvents({ days: 30, limit: 5, seriesDates: 1 });

    expect(base44.functions.invoke).toHaveBeenCalledWith('campusEvents', { days: 30, limit: 5, seriesDates: 1, refresh: false });
  });

  it('defaults the window when called with nothing', async () => {
    base44.functions.invoke.mockResolvedValue({ events: [] });

    await fetchCampusEvents();

    expect(base44.functions.invoke).toHaveBeenCalledWith('campusEvents', { days: 45, limit: 20, seriesDates: 1, refresh: false });
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

// The picker lives in a modal a student opens, closes and opens again. Every
// one of those mounts used to re-read the school's whole calendar and re-run a
// paid model call to render what was already on screen.
describe('not asking twice', () => {
  it('reads the calendar once for repeated opens', async () => {
    base44.functions.invoke.mockResolvedValue({ status: 'ok', events: [calendarEvent()] });

    await fetchCampusEvents();
    await fetchCampusEvents();
    await fetchCampusEvents();

    expect(base44.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it('sends one request when two mounts race each other', async () => {
    base44.functions.invoke.mockResolvedValue({ status: 'ok', events: [calendarEvent()] });

    await Promise.all([fetchCampusEvents(), fetchCampusEvents()]);

    expect(base44.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it('asks again for a different window', async () => {
    base44.functions.invoke.mockResolvedValue({ status: 'ok', events: [] });

    await fetchCampusEvents({ days: 45, limit: 20 });
    await fetchCampusEvents({ days: 30, limit: 20 });

    expect(base44.functions.invoke).toHaveBeenCalledTimes(2);
  });

  // A list and a month grid want opposite answers about a weekly club, so they
  // are different questions and must not answer each other from cache.
  it('asks again when a caller wants every date of a repeating event', async () => {
    base44.functions.invoke.mockResolvedValue({ status: 'ok', events: [] });

    await fetchCampusEvents({ days: 45, limit: 20 });
    await fetchCampusEvents({ days: 45, limit: 20, seriesDates: 12 });

    expect(base44.functions.invoke).toHaveBeenCalledTimes(2);
    expect(base44.functions.invoke).toHaveBeenLastCalledWith('campusEvents', {
      days: 45, limit: 20, seriesDates: 12, refresh: false,
    });
  });

  // A school's server failing to answer is the one outcome worth re-asking
  // about — the student is looking at a retry button.
  it('does not remember a failed lookup', async () => {
    base44.functions.invoke.mockRejectedValue(new Error('down'));
    await fetchCampusEvents();

    base44.functions.invoke.mockResolvedValue({ status: 'ok', events: [calendarEvent()] });
    await expect(fetchCampusEvents()).resolves.toMatchObject({ status: 'ok' });

    expect(base44.functions.invoke).toHaveBeenCalledTimes(2);
  });

  it('goes back to the school when the student asks it to retry', async () => {
    base44.functions.invoke.mockResolvedValue({ status: 'ok', events: [calendarEvent()] });

    await fetchCampusEvents();
    await fetchCampusEvents({ refresh: true });

    expect(base44.functions.invoke).toHaveBeenCalledTimes(2);
  });

  // Clearing what this browser remembers is only half of it. The server keeps a
  // per-school list for a day, shared by everyone there, and a retry that does
  // not say so gets handed the same list back, which is exactly what the
  // student is pressing the button to escape.
  it('tells the server to skip its own cache on a retry', async () => {
    base44.functions.invoke.mockResolvedValue({ status: 'ok', events: [calendarEvent()] });

    await fetchCampusEvents({ refresh: true });

    expect(base44.functions.invoke).toHaveBeenLastCalledWith('campusEvents', {
      days: 45, limit: 20, seriesDates: 1, refresh: true,
    });
  });

  it('forgets the calendar once a student tells us where it is', async () => {
    base44.functions.invoke.mockResolvedValue({ status: 'ok', events: [calendarEvent()] });
    await fetchCampusEvents();

    await submitCalendarUrl('https://fairfield.campusgroups.com');
    await fetchCampusEvents();

    // The read, the submission, and a read that no longer trusts the old answer.
    expect(base44.functions.invoke).toHaveBeenCalledTimes(3);
  });

  it('ranks the same events for the same student once', async () => {
    const events = [calendarEvent()];
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [{ event_id: '1', connection: 'direct', fit_reason: 'Alumni who do the job.' }],
    });

    await recommendCampusEvents(events, PROFILE);
    await recommendCampusEvents(events, PROFILE);

    expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(1);
  });

  it('ranks again when the events change', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({ recommendations: [] });

    await recommendCampusEvents([calendarEvent()], PROFILE);
    await recommendCampusEvents([calendarEvent({ id: '2' })], PROFILE);

    expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(2);
  });

  it('ranks again when the student changes', async () => {
    const events = [calendarEvent()];
    base44.integrations.Core.InvokeLLM.mockResolvedValue({ recommendations: [] });

    await recommendCampusEvents(events, PROFILE);
    await recommendCampusEvents(events, { ...PROFILE, career_interests: 'Product design' });

    expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(2);
  });

  it('ranks again when the path being tested changes', async () => {
    const events = [calendarEvent()];
    base44.integrations.Core.InvokeLLM.mockResolvedValue({ recommendations: [] });

    await recommendCampusEvents(events, PROFILE, { pathName: 'Investment Banking' });
    await recommendCampusEvents(events, PROFILE, { pathName: 'Product Management' });

    expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(2);
  });

  // Before the cache, reopening the picker asked the model again, so a blip
  // healed itself. A remembered failure would have taken that away.
  it('does not remember a ranking the model failed to produce', async () => {
    const events = [calendarEvent()];
    base44.integrations.Core.InvokeLLM.mockRejectedValue(new Error('rate limited'));
    await expect(recommendCampusEvents(events, PROFILE)).resolves.toEqual([]);

    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [{ event_id: '1', connection: 'direct', fit_reason: 'Alumni who do the job.' }],
    });
    const picks = await recommendCampusEvents(events, PROFILE);

    expect(picks).toHaveLength(1);
    expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(2);
  });

  it('does not remember a response it could not read', async () => {
    const events = [calendarEvent()];
    base44.integrations.Core.InvokeLLM.mockResolvedValue({ recommendations: 'not a list' });
    await expect(recommendCampusEvents(events, PROFILE)).resolves.toEqual([]);

    base44.integrations.Core.InvokeLLM.mockResolvedValue({ recommendations: [] });
    await recommendCampusEvents(events, PROFILE);

    expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(2);
  });

  // The opposite case, and the one the cache exists for: a model that read the
  // events and genuinely ranked none of them has answered, and re-asking costs
  // money to be told the same thing.
  it('remembers a model that ranked nothing', async () => {
    const events = [calendarEvent()];
    base44.integrations.Core.InvokeLLM.mockResolvedValue({ recommendations: [] });

    await recommendCampusEvents(events, PROFILE);
    await recommendCampusEvents(events, PROFILE);

    expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(1);
  });

  // The two tests above cover a failure the ranking RETURNED. This is the other
  // case: one it THREW never reaches that check, so the rejected promise stays
  // in the map and re-throws on every read until the TTL runs out.
  it('does not remember a ranking that threw', async () => {
    const events = [calendarEvent()];
    const unreadable = {};
    Object.defineProperty(unreadable, 'response', {
      enumerable: true,
      get() { throw new Error('unreadable payload'); },
    });
    base44.integrations.Core.InvokeLLM.mockResolvedValue(unreadable);

    await expect(recommendCampusEvents(events, PROFILE)).rejects.toThrow();
    await expect(recommendCampusEvents(events, PROFILE)).rejects.toThrow();

    // A memoised rejection would re-throw without asking the model again.
    expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(2);
  });

  // Every open of the picker reads the calendar and then ranks against it. The
  // ranking key carries the student's profile, so editing interests writes a
  // new entry each time while the calendar stays one. Unless a hit moves its
  // entry to the back of the queue, the calendar is the oldest key in a 24-slot
  // map and a run of rankings evicts the one thing all of them share.
  it('keeps the calendar rather than evicting it behind a run of rankings', async () => {
    base44.functions.invoke.mockResolvedValue({ status: 'ok', events: [calendarEvent()] });
    base44.integrations.Core.InvokeLLM.mockResolvedValue({ recommendations: [] });

    for (let i = 0; i < 30; i++) {
      await fetchCampusEvents();
      await recommendCampusEvents([calendarEvent()], { ...PROFILE, major: `Major ${i}` });
    }

    expect(base44.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it('a retry clears the ranking too, not just the calendar', async () => {
    const events = [calendarEvent()];
    base44.functions.invoke.mockResolvedValue({ status: 'ok', events });
    base44.integrations.Core.InvokeLLM.mockResolvedValue({ recommendations: [] });

    await recommendCampusEvents(events, PROFILE);
    await fetchCampusEvents({ refresh: true });
    await recommendCampusEvents(events, PROFILE);

    expect(base44.integrations.Core.InvokeLLM).toHaveBeenCalledTimes(2);
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
describe('recommendCampusEvents: model-dependent response shape', () => {
  const events = [calendarEvent({ id: '1' })];

  it('reads the nested shape a Claude model returns', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      response: { recommendations: [{ event_id: '1', connection: 'direct', fit_reason: 'yes' }] },
    });
    const picks = await recommendCampusEvents(events, {});
    expect(picks).toHaveLength(1);
    expect(picks[0].guidance.fit_reason).toBe('yes');
  });

  it('still reads the bare shape the default and Gemini return', async () => {
    base44.integrations.Core.InvokeLLM.mockResolvedValue({
      recommendations: [{ event_id: '1', connection: 'direct', fit_reason: 'yes' }],
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
      recommendations: [{ event_id: '1', connection: 'direct', fit_reason: 'yes' }],
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

// ── The review queue ────────────────────────────────────────────────────────

describe('listFeedSubmissions', () => {
  it('reads the queue through the function, not the entity', async () => {
    base44.functions.invoke.mockResolvedValue({ data: { submissions: [{ id: 'a' }] } });

    expect(await listFeedSubmissions()).toEqual([{ id: 'a' }]);
    expect(base44.functions.invoke).toHaveBeenCalledWith('campusEvents', {
      action: 'list_submissions',
    });
  });

  it('treats a missing or malformed list as empty', async () => {
    for (const data of [{}, { submissions: null }, { submissions: 'none' }, null]) {
      base44.functions.invoke.mockResolvedValue({ data });
      expect(await listFeedSubmissions()).toEqual([]);
    }
  });

  // A 403 from the function must not render as an empty queue — that reads as
  // "no student has ever sent a link", which is a different fact entirely.
  it('throws when the backend refuses', async () => {
    base44.functions.invoke.mockResolvedValue({ data: { error: 'Forbidden' } });
    await expect(listFeedSubmissions()).rejects.toThrow('Forbidden');
  });
});

describe('reviewFeedSubmission', () => {
  it('sends the decision for one submission', async () => {
    base44.functions.invoke.mockResolvedValue({ data: { ok: true, promoted: true } });

    const result = await reviewFeedSubmission('sub-1', 'approved');

    expect(base44.functions.invoke).toHaveBeenCalledWith('campusEvents', {
      action: 'review_submission',
      id: 'sub-1',
      decision: 'approved',
    });
    expect(result.promoted).toBe(true);
  });

  // Approving is what turns one student's link into a whole school's calendar.
  // Swallowing a failure here would leave an admin believing a school is
  // switched over when nothing was written.
  it('throws when the promotion failed', async () => {
    base44.functions.invoke.mockResolvedValue({
      data: { error: "Couldn't write that feed to the school. Nothing changed." },
    });
    await expect(reviewFeedSubmission('sub-1', 'approved')).rejects.toThrow('Nothing changed');
  });
});

// ── Is a feed we already resolved still working? ────────────────────────────

describe('listCampusFeeds', () => {
  it('reads every school and its health through the function', async () => {
    base44.functions.invoke.mockResolvedValue({
      data: { feeds: [{ id: 'u1', canonical_name: 'Fairfield', events_last_error: '' }] },
    });

    const feeds = await listCampusFeeds();

    expect(feeds).toHaveLength(1);
    expect(base44.functions.invoke).toHaveBeenCalledWith('campusEvents', { action: 'list_feeds' });
  });

  // Same reason the queue throws: an empty health page reads as "every school
  // is fine", which is the one thing it must never say when it doesn't know.
  it('throws when the backend refuses', async () => {
    base44.functions.invoke.mockResolvedValue({ data: { error: 'Forbidden' } });
    await expect(listCampusFeeds()).rejects.toThrow('Forbidden');
  });

  it('treats a malformed list as no schools', async () => {
    for (const data of [{}, { feeds: null }, { feeds: 'lots' }, null]) {
      base44.functions.invoke.mockResolvedValue({ data });
      expect(await listCampusFeeds()).toEqual([]);
    }
  });
});

describe('checkCampusFeeds', () => {
  it('carries back what was checked and what was left out', async () => {
    base44.functions.invoke.mockResolvedValue({
      data: { checked: [{ college: 'Fairfield', error: '' }], skipped: 4 },
    });

    const result = await checkCampusFeeds();

    expect(result.checked).toHaveLength(1);
    // A run that only looked at some of them must not read as a clean sweep.
    expect(result.skipped).toBe(4);
    expect(base44.functions.invoke).toHaveBeenCalledWith('campusEvents', { action: 'check_feeds' });
  });

  it('reports nothing skipped rather than NaN when the backend omits it', async () => {
    base44.functions.invoke.mockResolvedValue({ data: { checked: [] } });
    expect(await checkCampusFeeds()).toEqual({ checked: [], skipped: 0 });
  });
});

describe('reportFeedWrong', () => {
  it('sends the student note with the report', async () => {
    base44.functions.invoke.mockResolvedValue({ data: { status: 'reported' } });

    const result = await reportFeedWrong("this is the law school's calendar");

    expect(base44.functions.invoke).toHaveBeenCalledWith('campusEvents', {
      action: 'report_feed',
      note: "this is the law school's calendar",
    });
    expect(result.status).toBe('reported');
  });

  it('sends without a note, because demanding a reason loses the report', async () => {
    base44.functions.invoke.mockResolvedValue({ data: { status: 'reported' } });
    await reportFeedWrong();
    expect(base44.functions.invoke).toHaveBeenCalledWith('campusEvents', {
      action: 'report_feed',
      note: '',
    });
  });

  // A student telling us something is broken must never be shown a second
  // broken thing. Everything else in this file that a student touches has the
  // same contract.
  it('never throws when the function call fails', async () => {
    base44.functions.invoke.mockRejectedValue(new Error('offline'));
    expect(await reportFeedWrong('x')).toEqual({ status: 'report_failed', error: 'offline' });
  });

  it('treats an unreadable response as a failure rather than a success', async () => {
    for (const data of [null, {}, 'ok']) {
      base44.functions.invoke.mockResolvedValue({ data });
      expect((await reportFeedWrong()).status).toBe('report_failed');
    }
  });
});
