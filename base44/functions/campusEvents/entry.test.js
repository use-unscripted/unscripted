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
 * holds the two behaviours added since they were written, plus a check that the
 * module still loads at all.
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

const { parseIcsEvents } = await loadEntry();

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
  // KNOWN GAP, deliberately pinned as-is: a weekly all-day series answers with
  // NEXT week's date on the very day it is happening. A bare day parses back as
  // its own UTC midnight, which is below the "an hour ago" floor from 01:00 UTC.
  //
  // Lowering that floor alone was tried on 2026-08-03 and reverted the same day.
  // It made things worse, measured against all 38 real school feeds: 5 upcoming
  // listings lost across 28 days, nothing gained on any day. The request-time
  // filters discard the date the expansion starts producing, and the series
  // spends its only slot on it. See the long comment on `earliest` in entry.ts.
  //
  // Closing this properly means making those filters all-day-aware in the same
  // change. Until then this test pins today's real behaviour so nobody "fixes"
  // half of it again and believes a green unit test.
  it('answers with next week on a day it is actually happening', () => {
    const events = parseIcsEvents(calendar([
      'UID:allday@x',
      'DTSTART;VALUE=DATE:20260727',
      'RRULE:FREQ=WEEKLY',
    ]));
    expect(starts(events)).toEqual(['2026-08-10']);
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
    // The counterpart to the gap above: a timed value carries a real clock, so
    // it sits above the floor and today's meeting is offered as today's.
    const events = parseIcsEvents(calendar([
      'UID:timed@x',
      'DTSTART;TZID=America/New_York:20260727T170000',
      'RRULE:FREQ=WEEKLY',
    ]));
    expect(starts(events)).toEqual(['2026-08-03T17:00:00']);
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
