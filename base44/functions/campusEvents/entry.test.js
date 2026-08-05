/**
 * A thin in-repo net under the campusEvents iCal parser.
 *
 * ## Read this before adding to it
 *
 * **This file is NOT the test suite for this function.** The real one is 50
 * Deno tests that live outside the repo, and they are the authority on every
 * decision this parser makes — including several deliberate ones that look like
 * bugs until you read them (a mismatched-form exclusion drops the whole series;
 * a `Z`-stamped series pins the UTC clock across a clock change). Searching
 * inside this repo finds no tests for this file, and that conclusion is wrong.
 *
 *   cd ~/.claude/projects/-Users-drewlynch-AI-Projects-Unscripted/campus-sweep
 *   ENTRY=<path-to>/base44/functions/campusEvents/entry.ts \
 *     deno test --allow-net --allow-read --allow-env --allow-write --allow-sys \
 *       --node-modules-dir=auto ical.test.ts submitted-url.test.ts
 *
 * `--node-modules-dir=auto` is not optional. See `docs/campus-events.md`.
 *
 * **Any change to entry.ts has to run both suites.** This one exists only
 * because the external one is invisible to `npm test`, so a regression in a
 * production-touching backend function could otherwise reach `main` with a
 * green run behind it. It deliberately does not restate what the 50 cover — it
 * holds the behaviours added since they were written, plus a check that the
 * module still loads at all.
 *
 * The all-day tests below go through `fetchEvents` and the request-time gate,
 * not just the parser, on purpose. A parser-only test is what let a half-fix
 * ship green in 2026-08-03 while it was losing real listings.
 *
 * ## How it loads a Deno function under Node
 *
 * `entry.ts` imports the SDK by `npm:` specifier and ends in `Deno.serve`,
 * neither of which Node can take. The file is read, those two are removed, the
 * TypeScript is stripped, and the rest is imported as an ordinary module.
 * Nothing in the deployed file changes to make this possible.
 */

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function loadEntry() {
  const file = fileURLToPath(new URL('./entry.ts', import.meta.url));
  let source = readFileSync(file, 'utf8');

  source = source.replace(
    /^import \{ createClientFromRequest \}.*$/m,
    'const createClientFromRequest = () => { throw new Error("SDK not available under test"); };',
  );

  const serve = source.indexOf('\nDeno.serve(');
  if (serve < 0) throw new Error('entry.ts no longer ends in Deno.serve — update this harness');
  source = source.slice(0, serve);

  const { code } = transformSync(source, { loader: 'ts', format: 'esm', target: 'node20' });
  const dir = mkdtempSync(join(tmpdir(), 'campus-events-'));
  const out = join(dir, 'entry.mjs');
  writeFileSync(out, code);
  return import(pathToFileURL(out).href);
}

const {
  parseIcsEvents,
  fetchEvents,
  isAttendable,
  stillUpcoming,
  scrapedFeedFor,
  scoreEvent,
  schoolEvents,
  SCRAPED_MAX_AGE_DAYS,
} = await loadEntry();

const ENTRY_SOURCE = readFileSync(fileURLToPath(new URL('./entry.ts', import.meta.url)), 'utf8');

function calendar(...vevents) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...vevents.map(body => ['BEGIN:VEVENT', ...body, 'END:VEVENT'].join('\r\n')),
    'END:VCALENDAR',
  ].join('\r\n');
}

const starts = events => events.map(e => e.start);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-03T12:00:00Z')); // A Monday.
});

afterEach(() => {
  vi.useRealTimers();
});

// The one assertion here that overlaps the external suite, kept on purpose: if
// the harness above silently stopped loading the module, every other test in
// this file would pass vacuously.
describe('the parser is reachable from a Node test run', () => {
  it('reads a plain event out of a calendar', () => {
    const events = parseIcsEvents(calendar([
      'UID:smoke@x',
      'SUMMARY:Career Fair',
      'DTSTART:20260909T143000Z',
    ]));
    expect(starts(events)).toEqual(['2026-09-09T14:30:00.000Z']);
  });
});

