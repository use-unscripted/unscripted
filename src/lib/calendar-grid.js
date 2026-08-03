/**
 * Laying real campus events out on a month grid.
 *
 * Pure date arithmetic, no rendering and no fetching, so the part of this
 * feature most likely to be quietly wrong is the part that is easiest to test.
 *
 * ## Everything here is local-time, deliberately
 *
 * A campus event happens on a campus. The student is standing on it, reading
 * the clock on the wall, and the only question this file answers is "which
 * square does this go in" — which is a question about their day, not about UTC.
 *
 * So day placement goes through `parseEventStart`, the same parser the event
 * cards format from. That function is the one place that knows a date-only
 * value like "2026-10-14" must be built as local midnight rather than handed to
 * `new Date()`, which reads it as UTC and lands the event on the 13th for every
 * student in the United States. Re-deriving that here would be a second copy of
 * a rule we already got wrong once.
 *
 * ## Day arithmetic never uses milliseconds
 *
 * Every date built below goes through `new Date(year, month, day)` with an
 * out-of-range day where needed — `new Date(2026, 9, 0)` is the last day of
 * September, `new Date(2026, 9, 40)` is in November. That is calendar
 * arithmetic and it survives daylight saving; adding `n * 86400000` does not,
 * and would drop or duplicate a day twice a year.
 */

import { parseEventStart } from './campus-events';

/** Sunday-first, matching the weekday header and every US campus calendar. */
const WEEK_LENGTH = 7;

/**
 * "2026-10-14" for a Date, in the viewer's own timezone.
 *
 * Not `toISOString().slice(0, 10)` — that converts to UTC first, so an evening
 * event is filed under tomorrow anywhere east of Greenwich and a morning one
 * under yesterday anywhere west of it.
 */
export function dayKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Which square this event belongs in, or '' if the feed gave us no usable date. */
export function eventDayKey(event) {
  return dayKey(parseEventStart(event?.start));
}

/**
 * Order within a single day.
 *
 * All-day events first, because they have no time to sort by and putting them
 * among the timed ones implies a slot they do not occupy. Then chronological,
 * then by title so the order is stable across renders rather than depending on
 * whatever order the feed happened to return.
 */
function compareWithinDay(a, b) {
  if (Boolean(a?.all_day) !== Boolean(b?.all_day)) return a?.all_day ? -1 : 1;

  const aTime = parseEventStart(a?.start)?.getTime() ?? 0;
  const bTime = parseEventStart(b?.start)?.getTime() ?? 0;
  if (aTime !== bTime) return aTime - bTime;

  return String(a?.title || '').localeCompare(String(b?.title || ''));
}

/**
 * Events bucketed by day key, each bucket in display order.
 *
 * Events we cannot date are dropped rather than collected under a blank key.
 * There is no square to put them in, and a calendar is the one surface where
 * an undated thing cannot be shown honestly.
 */
export function groupEventsByDay(events) {
  const byDay = new Map();

  for (const event of Array.isArray(events) ? events : []) {
    const key = eventDayKey(event);
    if (!key) continue;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(event);
  }

  for (const bucket of byDay.values()) bucket.sort(compareWithinDay);
  return byDay;
}

/**
 * The weeks of a month, as rows of day cells.
 *
 * Only as many rows as the month actually needs — five most of the time, six
 * when a long month starts late in the week. A fixed six rows would leave a
 * whole trailing row of greyed-out next-month days on most months, which reads
 * as padding rather than as a calendar.
 *
 * `today` is injectable so tests can assert the highlight without depending on
 * the day they happen to run.
 */
export function monthMatrix(month, { today = new Date() } = {}) {
  const anchor = month instanceof Date && !Number.isNaN(month.getTime()) ? month : new Date();
  const year = anchor.getFullYear();
  const monthIndex = anchor.getMonth();

  const leadingBlanks = new Date(year, monthIndex, 1).getDay();
  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const weekCount = Math.ceil((leadingBlanks + daysInMonth) / WEEK_LENGTH);

  const todayKey = dayKey(today);
  const weeks = [];

  for (let week = 0; week < weekCount; week++) {
    const days = [];
    for (let weekday = 0; weekday < WEEK_LENGTH; weekday++) {
      const dayOfMonth = week * WEEK_LENGTH + weekday - leadingBlanks + 1;
      const date = new Date(year, monthIndex, dayOfMonth);
      const key = dayKey(date);
      days.push({
        date,
        key,
        dayOfMonth: date.getDate(),
        inMonth: date.getMonth() === monthIndex && date.getFullYear() === year,
        isToday: key === todayKey,
      });
    }
    weeks.push(days);
  }

  return weeks;
}

/** First of the month `n` months away. Anchored to the 1st, so Jan 31 + 1 is February. */
export function addMonths(date, n) {
  const anchor = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  return new Date(anchor.getFullYear(), anchor.getMonth() + n, 1);
}

/** True when both dates land in the same calendar month of the same year. */
export function isSameMonth(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** "October 2026" — the grid's own heading. */
export function monthLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Short weekday names in the viewer's locale, Sunday first.
 *
 * Read off a known Sunday rather than hardcoded, so the header agrees with the
 * dates rendered beside it instead of asserting English at a French browser.
 */
export const WEEKDAY_LABELS = Array.from({ length: WEEK_LENGTH }, (_, i) =>
  // 2024-01-07 was a Sunday.
  new Date(2024, 0, 7 + i).toLocaleDateString(undefined, { weekday: 'short' }),
);

/**
 * "9:00 AM", or "All day".
 *
 * For lists that already sit under a date heading. Repeating "Wed, Aug 12" on
 * every row under a heading that says "Wednesday, August 12" is what stopped
 * five events reading as one day — the date said five times is noise, and the
 * thing that actually distinguishes them is the time.
 */
export function formatEventTime(event) {
  if (event?.all_day) return 'All day';
  const date = parseEventStart(event?.start);
  if (!date) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * The span of months the feed actually covers, for bounding month navigation.
 *
 * We hold a fixed window of events — paging to March when the last event is in
 * October gives a student five empty grids and no way to tell whether that
 * means "nothing on" or "we don't know yet". Both ends fall back to the current
 * month so an empty feed still renders one navigable month.
 */
export function eventMonthRange(events, { today = new Date() } = {}) {
  const times = (Array.isArray(events) ? events : [])
    .map(event => parseEventStart(event?.start))
    .filter(Boolean)
    .map(date => date.getTime());

  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  if (!times.length) return { first: thisMonth, last: thisMonth };

  const earliest = new Date(Math.min(...times));
  const latest = new Date(Math.max(...times));

  // The current month is always reachable even if every event is later, so
  // "Today" never navigates somewhere the arrows cannot get back from.
  const first = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  return {
    first: first < thisMonth ? first : thisMonth,
    last: new Date(latest.getFullYear(), latest.getMonth(), 1),
  };
}

/**
 * The next `limit` events from now, soonest first.
 *
 * The feed arrives ranked by how well it matched the student's interests, not
 * by date, so a plain slice would show the best match rather than the next
 * thing happening. On a calendar the date is the point.
 *
 * An event earlier today still counts — a 9am listing is worth seeing at noon,
 * because the student may well have gone.
 */
export function upcomingEvents(events, { limit = 3, today = new Date() } = {}) {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  return (Array.isArray(events) ? events : [])
    .map(event => ({ event, date: parseEventStart(event?.start) }))
    .filter(({ date }) => date && date.getTime() >= startOfToday)
    .sort((a, b) => a.date - b.date || compareWithinDay(a.event, b.event))
    .slice(0, limit)
    .map(({ event }) => event);
}
