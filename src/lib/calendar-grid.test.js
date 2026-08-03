/**
 * The tests that matter here are the timezone ones.
 *
 * vitest.config.js pins TZ to America/New_York on purpose: west of UTC is where
 * a date-only calendar value lands on the wrong day, and every one of these
 * would pass on a UTC box while the feature was broken for every student.
 */

import { describe, it, expect, vi } from 'vitest';

/**
 * Nothing here calls the API. The mock is only because day placement imports
 * the shared date parser out of campus-events.js, which pulls the Base44 client
 * in behind it — and that client reads `window` at import time. Same shape as
 * campus-events.test.js next door.
 */
vi.mock('@/api/base44Client', () => ({
  base44: {
    functions: { invoke: vi.fn() },
    integrations: { Core: { InvokeLLM: vi.fn() } },
  },
}));

import {
  dayKey,
  eventDayKey,
  groupEventsByDay,
  monthMatrix,
  addMonths,
  isSameMonth,
  monthLabel,
  formatEventTime,
  eventMonthRange,
  upcomingEvents,
  WEEKDAY_LABELS,
} from './calendar-grid';

const event = (start, extra = {}) => ({ id: start, title: start, start, ...extra });

describe('dayKey', () => {
  it('reads the local calendar day, not the UTC one', () => {
    // 8pm in New York is already the 15th in UTC. The student is not in UTC.
    expect(dayKey(new Date(2026, 9, 14, 20, 0))).toBe('2026-10-14');
  });

  it('pads single-digit months and days', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('is empty for anything that is not a usable date', () => {
    expect(dayKey(new Date('nonsense'))).toBe('');
    expect(dayKey(null)).toBe('');
    expect(dayKey('2026-10-14')).toBe('');
    expect(dayKey(undefined)).toBe('');
  });
});

describe('eventDayKey', () => {
  /**
   * The bug this feature already shipped once and caught with a test: an
   * all-day event carries a date with no time, `new Date()` reads it as UTC
   * midnight, and every student in the US sees it a day early.
   */
  it('keeps an all-day event on its own date', () => {
    expect(eventDayKey(event('2026-10-14', { all_day: true }))).toBe('2026-10-14');
  });

  it('files a timestamped event by its local day', () => {
    expect(eventDayKey(event('2026-10-14T19:00:00-04:00'))).toBe('2026-10-14');
  });

  it('respects the offset the feed sent, rather than assuming ours', () => {
    // Midnight UTC on the 15th is still the evening of the 14th in New York.
    expect(eventDayKey(event('2026-10-15T00:00:00Z'))).toBe('2026-10-14');
  });

  it('is empty when the feed gave us no date at all', () => {
    expect(eventDayKey(event(''))).toBe('');
    expect(eventDayKey({})).toBe('');
    expect(eventDayKey(null)).toBe('');
  });
});

describe('groupEventsByDay', () => {
  it('buckets events under their own day', () => {
    const grouped = groupEventsByDay([
      event('2026-10-14T19:00:00-04:00'),
      event('2026-10-15T10:00:00-04:00'),
      event('2026-10-14T09:00:00-04:00'),
    ]);

    expect([...grouped.keys()].sort()).toEqual(['2026-10-14', '2026-10-15']);
    expect(grouped.get('2026-10-14')).toHaveLength(2);
  });

  it('puts all-day events above timed ones', () => {
    const grouped = groupEventsByDay([
      event('2026-10-14T09:00:00-04:00'),
      event('2026-10-14', { all_day: true }),
    ]);

    expect(grouped.get('2026-10-14').map(e => e.all_day)).toEqual([true, undefined]);
  });

  it('orders timed events by their start', () => {
    const grouped = groupEventsByDay([
      event('2026-10-14T17:00:00-04:00'),
      event('2026-10-14T09:00:00-04:00'),
      event('2026-10-14T12:30:00-04:00'),
    ]);

    expect(grouped.get('2026-10-14').map(e => e.start)).toEqual([
      '2026-10-14T09:00:00-04:00',
      '2026-10-14T12:30:00-04:00',
      '2026-10-14T17:00:00-04:00',
    ]);
  });

  it('breaks a tie on title so the order does not shuffle between renders', () => {
    const grouped = groupEventsByDay([
      { id: 'b', title: 'Resume Lab', start: '2026-10-14T17:00:00-04:00' },
      { id: 'a', title: 'Alumni Panel', start: '2026-10-14T17:00:00-04:00' },
    ]);

    expect(grouped.get('2026-10-14').map(e => e.title)).toEqual(['Alumni Panel', 'Resume Lab']);
  });

  it('drops undated events rather than collecting them under a blank key', () => {
    const grouped = groupEventsByDay([event(''), event('2026-10-14T19:00:00-04:00')]);

    expect([...grouped.keys()]).toEqual(['2026-10-14']);
  });

  it('survives junk input', () => {
    expect(groupEventsByDay(null).size).toBe(0);
    expect(groupEventsByDay(undefined).size).toBe(0);
    expect(groupEventsByDay([]).size).toBe(0);
  });
});

describe('monthMatrix', () => {
  it('starts every week on Sunday', () => {
    const weeks = monthMatrix(new Date(2026, 9, 1));
    for (const week of weeks) {
      expect(week).toHaveLength(7);
      expect(week[0].date.getDay()).toBe(0);
    }
  });

  it('pads the first week with the tail of the previous month', () => {
    // Oct 1 2026 is a Thursday, so the row opens on Sep 27.
    const [firstWeek] = monthMatrix(new Date(2026, 9, 1));

    expect(firstWeek[0].key).toBe('2026-09-27');
    expect(firstWeek[0].inMonth).toBe(false);
    expect(firstWeek[4].key).toBe('2026-10-01');
    expect(firstWeek[4].inMonth).toBe(true);
  });

  it('uses six rows only when the month actually needs them', () => {
    // Aug 2026 starts on a Saturday and runs 31 days — 1 + 31 spills to a sixth row.
    expect(monthMatrix(new Date(2026, 7, 1))).toHaveLength(6);
    // Oct 2026: 4 lead-in days + 31 = 35, exactly five rows.
    expect(monthMatrix(new Date(2026, 9, 1))).toHaveLength(5);
  });

  it('renders a February that fits its rows exactly', () => {
    // Feb 2026 starts on a Sunday and has 28 days: four clean weeks, no padding.
    const weeks = monthMatrix(new Date(2026, 1, 1));

    expect(weeks).toHaveLength(4);
    expect(weeks.every(week => week.every(day => day.inMonth))).toBe(true);
  });

  it('counts the extra day in a leap February', () => {
    const days = monthMatrix(new Date(2028, 1, 1)).flat().filter(d => d.inMonth);

    expect(days).toHaveLength(29);
    expect(days.at(-1).key).toBe('2028-02-29');
  });

  it('marks today, and only today', () => {
    const weeks = monthMatrix(new Date(2026, 9, 1), { today: new Date(2026, 9, 14) });
    const flagged = weeks.flat().filter(day => day.isToday);

    expect(flagged).toHaveLength(1);
    expect(flagged[0].key).toBe('2026-10-14');
  });

  it('marks nothing when today is in another month', () => {
    const weeks = monthMatrix(new Date(2026, 9, 1), { today: new Date(2026, 10, 3) });

    expect(weeks.flat().some(day => day.isToday)).toBe(false);
  });

  it('does not mark a padding day that shares a number with today', () => {
    // Nov 1 2026 is a Sunday, so October's grid does not run into November at
    // all — but December's grid opens on Nov 29. Today = Nov 29 must light up
    // in November's grid and stay dark in December's.
    const december = monthMatrix(new Date(2026, 11, 1), { today: new Date(2026, 10, 29) });
    const padded = december.flat().find(day => day.key === '2026-11-29');

    expect(padded.inMonth).toBe(false);
    expect(padded.isToday).toBe(true);
  });

  it('crosses a year boundary without losing days', () => {
    const days = monthMatrix(new Date(2026, 11, 1)).flat();

    expect(days.filter(d => d.inMonth)).toHaveLength(31);
    expect(days.at(-1).date.getFullYear()).toBe(2027);
  });

  it('spans a daylight-saving change without dropping or repeating a day', () => {
    // US clocks go back on Nov 1 2026. Naive millisecond arithmetic produces
    // two Nov 1s here; calendar arithmetic produces one.
    const keys = monthMatrix(new Date(2026, 10, 1)).flat().map(d => d.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter(k => k === '2026-11-01')).toHaveLength(1);
  });

  it('falls back to the current month rather than rendering nothing', () => {
    expect(monthMatrix(new Date('nonsense')).length).toBeGreaterThan(0);
    expect(monthMatrix(null).length).toBeGreaterThan(0);
  });
});

describe('addMonths', () => {
  it('moves forward and back', () => {
    expect(monthLabel(addMonths(new Date(2026, 9, 14), 1))).toBe('November 2026');
    expect(monthLabel(addMonths(new Date(2026, 9, 14), -1))).toBe('September 2026');
  });

  it('crosses the year boundary', () => {
    expect(monthLabel(addMonths(new Date(2026, 11, 5), 1))).toBe('January 2027');
    expect(monthLabel(addMonths(new Date(2026, 0, 5), -1))).toBe('December 2025');
  });

  it('does not skip a month when the source day does not exist in the target', () => {
    // The classic: Jan 31 + 1 month gives March if you keep the day number.
    expect(monthLabel(addMonths(new Date(2026, 0, 31), 1))).toBe('February 2026');
  });
});

describe('isSameMonth', () => {
  it('separates the same month in different years', () => {
    expect(isSameMonth(new Date(2026, 9, 1), new Date(2026, 9, 30))).toBe(true);
    expect(isSameMonth(new Date(2026, 9, 1), new Date(2027, 9, 1))).toBe(false);
    expect(isSameMonth(new Date(2026, 9, 1), null)).toBe(false);
  });
});

describe('WEEKDAY_LABELS', () => {
  it('is seven days starting on Sunday', () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
    expect(WEEKDAY_LABELS[0]).toBe('Sun');
    expect(WEEKDAY_LABELS[6]).toBe('Sat');
  });
});