describe('a repeating all-day series', () => {
  // This used to pin the opposite: a weekly all-day series answered with NEXT
  // week's date on the very day it was happening, because a bare day parses
  // back as its own UTC midnight and sat below the "an hour ago" floor.
  //
  // Fixing only this floor was tried on 2026-08-03 and reverted the same day —
  // it made things strictly worse (5 upcoming listings lost across 38 real
  // school feeds over 28 days, none gained), because the two request-time
  // filters still threw the date away and the series spends its only slot on
  // it. The fix that works moves the expansion floor and both request filters
  // together, onto one shared window. `whole path` below is what proves it;
  // this test alone would go green for the broken half-fix too.
  it('answers with today on a day it is actually happening', () => {
    const events = parseIcsEvents(calendar([
      'UID:allday@x',
      'DTSTART;VALUE=DATE:20260727',
      'RRULE:FREQ=WEEKLY',
    ]));
    expect(starts(events)).toEqual(['2026-08-03']);
    expect(events[0].allDay).toBe(true);
  });

  it('moves on once the day is behind us', () => {
    vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));
    const events = parseIcsEvents(calendar([
      'UID:allday2@x',
      'DTSTART;VALUE=DATE:20260727',
      'RRULE:FREQ=WEEKLY',
    ]));
    expect(starts(events)).toEqual(['2026-08-10']);
  });

  it('still offers a timed series later the same day', () => {
    // A timed value carries a real clock, so it sits above the hour's grace and
    // today's meeting is offered as today's. Unchanged by the all-day window.
    const events = parseIcsEvents(calendar([
      'UID:timed@x',
      'DTSTART;TZID=America/New_York:20260727T170000',
      'RRULE:FREQ=WEEKLY',
    ]));
    expect(starts(events)).toEqual(['2026-08-03T17:00:00']);
  });
});

