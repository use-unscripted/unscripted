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
  SCRAPED_MAX_AGE_DAYS,
  parseRss1Events,
  looksLikeRss1,
  rss1Prefixes,
  rss1Date,
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

// RSS 1.0 with the event module, read off a real capture of Ohio State's feed.
//
// The fixture next door is the actual document their handler served on
// 2026-08-14, byte for byte and not tidied up. That is deliberate: every trap
// in this format is a shape a hand-written sample would quietly get right,
// starting with items sitting outside `channel`, and a green run against an
// idealised feed would prove nothing about the one a student is served.
//
// The two variants below are built by rewriting that same capture, and each
// rewrite is one edit, stated where it happens.
describe('an RSS 1.0 feed with the event module', () => {
  const FIXTURE = readFileSync(
    fileURLToPath(new URL('./fixtures/osu-activities-rss1.xml', import.meta.url)),
    'utf8',
  );
  const FEED =
    'https://activities.osu.edu/CentralCalendar/StudentLife.EventCalendar.Web.Service.RssHandler.ashx?d=9';

  let realFetch;
  function serve(xml) {
    realFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response(xml, { status: 200, headers: { 'content-type': 'text/xml' } }));
  }
  afterEach(() => {
    if (realFetch) globalThis.fetch = realFetch;
    realFetch = undefined;
  });

  it('reads every field off the first real item', () => {
    const events = parseRss1Events(FIXTURE);
    expect(events[0]).toMatchObject({
      title: 'Sunday Service',
      start: '2026-08-16T15:00:00-04:00',
      end: '2026-08-16T17:00:00-04:00',
      location: 'Union Great Hall Meeting Rm 3',
      allDay: false,
    });
    expect(events[0].url).toBe(
      'https://activities.osu.edu/Events.aspx?y=2026&mo=8&day=16&e=84107&title=sunday-service-',
    );
    expect(events[0].description).toContain('Looking for a church to call home on campus');
    expect(events[0].subjects).toEqual([
      'Food', 'Social', 'Students (Columbus Campus)', 'Students (All)',
    ]);
  });

  it('keeps the offset the feed published rather than converting it', () => {
    // Ohio State stamps a real Eastern offset, so the value is an unambiguous
    // instant. It is passed through untouched, and it still has to parse to the
    // moment the feed meant.
    const [first] = parseRss1Events(FIXTURE);
    expect(first.start.endsWith('-04:00')).toBe(true);
    expect(Date.parse(first.start)).toBe(Date.parse('2026-08-16T19:00:00Z'));
  });

  it('never dates an item from pubDate', () => {
    // Every item carries one and it is the day somebody typed the listing in.
    // The second item was written on 2026-08-13 and happens on the 18th.
    expect(parseRss1Events(FIXTURE)[1].start.slice(0, 10)).toBe('2026-08-18');
  });

  it('finds items that are siblings of channel, not children of it', () => {
    // The structural trap, pinned against the real document: `channel` holds an
    // rdf:Seq of pointers and no item elements at all, so a reader that
    // descends into it comes back with zero and reads as an empty calendar.
    const channel = FIXTURE.slice(FIXTURE.indexOf('<channel'), FIXTURE.indexOf('</channel>'));
    expect(channel).not.toMatch(/<item[\s>]/);
    expect(parseRss1Events(FIXTURE).length).toBeGreaterThan(0);
  });

  it('reads the module under whatever prefix the feed bound it to', () => {
    // Same capture, one edit: the event module is bound to "evt" instead of
    // "ev". A prefix is a local choice, so this feed is exactly as valid and
    // has to read identically.
    const renamed = FIXTURE
      .replace('xmlns:ev="http://purl.org/rss/1.0/modules/event/"',
        'xmlns:evt="http://purl.org/rss/1.0/modules/event/"')
      .replace(/<(\/?)ev:/g, '<$1evt:');
    expect(rss1Prefixes(renamed, 'http://purl.org/rss/1.0/modules/event/')).toEqual(['evt']);
    expect(parseRss1Events(renamed)).toEqual(parseRss1Events(FIXTURE));
  });

  it('refuses a document that never declares the event module', () => {
    // Without the module there are no event dates in the document, only the
    // dates a listing was written. A school's news feed must not read as its
    // calendar, so this returns nothing rather than reaching for pubDate.
    const stripped = FIXTURE
      .replace('xmlns:ev="http://purl.org/rss/1.0/modules/event/"', '')
      .replace(/<(\/?)ev:/g, '<$1x:');
    expect(parseRss1Events(stripped)).toEqual([]);
    expect(looksLikeRss1(stripped)).toBe(false);
    expect(looksLikeRss1('<rss version="2.0"><channel><item><title>News</title>' +
      '<pubDate>Wed, 13 Aug 2026 20:36:53 -0400</pubDate></item></channel></rss>')).toBe(false);
  });

  it('keeps an item whose end date is missing', () => {
    // Same capture, one edit: the first item loses its end. An end is the least
    // trustworthy field in every feed here, so its absence empties that one
    // field and changes nothing else.
    const noEnd = FIXTURE.replace(/\s*<ev:enddate>[^<]*<\/ev:enddate>/, '');
    const events = parseRss1Events(noEnd);
    expect(events).toHaveLength(50);
    expect(events[0].end).toBe('');
    expect(events[0].start).toBe('2026-08-16T15:00:00-04:00');
    expect(events[0].title).toBe('Sunday Service');
    expect(events.slice(1)).toEqual(parseRss1Events(FIXTURE).slice(1));
  });

  it('returns all 50 the feed will hand over, and the 50 is theirs not ours', () => {
    // Measured on 2026-08-14: the handler answers with exactly 50 items and no
    // parameter moves it, d=1 through d=365 alike. So the cap belongs to Ohio
    // State, and nothing here may add a second one on top of it.
    expect(FIXTURE.match(/<item[\s>]/g)).toHaveLength(50);
    expect(parseRss1Events(FIXTURE)).toHaveLength(50);

    const extra = FIXTURE.replace(
      '</rdf:RDF>',
      `<item rdf:about="https://activities.osu.edu/Events.aspx?e=99999">
    <title>One More</title>
    <link>https://activities.osu.edu/Events.aspx?e=99999</link>
    <ev:startdate>2026-10-05T15:00:00-04:00</ev:startdate>
  </item>
</rdf:RDF>`,
    );
    expect(parseRss1Events(extra)).toHaveLength(51);
  });

  it('reads a bare day as a whole day rather than stamping a clock on it', () => {
    expect(rss1Date('2026-08-16')).toEqual({ value: '2026-08-16', allDay: true });
    // A value with no offset is campus wall-clock and stays that way.
    expect(rss1Date('2026-08-16 15:00:00')).toEqual({
      value: '2026-08-16T15:00:00', allDay: false,
    });
    expect(rss1Date('2026-08-16T15:00:00+0400')).toEqual({
      value: '2026-08-16T15:00:00+04:00', allDay: false,
    });
    expect(rss1Date('next Tuesday')).toEqual({ value: '', allDay: false });
  });

  it('reaches a student through the registered adapter', async () => {
    // The whole path a resolved row takes: adapterFor('rss1'), its own fetch,
    // its own normalize, then the request-time gate. Registration is what this
    // proves, and an unregistered adapter throws here rather than failing quiet.
    serve(FIXTURE);
    const events = await fetchEvents('rss1', FEED, 90);
    expect(events).toHaveLength(50);
    expect(events[0]).toMatchObject({
      title: 'Sunday Service',
      start: '2026-08-16T15:00:00-04:00',
      location: 'Union Great Hall Meeting Rm 3',
      all_day: false,
      is_free: null,
    });
    expect(events[0].keywords).toContain('Social');
    expect(events.filter(e => stillUpcoming(e.start, e.end, e.all_day, Date.now())))
      .toHaveLength(50);
  });

  it('says so when a feed answers with something that is not RSS 1.0', async () => {
    serve('<html><body>Page Not Found</body></html>');
    await expect(fetchEvents('rss1', FEED, 90)).rejects.toThrow('unexpected shape');
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