describe('formatEventTime', () => {
  it('gives the time alone, for lists under a date heading', () => {
    expect(formatEventTime(event('2026-10-14T09:00:00-04:00'))).toBe('9:00 AM');
    expect(formatEventTime(event('2026-10-14T16:30:00-04:00'))).toBe('4:30 PM');
  });

  it('says "All day" rather than inventing a midnight', () => {
    expect(formatEventTime(event('2026-10-14', { all_day: true }))).toBe('All day');
  });

  it('renders the offset the feed sent in local terms', () => {
    // Midnight UTC on the 15th is 8pm on the 14th in New York.
    expect(formatEventTime(event('2026-10-15T00:00:00Z'))).toBe('8:00 PM');
  });

  it('is empty when there is no usable date', () => {
    expect(formatEventTime(event(''))).toBe('');
    expect(formatEventTime(null)).toBe('');
  });
});

describe('eventMonthRange', () => {
  const today = new Date(2026, 9, 14);

  it('spans the months the feed actually covers', () => {
    const range = eventMonthRange(
      [event('2026-10-20T19:00:00-04:00'), event('2026-11-30T19:00:00-05:00')],
      { today },
    );

    expect(monthLabel(range.first)).toBe('October 2026');
    expect(monthLabel(range.last)).toBe('November 2026');
  });

  it('keeps the current month reachable when every event is later', () => {
    const range = eventMonthRange([event('2026-12-02T19:00:00-05:00')], { today });

    expect(monthLabel(range.first)).toBe('October 2026');
    expect(monthLabel(range.last)).toBe('December 2026');
  });

  it('gives one navigable month when there are no events', () => {
    const range = eventMonthRange([], { today });

    expect(monthLabel(range.first)).toBe('October 2026');
    expect(monthLabel(range.last)).toBe('October 2026');
  });

  it('ignores events it cannot date', () => {
    const range = eventMonthRange([event(''), event('2026-11-05T19:00:00-05:00')], { today });

    expect(monthLabel(range.last)).toBe('November 2026');
  });
});

