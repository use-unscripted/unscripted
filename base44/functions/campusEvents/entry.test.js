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
    // Six hours behind the clock every test here runs on, which puts it well
    // past the hour of grace a timed event gets. It is in the feed because an
    // .ics file has no lower bound at all, and it is here because a fixture
    // where everything is upcoming cannot tell a stored list that skipped the
    // window filter from one that ran it.
    ['UID:breakfast@x', 'SUMMARY:Breakfast Social', 'DTSTART:20260803T060000Z'],
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
    expect(row.event_count).toBe(4);
    expect(row.truncated).toBe(false);
    // Not scored, not limited, and not put through the upcoming window.
    expect(row.events).toHaveLength(4);
    expect(row.events.some(e => 'match_score' in e)).toBe(false);

    // The window filter specifically, and it has to be an event the filter
    // would REALLY have thrown out. Breakfast Social is six hours behind the
    // clock, so it is stored and it is not shown. An event only half an hour
    // past would prove nothing: it survives that filter anyway, and this test
    // would go green with the window moved above the cache.
    const stored = row.events.map(e => e.title);
    expect(stored).toContain('Breakfast Social');
    expect(shownTo(row.events, [])).not.toContain('Breakfast Social');
    expect(shownTo(row.events, [])).toHaveLength(3);
  });

  it('gives two students at the same school different answers off one fetch', async () => {
    const base44 = fakeBase44();

    // The first student at this school. Their whole request runs: the school is
    // fetched, then their terms rank it and their limit cuts it to one event.
    const first = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(shownTo(first.events, ['finance']).slice(0, 1)).toEqual(['Finance Career Fair']);

    // None of that reached the row. This is the assertion the whole design
    // rests on: if scoring, the limit or the window had been applied before the
    // write, the row would hold one scored event and every later student at
    // this school would be served a list built for somebody else.
    const [row] = base44.state.rows;
    expect(row.events).toHaveLength(4);
    expect(row.events.some(e => 'match_score' in e)).toBe(false);
    expect(row.events.map(e => e.title)).toContain('Poetry Reading');

    // The second student, off the stored list, gets the event the first
    // student's ranking and limit had already thrown away.
    const second = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(second.cached).toBe(true);
    expect(fetches).toBe(1);
    expect(second.events.some(e => 'match_score' in e)).toBe(false);
    expect(shownTo(second.events, ['poetry']).slice(0, 1)).toEqual(['Poetry Reading']);
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

  it('writes an empty answer but never serves one back', async () => {
    // Written on purpose, so the row always says what the school last answered
    // and a calendar that empties out stops being served last week's list
    // within one fetch. Not READ back on purpose either, and the two are not in
    // conflict: empty is also what a feed says when something transient is
    // wrong with it, and nothing here can tell those apart. Serving it would
    // take one unlucky request and hand it to the whole school for a day.
    globalThis.fetch = () => {
      fetches += 1;
      return Promise.resolve(new Response(calendar(), { status: 200 }));
    };
    const base44 = fakeBase44();

    await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(base44.state.rows[0].event_count).toBe(0);
    expect(base44.state.healthWrites[0].patch.events_last_error).toBe('Returned no upcoming events');

    const again = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(again.cached).toBe(false);
    expect(again.events).toEqual([]);
    expect(fetches).toBe(2);
  });

  it('lets a good list replace an empty one without waiting out the day', async () => {
    // The other half of the same rule. A school that answered with nothing at
    // 9am is asked again at 9.01, and the events it has by then are stored and
    // shared, rather than the school being written off until tomorrow.
    globalThis.fetch = () => {
      fetches += 1;
      return Promise.resolve(new Response(calendar(), { status: 200 }));
    };
    const base44 = fakeBase44();
    await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(base44.state.rows[0].event_count).toBe(0);

    globalThis.fetch = () => {
      fetches += 1;
      return Promise.resolve(new Response(CALENDAR, { status: 200 }));
    };
    const recovered = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
    expect(recovered.events.map(e => e.title)).toContain('Finance Career Fair');
    expect(base44.state.rows).toHaveLength(1);
    expect(base44.state.rows[0].event_count).toBe(4);
  });

  it('never stores a feed one student pasted in that nobody has approved', async () => {
    // `resolveFeed` hands back a still-pending submission as the feed while
    // still handing back the school's University row: the submitter is served
    // their own link immediately, everybody else keeps the school's. Storing
    // that under the school's id would put one student's unapproved calendar
    // into the row the whole school reads, and at a school with a pending
    // submission the row would thrash between two feeds and never hold.
    const base44 = fakeBase44();
    const submitted = { platform: 'ical', feedUrl: FEED, submitted: true };

    const answer = await schoolEvents(base44, UNIVERSITY, submitted, 45, 1, false);
    expect(answer.events.map(e => e.title)).toContain('Finance Career Fair');
    expect(base44.state.rows).toHaveLength(0);

    await schoolEvents(base44, UNIVERSITY, submitted, 45, 1, false);
    expect(fetches).toBe(2);
    expect(base44.state.rows).toHaveLength(0);
  });

  it('keys a row on whole numbers, so no request can mint one of its own', async () => {
    // Both values arrive off the wire. `days` is clamped by the handler but not
    // floored, and `seriesDates` is only clamped inside the recurrence
    // expansion, so unrounded ones used to read as ordinary requests and get a
    // row each. A signed-in student could have filled this entity with
    // quarter-megabyte rows that nothing deletes.
    const base44 = fakeBase44();
    await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);

    const odd = await schoolEvents(base44, UNIVERSITY, ICAL, 45.0001, 1.5, false);
    expect(odd.cached).toBe(true);
    expect(fetches).toBe(1);
    expect(base44.state.rows).toHaveLength(1);
    expect(base44.state.rows[0].cache_key).toBe('45:1');

    // And the clamps still hold at both ends.
    await schoolEvents(base44, UNIVERSITY, ICAL, 9999, 9999, false);
    expect(base44.state.rows.map(r => r.cache_key).sort()).toEqual(['120:12', '45:1']);
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

  // The 400 cap, on a list big enough for it to bite. It shipped taking the
  // WRONG END: the list was sorted by date ascending and cut at 400, and since
  // nothing in fetchEvents has a lower bound, an .ics feed answers with the
  // school's entire published past. On four real feeds event 400 by date was
  // years ago, so the row held nothing but history and the second student at
  // those schools was served zero events where the first was served 7 to 20.
  //
  // Measured on the real feeds it hit, with a 60 day window:
  //
  //   lagrange.edu  1064 events  20 live  0 cached
  //   geneva.edu     786 events   7 live  0 cached
  //   anoka.tech     775 events  15 live  0 cached
  //   a Google feed  690 events  10 live  0 cached
  //
  // The fixture above has three events and asserted `truncated` false, so none
  // of that was visible. These are the tests that would have caught it.
  describe('the cap keeps the events a student can still go to', () => {
    /** An ICS stamp: 20260803T120000Z. */
    function stamp(ms) {
      return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    }

    const NOON = Date.parse('2026-08-03T12:00:00Z');

    /**
     * A feed with real history in it, which is what a school's .ics actually
     * looks like. Past events run backwards from three days ago, upcoming ones
     * forwards from now, both on a fixed gap so the expected order is known.
     */
    function bulkCalendar({ past = 0, upcoming = 0, gapHours = 3, extra = [] } = {}) {
      const vevents = [];
      for (let i = 0; i < past; i++) {
        vevents.push([
          `UID:past-${i}@x`,
          `SUMMARY:Past ${String(i).padStart(3, '0')}`,
          `DTSTART:${stamp(NOON - (72 + i * gapHours) * 3600000)}`,
        ]);
      }
      for (let i = 0; i < upcoming; i++) {
        vevents.push([
          `UID:up-${i}@x`,
          `SUMMARY:Upcoming ${String(i).padStart(3, '0')}`,
          `DTSTART:${stamp(NOON + (i + 1) * gapHours * 3600000)}`,
        ]);
      }
      return calendar(...vevents, ...extra);
    }

    function serveBulk(options) {
      const ics = bulkCalendar(options);
      globalThis.fetch = () => {
        fetches += 1;
        return Promise.resolve(new Response(ics, { status: 200 }));
      };
    }

    it('drops the school\'s history rather than its future', async () => {
      // 900 events behind us, 250 ahead. Sorted by date and cut at 400 this
      // used to store 400 events from last spring and nothing else.
      serveBulk({ past: 900, upcoming: 250 });
      const base44 = fakeBase44();

      const answer = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
      const [row] = base44.state.rows;

      expect(answer.events.length).toBe(1150); // The whole feed, history and all.
      expect(row.event_count).toBe(250);
      expect(row.events.map(e => e.title).some(t => t.startsWith('Past'))).toBe(false);
      expect(row.events[0].title).toBe('Upcoming 000');
      expect(row.events[249].title).toBe('Upcoming 249');

      // Nothing fitted through the cap and got dropped, so this is not a
      // truncation and must not be logged as one.
      expect(row.truncated).toBe(false);
    });

    it('never drops an event the student would still have been shown', async () => {
      // The property that matters, stated as a property: what a second student
      // is shown off the stored list is exactly what the first student was
      // shown off the live one. If the cap could ever reach an event the
      // read-time window keeps, these two lists differ.
      serveBulk({ past: 900, upcoming: 250, extra: [[
        // The awkward case the coarse floor exists for. A month-long
        // exhibition that opened three weeks ago is still running, so the
        // window keeps it, and its START is far behind the floor. Anything
        // that looked at the start alone would delete it from every stored
        // list at every school with a long-running exhibition.
        'UID:exhibition@x',
        'SUMMARY:Long Exhibition',
        'DTSTART;VALUE=DATE:20260714',
        'DTEND;VALUE=DATE:20260814',
      ]] });
      const base44 = fakeBase44();

      const live = await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
      const [row] = base44.state.rows;

      expect(shownTo(row.events, [])).toEqual(shownTo(live.events, []));
      expect(row.events.map(e => e.title)).toContain('Long Exhibition');
      expect(shownTo(row.events, [])).toContain('Long Exhibition');
    });

    it('cuts the far end when there genuinely are more than 400 to come', async () => {
      // 600 events still ahead of the student. The cap has to bite somewhere,
      // and the events it gives up are the LAST ones, which come back into
      // range as the window advances.
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        serveBulk({ past: 200, upcoming: 600, gapHours: 1.5 });
        const base44 = fakeBase44();

        await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);
        const [row] = base44.state.rows;

        expect(row.event_count).toBe(400);
        expect(row.truncated).toBe(true);
        expect(row.events[0].title).toBe('Upcoming 000');
        expect(row.events[399].title).toBe('Upcoming 399');
        expect(row.events.map(e => e.title).some(t => t.startsWith('Past'))).toBe(false);

        // Named in the log, not counted silently, so a cap that starts reaching
        // ordinary schools is something somebody can see.
        const line = logged.mock.calls.find(c => c[0] === '[campusEvents] event cache truncated');
        expect(line).toBeTruthy();
        expect(line[1]).toMatchObject({ college: 'Example University', kept: 400, of: 600 });
      } finally {
        logged.mockRestore();
      }
    });

    it('does not call a feed truncated for having a past', async () => {
      // 900 events dropped, and the flag stays false, because a reader loses
      // nothing: the same request's window filter refuses every one of them.
      // Counting history as truncation would have this fire forever on the
      // large .ics schools and mean nothing on the day the cap really bit.
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        serveBulk({ past: 900, upcoming: 10 });
        const base44 = fakeBase44();
        await schoolEvents(base44, UNIVERSITY, ICAL, 45, 1, false);

        expect(base44.state.rows[0].truncated).toBe(false);
        expect(logged.mock.calls.some(c => c[0] === '[campusEvents] event cache truncated')).toBe(false);
      } finally {
        logged.mockRestore();
      }
    });
  });
});

// Structural, and deliberately so. The health check asks whether a feed answers
// right now; a cache hit answers a different question and would report a school
// that died last week as healthy. It is one word away from being wrong forever.
describe('the admin feed check never reads the cache', () => {
  it('fetches the feed itself rather than going through the cached path', () => {
    const check = ENTRY_SOURCE.slice(ENTRY_SOURCE.indexOf('async function handleCheckFeeds'));
    const body = check.slice(0, check.indexOf('\n/**'));
    // Comments stripped before matching, because they are the part of this
    // function most likely to be reworded and the least able to call anything.
    // Left in, the comment already sitting there explaining WHY this must not
    // use the cached path is one edit away from failing the test that enforces
    // it, which teaches whoever hits that to delete the assertion.
    const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).toMatch(/await\s+fetchEvents\s*\(/);
    expect(code).not.toMatch(/schoolEvents\s*\(/);
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