describe('how long an event stays upcoming', () => {
  const NOON = Date.parse('2026-08-03T12:00:00Z');

  it('keeps an all-day event through its own day', () => {
    expect(stillUpcoming('2026-08-03', '', true, Date.parse('2026-08-03T00:59:00Z'))).toBe(true);
    expect(stillUpcoming('2026-08-03', '', true, NOON)).toBe(true);
    expect(stillUpcoming('2026-08-03', '', true, Date.parse('2026-08-03T23:59:00Z'))).toBe(true);
  });

  it('drops it once the day is over', () => {
    expect(stillUpcoming('2026-08-03', '', true, Date.parse('2026-08-04T00:01:00Z'))).toBe(false);
    expect(stillUpcoming('2026-08-02', '', true, NOON)).toBe(false);
  });

  it('treats a bare day as a whole day even where the feed set no flag', () => {
    // Localist falls back to a date-only `first_date` when an event has no
    // instance, and reads `all_day` off the instance that is not there; Drupal
    // has no all-day flag at all. A value with no clock in it is not a moment.
    expect(stillUpcoming('2026-08-03', '', false, NOON)).toBe(true);
    expect(stillUpcoming('2026-08-03', '', false, Date.parse('2026-08-04T00:01:00Z'))).toBe(false);
  });

  it('leaves a timed event on the hour of grace it always had', () => {
    expect(stillUpcoming('2026-08-03T11:30:00Z', '', false, NOON)).toBe(true);
    expect(stillUpcoming('2026-08-03T10:30:00Z', '', false, NOON)).toBe(false);
    // The all-day marking is what widens the window, not the time of day: an
    // event a feed stamped at real local midnight and flagged all-day runs to
    // local end-of-day, which is the right answer and comes for free.
    expect(stillUpcoming('2026-08-03T00:00:00-04:00', '', true, Date.parse('2026-08-03T23:00:00Z')))
      .toBe(true);
  });

  it('answers the same on any host, because a bare day is UTC by spec', () => {
    // The one thing that must not depend on where this runs. No named zone is
    // guessed anywhere in the window, so TZ cannot enter into it.
    expect(new Date('2026-08-03').getTime()).toBe(Date.UTC(2026, 7, 3));
    expect(stillUpcoming('2026-08-03', '', true, Date.UTC(2026, 7, 3, 23, 59))).toBe(true);
    expect(stillUpcoming('2026-08-03', '', true, Date.UTC(2026, 7, 4, 0, 1))).toBe(false);
  });

  it('refuses a value it cannot read at all', () => {
    expect(stillUpcoming('', '', true, NOON)).toBe(false);
    expect(stillUpcoming('sometime next week', '', false, NOON)).toBe(false);
  });

  it('keeps a multi-day all-day event up through its last day', () => {
    // The three-day orientation fair. Anchored to the start alone this vanished
    // on the morning of day two while it was still running.
    const fair = ['2026-08-03', '2026-08-05'];
    expect(stillUpcoming(...fair, true, NOON)).toBe(true);
    expect(stillUpcoming(...fair, true, Date.parse('2026-08-04T12:00:00Z'))).toBe(true);
    expect(stillUpcoming(...fair, true, Date.parse('2026-08-05T23:59:00Z'))).toBe(true);
  });

  it('drops it once its last day is over', () => {
    expect(stillUpcoming('2026-08-03', '2026-08-05', true, Date.parse('2026-08-06T00:01:00Z')))
      .toBe(false);
  });

  it('carries a month-long exhibition the whole month', () => {
    expect(stillUpcoming('2026-08-01', '2026-08-31', true, Date.parse('2026-08-28T12:00:00Z')))
      .toBe(true);
  });

  // The safety property the whole design rests on. An end is the least reliable
  // field in every feed here, so it is only ever allowed to extend the window —
  // no value of it can drop a listing the start alone would have shown.
  it('never lets an end shorten the window a start alone would give', () => {
    const early = ['2026-08-03', '2026-07-01']; // end before the start
    expect(stillUpcoming(...early, true, NOON)).toBe(true);
    expect(stillUpcoming('2026-08-03', 'not a date', true, NOON)).toBe(true);
    expect(stillUpcoming('2026-08-03', '', true, NOON)).toBe(true);
    // And a timed event keeps exactly the hour of grace it always had.
    expect(stillUpcoming('2026-08-03T10:30:00Z', '2026-08-03T10:45:00Z', false, NOON)).toBe(false);
  });

  it('extends a timed event that runs long', () => {
    // An all-day conference stamped with real clock times, still in its closing
    // session. The start is nine hours past its hour of grace.
    expect(stillUpcoming('2026-08-03T02:00:00Z', '2026-08-03T17:00:00Z', false, NOON)).toBe(true);
  });
});