describe('upcomingEvents', () => {
  const today = new Date(2026, 9, 14, 12, 0);

  it('sorts by date, not by how well the event matched', () => {
    // The feed arrives best-match-first; the calendar wants soonest-first.
    const picks = upcomingEvents(
      [event('2026-11-01T19:00:00-05:00'), event('2026-10-16T19:00:00-04:00')],
      { today },
    );

    expect(picks.map(e => e.start)).toEqual([
      '2026-10-16T19:00:00-04:00',
      '2026-11-01T19:00:00-05:00',
    ]);
  });

  it('keeps an event from earlier today', () => {
    // It is noon and the listing was at 9am. The student may well have gone.
    const picks = upcomingEvents([event('2026-10-14T09:00:00-04:00')], { today });

    expect(picks).toHaveLength(1);
  });

  it('drops events from previous days', () => {
    const picks = upcomingEvents([event('2026-10-13T23:00:00-04:00')], { today });

    expect(picks).toEqual([]);
  });

  it('honours the limit', () => {
    const picks = upcomingEvents(
      [
        event('2026-10-16T19:00:00-04:00'),
        event('2026-10-17T19:00:00-04:00'),
        event('2026-10-18T19:00:00-04:00'),
      ],
      { today, limit: 2 },
    );

    expect(picks).toHaveLength(2);
  });

  it('survives junk input', () => {
    expect(upcomingEvents(null, { today })).toEqual([]);
    expect(upcomingEvents([event('')], { today })).toEqual([]);
  });
});
