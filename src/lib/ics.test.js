import { describe, expect, it } from 'vitest';

import {
  addICSDays,
  buildICS,
  calendarTaskEvent,
  countICSEvents,
  escapeICSText,
  foldICSLine,
  icsDate,
  icsDateTime,
  missionEvent,
} from './ics';

/** Shaped like a real CalendarTasks row (see the entity schema). */
function task(overrides = {}) {
  return {
    id: 'task-1',
    user_id: 'u1',
    title: 'Coffee chat',
    description: 'Prep three questions',
    date: '2026-08-05',
    start_time: '09:00',
    end_time: '10:00',
    status: 'planned',
    ...overrides,
  };
}

/** Shaped like a real Missions row. */
function mission(overrides = {}) {
  return {
    id: 'mission-1',
    user_id: 'u1',
    experiment_id: 'exp-1',
    title: 'Ship the thing',
    objective: 'Do the objective',
    deadline: '2026-08-07',
    status: 'planned',
    deletion_status: 'active',
    ...overrides,
  };
}

/** Every line of a well-formed .ics, with the folding undone. */
function unfold(text) {
  return text.replace(/\r\n[ \t]/g, '').split('\r\n');
}

describe('the bug: a non-empty export must produce a calendar, not throw', () => {
  // The panel built its lines with `lines.push(...).filter(Boolean)`. push()
  // returns a number, so this threw a TypeError the moment there was one row to
  // export — the handler caught it and showed "Could not export…" with no file.
  it('builds a calendar from one task without throwing', () => {
    const ics = buildICS([calendarTaskEvent(task())]);
    expect(countICSEvents(ics)).toBe(1);
  });

  it('builds a calendar from many tasks and missions without throwing', () => {
    const events = [
      calendarTaskEvent(task({ id: 'a' })),
      calendarTaskEvent(task({ id: 'b', description: '' })),
      missionEvent(mission({ id: 'c' })),
    ];
    const ics = buildICS(events);
    expect(countICSEvents(ics)).toBe(3);
  });

  it('reports zero events for an empty calendar so callers can refuse to download it', () => {
    expect(countICSEvents(buildICS([]))).toBe(0);
  });
});