// The gap the half-fix fell into: everything above can be green while a student
// still sees nothing, because the request-time filter runs after the parser and
// throws the date away. These go through the real adapter, the real normalise
// step and the real request gate — the whole path, on a served calendar.
describe('the whole path, feed to what a student is shown', () => {
  const FEED = 'https://example.edu/events.ics';
  let realFetch;

  function serve(ics) {
    realFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve(new Response(ics, { status: 200 }));
  }

  afterEach(() => {
    if (realFetch) globalThis.fetch = realFetch;
    realFetch = undefined;
  });

  /** Exactly what the handler does with a feed: fetch, attendable, upcoming. */
  async function shown() {
    const events = await fetchEvents('ical', FEED, 45);
    return events
      .filter(isAttendable)
      .filter(e => stillUpcoming(e.start, e.end, e.all_day, Date.now()))
      .map(e => e.start);
  }

  it('shows a one-off all-day event on the day it is happening', async () => {
    serve(calendar(['UID:one@x', 'SUMMARY:Involvement Fair', 'DTSTART;VALUE=DATE:20260803']));
    expect(await shown()).toEqual(['2026-08-03']);
  });

  it('stops showing it once the day is over', async () => {
    vi.setSystemTime(new Date('2026-08-04T00:30:00Z'));
    serve(calendar(['UID:one@x', 'SUMMARY:Involvement Fair', 'DTSTART;VALUE=DATE:20260803']));
    expect(await shown()).toEqual([]);
  });

  it('reaches a student with a weekly all-day club on its own day', async () => {
    // The listing that used to be lost twice over: named next Tuesday by the
    // parser, then discarded by the filter once the parser was half-fixed.
    serve(calendar([
      'UID:club@x',
      'SUMMARY:Entrepreneurship Club',
      'DTSTART;VALUE=DATE:20260727',
      'RRULE:FREQ=WEEKLY',
    ]));
    expect(await shown()).toEqual(['2026-08-03']);
  });

  it('does not change what a timed event does', async () => {
    serve(calendar(
      ['UID:soon@x', 'SUMMARY:Career Fair', 'DTSTART:20260803T113000Z'],
      ['UID:stale@x', 'SUMMARY:Ended', 'DTSTART:20260803T090000Z'],
      ['UID:later@x', 'SUMMARY:Panel', 'DTSTART:20260805T180000Z'],
    ));
    expect(await shown()).toEqual(['2026-08-03T11:30:00.000Z', '2026-08-05T18:00:00.000Z']);
  });

  /** Same three-day fair, read from a real RFC 5545 exclusive DTEND. */
  const FAIR = ['UID:fair@x', 'SUMMARY:Orientation Fair',
    'DTSTART;VALUE=DATE:20260803', 'DTEND;VALUE=DATE:20260806'];

  it('still offers a three-day fair on its second and third days', async () => {
    vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));
    serve(calendar(FAIR));
    expect(await shown()).toEqual(['2026-08-03']);

    vi.setSystemTime(new Date('2026-08-05T23:00:00Z'));
    expect(await shown()).toEqual(['2026-08-03']);
  });

  it('drops the fair the morning after it finishes', async () => {
    vi.setSystemTime(new Date('2026-08-06T00:30:00Z'));
    serve(calendar(FAIR));
    expect(await shown()).toEqual([]);
  });

  // The convention mismatch, caught at the boundary rather than in the export.
  // RFC 5545 ends this fair on the 6th, exclusively; everything downstream here
  // means the last day it runs, and the export adds the day back itself.
  it('hands on the last day the event runs, not the exclusive next one', async () => {
    serve(calendar(FAIR));
    const [fair] = await fetchEvents('ical', FEED, 45);
    expect(fair.end).toBe('2026-08-05');
  });

  it('leaves a single-day all-day event no end at all', async () => {
    // A same-date end tells a student nothing, and an exclusive one would put a
    // second day in their calendar.
    serve(calendar(['UID:one@x', 'SUMMARY:Involvement Fair',
      'DTSTART;VALUE=DATE:20260803', 'DTEND;VALUE=DATE:20260804']));
    const [event] = await fetchEvents('ical', FEED, 45);
    expect(event.end).toBe('');
  });
});

