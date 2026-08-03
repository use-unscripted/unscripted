import { describe, it, expect } from 'vitest';
import { entityDate, entityTime, getMonday, fmtWeek, sameWeek, inWeek } from '@/lib/dates';

// Every assertion below is about a timezone west of UTC, so a run on a UTC box
// would pass while the student's browser still filed the row under the wrong
// week. vitest.config.js pins TZ=America/New_York; this fails loudly if that
// ever stops being true rather than going quietly green.
describe('the test timezone', () => {
  it('is pinned to America/New_York', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/New_York');
  });
});

describe('entityDate — Base44 timestamps', () => {
  // Base44's list()/get() return "2026-08-01T04:23:19.626000" (no Z) while
  // create() returns "2026-08-01T04:23:19.626Z" for the same row. Both are UTC.
  it('reads a Z-less timestamp as UTC, not local', () => {
    expect(entityDate('2026-08-01T04:23:19.626000').toISOString())
      .toBe('2026-08-01T04:23:19.626Z');
  });

  it('gives the same instant for the Z-less and Z-suffixed forms of one row', () => {
    expect(entityTime('2026-08-01T04:23:19.626000'))
      .toBe(entityTime('2026-08-01T04:23:19.626Z'));
  });

  it('handles the 6-digit fractional seconds Base44 actually sends', () => {
    expect(entityDate('2026-07-28T23:32:34.409000').toISOString())
      .toBe('2026-07-28T23:32:34.409Z');
  });

  it('handles a timestamp with no fractional seconds', () => {
    expect(entityDate('2026-08-01T04:23:19').toISOString())
      .toBe('2026-08-01T04:23:19.000Z');
  });

  it('respects an explicit UTC offset when one is present', () => {
    expect(entityTime('2026-08-01T00:23:19-04:00'))
      .toBe(entityTime('2026-08-01T04:23:19Z'));
  });

  // A bare YYYY-MM-DD is a calendar day, not an instant. new Date('2026-08-01')
  // is UTC midnight — the evening BEFORE, anywhere west of Greenwich.
  it('anchors a date-only value at local noon', () => {
    const d = entityDate('2026-08-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(12);
  });

  it('returns null rather than an Invalid Date for junk', () => {
    expect(entityDate('')).toBeNull();
    expect(entityDate(null)).toBeNull();
    expect(entityDate(undefined)).toBeNull();
    expect(entityDate('not a date')).toBeNull();
    expect(entityTime(null)).toBeNaN();
  });

  it('passes a Date through unchanged and does not mutate it', () => {
    const d = new Date('2026-08-01T04:23:19.626Z');
    expect(entityTime(d)).toBe(d.getTime());
  });
});

describe('getMonday', () => {
  it('returns the Monday of a mid-week day', () => {
    expect(getMonday(new Date(2026, 7, 5, 9, 0, 0))).toBe('2026-08-03'); // Wed
  });

  it('treats Sunday as the last day of the week it ends, not the first', () => {
    expect(getMonday(new Date(2026, 7, 2, 22, 0, 0))).toBe('2026-07-27'); // Sun
  });

  it('returns the day itself for a Monday', () => {
    expect(getMonday(new Date(2026, 7, 3, 0, 30, 0))).toBe('2026-08-03');
  });

  it('does not mutate the Date it was handed', () => {
    const d = new Date(2026, 7, 5, 9, 0, 0);
    getMonday(d);
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(9);
  });

  it('accepts a Base44 timestamp string', () => {
    // 2026-08-03T02:00Z is Sunday 2 Aug, 22:00 in New York.
    expect(getMonday('2026-08-03T02:00:00.000000')).toBe('2026-07-27');
  });
});

describe('inWeek', () => {
  // The whole point. A student finishing something at 10pm on Sunday is the
  // single most likely moment for this to be wrong, and it is also exactly when
  // people reflect.
  it('files a Sunday-evening completion under the week that is ending', () => {
    // 22:00 Sunday 2 Aug in New York = 2026-08-03T02:00:00Z.
    expect(inWeek('2026-08-03T02:00:00.000000', '2026-07-27')).toBe(true);
    expect(inWeek('2026-08-03T02:00:00.000000', '2026-08-03')).toBe(false);
  });

  it('files a Monday-morning completion under the week that is starting', () => {
    // 09:00 Monday 3 Aug in New York = 2026-08-03T13:00:00Z.
    expect(inWeek('2026-08-03T13:00:00.000000', '2026-08-03')).toBe(true);
    expect(inWeek('2026-08-03T13:00:00.000000', '2026-07-27')).toBe(false);
  });

  it('agrees between the Z-less and Z-suffixed forms of one instant', () => {
    expect(inWeek('2026-08-03T02:00:00.000000', '2026-07-27'))
      .toBe(inWeek('2026-08-03T02:00:00.000Z', '2026-07-27'));
  });

  it('gets the same answer in winter, when the offset is five hours', () => {
    // 22:00 Sunday 11 Jan in New York (EST) = 2026-01-12T03:00:00Z.
    expect(inWeek('2026-01-12T03:00:00.000000', '2026-01-05')).toBe(true);
    expect(inWeek('2026-01-12T03:00:00.000000', '2026-01-12')).toBe(false);
  });

  it('holds at the very start of the week', () => {
    // 00:00 Monday 3 Aug in New York = 2026-08-03T04:00:00Z.
    expect(inWeek('2026-08-03T04:00:00.000000', '2026-08-03')).toBe(true);
    // One millisecond earlier is still the week before.
    expect(inWeek('2026-08-03T03:59:59.999000', '2026-08-03')).toBe(false);
    expect(inWeek('2026-08-03T03:59:59.999000', '2026-07-27')).toBe(true);
  });

  it('places a date-only value on its own calendar day', () => {
    expect(inWeek('2026-08-02', '2026-07-27')).toBe(true);
    expect(inWeek('2026-08-03', '2026-08-03')).toBe(true);
    expect(inWeek('2026-08-03', '2026-07-27')).toBe(false);
  });

  it('is false for a missing value or a missing week', () => {
    expect(inWeek('', '2026-07-27')).toBe(false);
    expect(inWeek(null, '2026-07-27')).toBe(false);
    expect(inWeek('2026-08-03T02:00:00.000000', '')).toBe(false);
    expect(inWeek('2026-08-03T02:00:00.000000', 'nonsense')).toBe(false);
  });
});

describe('fmtWeek / sameWeek', () => {
  it('shows the week key as its own calendar day', () => {
    expect(fmtWeek('2026-08-03')).toBe('August 3');
    expect(fmtWeek('')).toBe('');
  });

  it('matches week keys a day either side, and not a week apart', () => {
    expect(sameWeek('2026-08-03', '2026-08-03')).toBe(true);
    expect(sameWeek('2026-08-03', '2026-08-04')).toBe(true);
    expect(sameWeek('2026-08-03', '2026-07-27')).toBe(false);
    expect(sameWeek('', '2026-08-03')).toBe(false);
  });
});