describe('buildICS: RFC 5545 structure', () => {
  const ics = buildICS([calendarTaskEvent(task())], { calendarName: 'Unscripted', timezone: 'America/New_York' });

  it('produces the exact calendar for a single timed task', () => {
    // DTSTAMP is the only value that moves, so it is matched separately.
    const lines = unfold(ics);
    const dtstamp = lines.find(l => l.startsWith('DTSTAMP:'));
    expect(dtstamp).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);

    expect(lines.filter(l => !l.startsWith('DTSTAMP:'))).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Unscripted//Calendar Export//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Unscripted',
      'X-WR-TIMEZONE:America/New_York',
      'BEGIN:VEVENT',
      'UID:task-1-unscripted@app',
      'DTSTART:20260805T090000',
      'DTEND:20260805T100000',
      'SUMMARY:Coffee chat',
      'DESCRIPTION:Prep three questions',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
  });

  it('uses CRLF line breaks and never a bare LF', () => {
    expect(ics).toContain('\r\n');
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('opens and closes VCALENDAR exactly once', () => {
    expect((ics.match(/BEGIN:VCALENDAR/g) || []).length).toBe(1);
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
  });

  it('pairs every BEGIN with an END', () => {
    for (const block of ['VCALENDAR', 'VEVENT']) {
      expect((ics.match(new RegExp(`BEGIN:${block}`, 'g')) || []).length)
        .toBe((ics.match(new RegExp(`END:${block}`, 'g')) || []).length);
    }
  });

  it('carries the required calendar properties', () => {
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//Unscripted//Calendar Export//EN');
  });

  it('gives every event a UID, a DTSTAMP and a DTSTART', () => {
    const body = buildICS([calendarTaskEvent(task()), missionEvent(mission())]);
    const blocks = body.split('BEGIN:VEVENT').slice(1);
    expect(blocks).toHaveLength(2);
    for (const b of blocks) {
      expect(b).toMatch(/\r\nUID:/);
      expect(b).toMatch(/\r\nDTSTAMP:/);
      expect(b).toMatch(/\r\nDTSTART/);
    }
  });

  it('writes a VALARM only when a reminder was asked for', () => {
    const withAlarm = buildICS([{ ...calendarTaskEvent(task()), reminderMinutes: 15 }]);
    expect(withAlarm).toContain('BEGIN:VALARM');
    expect(withAlarm).toContain('TRIGGER:-PT15M');
    expect(withAlarm).toContain('END:VALARM');
    expect(buildICS([calendarTaskEvent(task())])).not.toContain('VALARM');
  });

  it('writes a zero trigger for "at start time"', () => {
    expect(buildICS([{ ...calendarTaskEvent(task()), reminderMinutes: 0 }])).toContain('TRIGGER:PT0S');
  });
});

describe('all-day events: the exclusive DTEND', () => {
  // Regression: the panel computed the end date with `new Date('2026-08-07')`
  // (parsed as UTC midnight) and then read it back with local getters. In
  // America/New_York that is Aug 6 at 20:00, so +1 day landed back on Aug 7 and
  // DTEND equalled DTSTART — a zero-length all-day event that calendar apps drop.
  // vitest pins TZ=America/New_York, so this test fails on the old math.
  it('ends an all-day mission on the day after its deadline', () => {
    const ics = buildICS([missionEvent(mission({ deadline: '2026-08-07' }))]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260807');
    expect(ics).toContain('DTEND;VALUE=DATE:20260808');
  });

  it('ends an all-day task on the day after its date', () => {
    const ics = buildICS([calendarTaskEvent(task({ start_time: '', end_time: '' }))]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260805');
    expect(ics).toContain('DTEND;VALUE=DATE:20260806');
  });

  it('rolls over month and year boundaries', () => {
    expect(addICSDays('20261231', 1)).toBe('20270101');
    expect(addICSDays('20260228', 1)).toBe('20260301');
    expect(addICSDays('20240228', 1)).toBe('20240229'); // leap year
  });

  it('does not shift a date across a daylight-saving boundary', () => {
    // 2026-11-01 is the US fall-back date; naive local date math loses an hour here.
    expect(addICSDays('20261101', 1)).toBe('20261102');
    expect(addICSDays('20260308', 1)).toBe('20260309'); // spring forward
  });
});

describe('escaping', () => {
  it('escapes the characters RFC 5545 reserves in TEXT values', () => {
    expect(escapeICSText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d');
  });

  it('turns every flavour of line break into the \\n escape, leaving no raw CR', () => {
    // Regression: the old escaper only replaced \n, so a CRLF in a description
    // left a raw CR inside the line and split the record for strict parsers.
    const escaped = escapeICSText('one\r\ntwo\rthree\nfour');
    expect(escaped).toBe('one\\ntwo\\nthree\\nfour');
    expect(escaped).not.toMatch(/[\r\n]/);
  });

  it('keeps a multi-line description on one logical line in the output', () => {
    const ics = buildICS([calendarTaskEvent(task({ description: 'first\r\nsecond' }))]);
    expect(unfold(ics)).toContain('DESCRIPTION:first\\nsecond');
  });

  it('treats null and undefined as empty', () => {
    expect(escapeICSText(null)).toBe('');
    expect(escapeICSText(undefined)).toBe('');
  });
});

describe('line folding (RFC 5545 section 3.1)', () => {
  const octets = s => new TextEncoder().encode(s).length;

  it('keeps every physical line at or under 75 octets', () => {
    const long = 'Reach out to the alumni analyst and ask what the first two years on the desk '
      + 'actually look like, then write up what you heard in the outreach tracker.';
    const ics = buildICS([missionEvent(mission({ objective: long, title: long }))]);
    for (const line of ics.split('\r\n')) {
      expect(octets(line)).toBeLessThanOrEqual(75);
    }
  });

  it('unfolds back to the original value', () => {
    const long = 'x'.repeat(200);
    const ics = buildICS([calendarTaskEvent(task({ description: long }))]);
    expect(unfold(ics)).toContain(`DESCRIPTION:${long}`);
  });

  it('starts every continuation line with a single space', () => {
    const ics = buildICS([calendarTaskEvent(task({ description: 'y'.repeat(200) }))]);
    const continuations = ics.split('\r\n').filter(l => l.startsWith(' '));
    expect(continuations.length).toBeGreaterThan(0);
    for (const l of continuations) expect(l.startsWith('  ')).toBe(false);
  });

  it('never splits a multi-byte character', () => {
    const folded = foldICSLine(`DESCRIPTION:${'é'.repeat(120)}`);
    for (const line of folded.split('\r\n')) {
      expect(octets(line)).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'é'.repeat(120)}`);
  });

  it('leaves a short line alone', () => {
    expect(foldICSLine('SUMMARY:Coffee chat')).toBe('SUMMARY:Coffee chat');
  });
});

describe('date and time conversion', () => {
  it('converts a date-only value', () => {
    expect(icsDate('2026-08-05')).toBe('20260805');
  });

  it('converts a date and time to a floating local stamp', () => {
    expect(icsDateTime('2026-08-05', '09:00')).toBe('20260805T090000');
    expect(icsDateTime('2026-08-05', '09:30:45')).toBe('20260805T093045');
  });

  it('returns null for junk instead of an invalid stamp', () => {
    expect(icsDate('')).toBeNull();
    expect(icsDate('not a date')).toBeNull();
    expect(icsDate(null)).toBeNull();
    expect(icsDateTime('2026-08-05', 'nonsense')).toBeNull();
  });
});

describe('entity mapping', () => {
  it('maps a timed task to a timed event', () => {
    expect(calendarTaskEvent(task())).toMatchObject({
      uid: 'task-1-unscripted@app',
      summary: 'Coffee chat',
      start: '20260805T090000',
      end: '20260805T100000',
      allDay: false,
    });
  });

  it('maps a task with no start time to an all-day event', () => {
    expect(calendarTaskEvent(task({ start_time: null, end_time: null }))).toMatchObject({
      start: '20260805',
      allDay: true,
    });
  });

  it('falls back to the start time when a task has no end time', () => {
    expect(calendarTaskEvent(task({ end_time: null })).end).toBe('20260805T090000');
  });

  it('prefixes a mission summary so it reads as a mission in the calendar', () => {
    expect(missionEvent(mission()).summary).toBe('[Mission] Ship the thing');
  });

  it('drops rows that have no usable date', () => {
    expect(calendarTaskEvent(task({ date: null }))).toBeNull();
    expect(missionEvent(mission({ deadline: null }))).toBeNull();
  });

  it('ignores nulls from the mappers when building', () => {
    const ics = buildICS([calendarTaskEvent(task({ date: null })), calendarTaskEvent(task())]);
    expect(countICSEvents(ics)).toBe(1);
  });
});