// Structural, not behavioural, and that is the point: the 2026-08-03 revert
// happened because one of the three gates was changed and the other two were
// left behind. There is one window now, and this fails the moment a fourth
// copy of the old predicate appears or a call site stops using the shared one.
describe('there is only one upcoming-window rule', () => {
  it('has no hand-rolled request-time filter left in the file', () => {
    expect(ENTRY_SOURCE).not.toMatch(/Number\.isFinite\(starts\) && starts >= /);
  });

  it('routes both request-time gates through the shared window', () => {
    const calls = ENTRY_SOURCE.match(/\bstillUpcoming\(/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(3); // 1 definition + 2 gates
  });
});

// Schools that publish no feed at all. The external suite covers the adapter in
// full; these are the two properties that must never regress silently, because
// both fail in the direction of showing a student something wrong rather than
// showing them nothing.
describe('events read off a school page', () => {
  const PAGE = 'https://www.malone.edu/events/';

  const row = (events, refreshedDaysAgo = 0) => ({
    source_url: PAGE,
    refreshed_at: new Date(Date.now() - refreshedDaysAgo * 86400000).toISOString(),
    events,
  });
  const store = rows => ({
    byUrl: url => Promise.resolve(rows[url] ?? null),
    byDomain: d => Promise.resolve(rows[d] ?? null),
  });

  it('serves a stored event with the wall clock the page published', async () => {
    const events = await fetchEvents('scraped', PAGE, 45, undefined, store({
      [PAGE]: row([{ title: 'Larks Got Talent', start_date: '2026-08-22', start_time: '18:00' }]),
    }));
    expect(events).toHaveLength(1);
    expect(events[0].start).toBe('2026-08-22T18:00:00');
    expect(events[0].is_free).toBe(null);
  });

  it('refuses a row nobody has refreshed, rather than serving last term', async () => {
    const stale = store({ [PAGE]: row([{ title: 'Gone', start_date: '2026-08-22' }], SCRAPED_MAX_AGE_DAYS + 1) });
    expect(await fetchEvents('scraped', PAGE, 45, undefined, stale)).toEqual([]);
    expect(await scrapedFeedFor(stale, ['malone.edu'])).toBe(null);
  });

  it('returns nothing when no store is passed, instead of throwing', async () => {
    expect(await fetchEvents('scraped', PAGE, 45)).toEqual([]);
  });
});

// The shared per-school event cache. Every test here is about the LAYERING, not
// about speed: the stored list is the school's whole calendar, and every step
// that depends on who is asking, or on what time it is, has to keep running on
// top of it. A cache that sits one layer too high is not a slow product, it is
// a wrong one. The first student at a school would decide what every later
// student sees.
describe('one school fetched once for everybody there', () => {
  const FEED = 'https://example.edu/events.ics';
  const UNIVERSITY = {
    id: 'uni-1',
    canonical_name: 'Example University',
    events_platform: 'ical',
    events_feed_url: FEED,
    // Stamped as failing so a health record on a successful fetch is a real
    // transition and therefore a real write. recordFeedHealth writes on change
    // only, so a school already marked healthy would make every assertion below
    // about health vacuous.
    events_last_error: 'Calendar feed unavailable',
  };
  const ICAL = { platform: 'ical', feedUrl: FEED };

  const CALENDAR = calendar(
    ['UID:fair@x', 'SUMMARY:Finance Career Fair', 'DTSTART:20260805T160000Z'],
    ['UID:poetry@x', 'SUMMARY:Poetry Reading', 'DTSTART:20260807T180000Z'],
    ['UID:soon@x', 'SUMMARY:Coffee Hour', 'DTSTART:20260803T113000Z'],
  );

  let fetches;
  let realFetch;

  /** A fake entity layer, counting what the cache actually wrote. */
  function fakeBase44({ rows = [], failWrites = false } = {}) {
    const state = { rows: [...rows], creates: 0, updates: 0, healthWrites: [] };
    let nextId = 1;
    const cache = {
      filter: (query, _order, limit) => Promise.resolve(
        state.rows
          .filter(r => r.university_id === query.university_id && r.cache_key === query.cache_key)
          .slice(0, limit ?? state.rows.length),
      ),
      create: (row) => {
        if (failWrites) return Promise.reject(new Error('RLS refused the write'));
        state.creates += 1;
        const created = { id: `cache-${nextId++}`, ...row };
        state.rows.unshift(created);
        return Promise.resolve(created);
      },
      update: (id, patch) => {
        if (failWrites) return Promise.reject(new Error('RLS refused the write'));
        state.updates += 1;
        const row = state.rows.find(r => r.id === id);
        Object.assign(row, patch);
        return Promise.resolve(row);
      },
    };
    return {
      state,
      asServiceRole: {
        entities: {
          CampusEventCache: cache,
          University: {
            update: (id, patch) => {
              state.healthWrites.push({ id, patch });
              return Promise.resolve({ id, ...patch });
            },
          },
          CampusScrapedEvents: { filter: () => Promise.resolve([]) },
        },
      },
    };
  }

  /** What one student is actually shown, from a list somebody else may have fetched. */
  function shownTo(events, terms, now = Date.now()) {
    return events
      .filter(isAttendable)
      .filter(e => stillUpcoming(e.start, e.end, e.all_day, now))
      .map(e => ({ ...e, match_score: scoreEvent(e, terms) }))
      .sort((a, b) => (b.match_score - a.match_score)
        || (new Date(a.start).getTime() - new Date(b.start).getTime()))
      .map(e => e.title);
  }

  beforeEach(() => {
    fetches = 0;
    realFetch = globalThis.fetch;
    globalThis.fetch = () => {
      fetches += 1;
      return Promise.resolve(new Response(CALENDAR, { status: 200 }));
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('asks the school once and serves the second student off the stored list', async () => {
    const base44 = fakeBase44();

    const first = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(first.cached).toBe(false);
    expect(fetches).toBe(1);

    const second = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(second.cached).toBe(true);
    expect(fetches).toBe(1); // The whole point: no second outbound request.
    // Same events. Not the same order: what is stored is sorted soonest first,
    // because that is the end of the list the cap keeps. Nothing downstream
    // cares, since the caller sorts by score and then by date regardless.
    expect(second.events.map(e => e.title).sort())
      .toEqual(first.events.map(e => e.title).sort());
  });

  it('stores the school-wide list, with nothing about any student in it', async () => {
    const base44 = fakeBase44();
    await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);

    const [row] = base44.state.rows;
    expect(row.university_id).toBe('uni-1');
    expect(row.cache_key).toBe('45:1');
    expect(row.feed_url).toBe(FEED);
    expect(row.event_count).toBe(3);
    expect(row.truncated).toBe(false);
    // Not scored, not limited, and not put through the upcoming window: all
    // three events are here including the one that has already started.
    expect(row.events).toHaveLength(3);
    expect(row.events.some(e => 'match_score' in e)).toBe(false);
  });

  it('gives two students at the same school different answers off one fetch', async () => {
    const base44 = fakeBase44();

    const forFinance = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    const forWriting = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(fetches).toBe(1);

    expect(shownTo(forFinance.events, ['finance'])[0]).toBe('Finance Career Fair');
    expect(shownTo(forWriting.events, ['poetry'])[0]).toBe('Poetry Reading');
  });

  it('drops an event that has happened since the school was asked', async () => {
    const base44 = fakeBase44();
    const fresh = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(shownTo(fresh.events, [])).toContain('Coffee Hour');

    // Eighteen hours later. Still a cache hit, so nothing is re-fetched, and the
    // read-time window is the only thing standing between the student and an
    // event that ended yesterday.
    vi.setSystemTime(new Date('2026-08-04T06:00:00Z'));
    const later = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(later.cached).toBe(true);
    expect(fetches).toBe(1);
    expect(later.events.map(e => e.title)).toContain('Coffee Hour'); // still stored
    expect(shownTo(later.events, [])).not.toContain('Coffee Hour'); // never shown
  });

  it('asks the school again once the stored list is a day old', async () => {
    const base44 = fakeBase44();
    await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);

    vi.setSystemTime(new Date('2026-08-04T12:00:01Z')); // A second past 24h.
    const after = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(after.cached).toBe(false);
    expect(fetches).toBe(2);
    // Refreshed in place. A school's calendar is a current state, not a history.
    expect(base44.state.rows).toHaveLength(1);
    expect(base44.state.updates).toBe(1);
  });

  it('ignores a stored list that came from a different feed', async () => {
    // What an approved submission, or an upheld report, leaves behind. The
    // school's feed moved and the old list is nobody's answer any more.
    const base44 = fakeBase44({
      rows: [{
        id: 'cache-old',
        university_id: 'uni-1',
        cache_key: '45:1',
        feed_url: 'https://example.edu/the-library-calendar.ics',
        fetched_at: new Date().toISOString(),
        events: [{ title: 'Book Sale', start: '2026-08-06T16:00:00Z', end: '', all_day: false }],
      }],
    });

    const answer = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(answer.cached).toBe(false);
    expect(fetches).toBe(1);
    expect(answer.events.map(e => e.title)).not.toContain('Book Sale');
  });

  it('keeps windows apart, because one cannot be cut down to another', async () => {
    const base44 = fakeBase44();
    await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    await schoolEvents(base44, UNIVERSITY, ICAL, 60, 12, false);
    expect(fetches).toBe(2);
    expect(base44.state.rows.map(r => r.cache_key).sort()).toEqual(['45:1', '60:12']);
  });

  it('makes retry mean retry, and stores what it found', async () => {
    const base44 = fakeBase44();
    await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    const stampedAt = base44.state.rows[0].fetched_at;

    vi.setSystemTime(new Date('2026-08-03T12:05:00Z'));
    const retried = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, true);
    expect(retried.cached).toBe(false);
    expect(fetches).toBe(2);
    expect(base44.state.rows).toHaveLength(1);
    expect(base44.state.rows[0].fetched_at).not.toBe(stampedAt);
  });

  it('records feed health on a fetch and never off a stored list', async () => {
    const base44 = fakeBase44();

    await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(base44.state.healthWrites).toHaveLength(1);
    expect(base44.state.healthWrites[0].patch.events_last_error).toBe('');

    // A hit observed nothing. Saying the feed is fine would be inventing an
    // observation on the one surface whose job is to notice a school going
    // quiet, so it must stay at one write.
    await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(base44.state.healthWrites).toHaveLength(1);
  });

  it('still gives the student their events when the cache write fails', async () => {
    const base44 = fakeBase44({ failWrites: true });
    const answer = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(answer.cached).toBe(false);
    expect(answer.events.map(e => e.title)).toContain('Finance Career Fair');
  });

  it('treats a school that answered with nothing as a real answer', async () => {
    // Kept on purpose, so the row always says what the school last answered. A
    // calendar that empties out stops being served within one fetch instead of
    // leaving the last good list standing behind it for a day. The health
    // failure is recorded on the fetch that saw it.
    globalThis.fetch = () => {
      fetches += 1;
      return Promise.resolve(new Response(calendar(), { status: 200 }));
    };
    const base44 = fakeBase44();

    await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(base44.state.rows[0].event_count).toBe(0);
    expect(base44.state.healthWrites[0].patch.events_last_error).toBe('Returned no upcoming events');

    const again = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(again.cached).toBe(true);
    expect(again.events).toEqual([]);
    expect(fetches).toBe(1);
  });

  it('caches nothing for a school with no University row', async () => {
    // The one path where there is no key to share a list under. A per-student
    // submitted feed at a school we have never resolved lands here.
    const base44 = fakeBase44();
    await schoolEvents(base44, null, ICAL, 45, 1, false);
    await schoolEvents(base44, null, ICAL, 45, 1, false);
    expect(fetches).toBe(2);
    expect(base44.state.rows).toHaveLength(0);
  });
});

// Structural, and deliberately so. The health check asks whether a feed answers
// right now; a cache hit answers a different question and would report a school
// that died last week as healthy. It is one word away from being wrong forever.
describe('the admin feed check never reads the cache', () => {
  it('fetches the feed itself rather than going through the cached path', () => {
    const check = ENTRY_SOURCE.slice(ENTRY_SOURCE.indexOf('async function handleCheckFeeds'));
    const body = check.slice(0, check.indexOf('\n/**'));
    expect(body).toMatch(/await fetchEvents\(/);
    expect(body).not.toMatch(/schoolEvents\(/);
  });
});

describe('rendering a date', () => {
  it('pads a year below 1000 so the value still parses', () => {
    const events = parseIcsEvents(calendar([
      'UID:old@x',
      'DTSTART;VALUE=DATE:09990101',
    ]));
    expect(starts(events)).toEqual(['0999-01-01']);
    expect(Number.isNaN(new Date(events[0].start).getTime())).toBe(false);
  });
});
