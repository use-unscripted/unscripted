/**
 * Dates — the one place an entity timestamp is turned into an instant, and the
 * one place a week is turned into a key.
 *
 * Two opposite traps, and this app has been bitten by both.
 *
 * 1. **Base44 returns timestamps without a zone marker.** `list()` and `get()`
 *    hand back `"2026-08-01T04:23:19.626000"`; `create()` returns the same field
 *    for the same row as `"…626Z"`. Both are UTC, but a string with no `Z` and
 *    no offset is parsed by `new Date()` as *local* time — so in
 *    America/New_York every read-back instant lands four hours late, and the
 *    two round-trips of a single row disagree with each other. Four hours is
 *    enough to move a Sunday-evening completion into Monday, i.e. into the
 *    following week's read-out. `entityDate` puts the `Z` back.
 *
 * 2. **A bare `YYYY-MM-DD` is the opposite mistake.** `new Date('2026-08-01')`
 *    is UTC midnight, which is the evening *before* anywhere west of Greenwich.
 *    A date-only value is a calendar day, not an instant, so it is anchored at
 *    local noon — far enough from both midnights that neither a DST shift nor a
 *    zone offset can move the day.
 *
 * The parse is done by hand rather than handed to `new Date()` even in the
 * zoned case: Base44 sends six fractional digits, which is outside the format
 * the spec requires engines to accept, so whether it parses at all is left to
 * the browser. Building the instant from the parts is the same answer
 * everywhere.
 *
 * Anything that compares, buckets, or orders an entity timestamp goes through
 * here. Formatting one for display does not have to, but should.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?(Z|z|[+-]\d{2}:?\d{2})?$/;

/**
 * A Base44 timestamp (or a date-only string, a Date, or epoch ms) as a Date.
 * Returns null rather than an Invalid Date, so a caller cannot accidentally
 * carry NaN into a comparison and have it silently answer false.
 *
 * @param {string|Date|number|null|undefined} value
 * @returns {Date|null}
 */
export function entityDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null;
  if (typeof value !== 'string') return null;

  const s = value.trim();
  if (!s) return null;

  // A calendar day. Local noon — see the header.
  const day = s.match(DATE_ONLY);
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12, 0, 0, 0);

  const m = s.match(TIMESTAMP);
  if (m) {
    // Six fractional digits from Base44, three from anything that went through
    // toISOString(). Truncate rather than round — this is milliseconds, and the
    // extra precision has never mattered to anything that reads it.
    const ms = Number(String(m[7] || '').slice(0, 3).padEnd(3, '0'));
    const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0), ms);
    const zone = m[8];
    // No zone marker means UTC. This is the whole fix: `new Date()` would read
    // it as local.
    if (!zone || zone === 'Z' || zone === 'z') return new Date(utc);
    const digits = zone.slice(1).replace(':', '');
    const offsetMinutes = Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2));
    return new Date(utc + (zone[0] === '-' ? 1 : -1) * offsetMinutes * 60000);
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The same value as epoch milliseconds, or NaN. */
export function entityTime(value) {
  const d = entityDate(value);
  return d ? d.getTime() : NaN;
}

// ── Weeks ──────────────────────────────────────────────────────────────────────
// Every week key is a local calendar date formatted by hand. The old code built
// the local Monday and then called toISOString(), which converts to UTC: in
// America/New_York a Friday 21:00 reflection was filed under a Tuesday, and a
// Sunday 22:00 one under the previous week. Sunday evening is exactly when
// people reflect.

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The 'YYYY-MM-DD' Monday of the local week a moment falls in. */
export function getMonday(d) {
  const src = entityDate(d);
  if (!src) return '';
  // A copy: callers pass a live Date and the shifting below would otherwise
  // rewrite it under them.
  const date = new Date(src.getTime());
  // Noon, so adding or subtracting days can never cross midnight when a DST
  // boundary shifts the clock by an hour.
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return toDateKey(date);
}

/** A week key as a local Date, at noon. */
function weekDate(key) {
  return entityDate(key) || new Date(NaN);
}

export function fmtWeek(key, opts = { month: 'long', day: 'numeric' }) {
  if (!key) return '';
  const d = weekDate(key);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', opts);
}

// Resume matching is a tolerance, never string equality: a row written by an
// older build, or by a browser in another timezone, can be a day off and is
// still this week's reflection.
export function sameWeek(a, b, toleranceDays = 1) {
  if (!a || !b) return false;
  const da = weekDate(a).getTime();
  const db = weekDate(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return false;
  return Math.abs(da - db) <= toleranceDays * 86400000;
}

/**
 * Local midnight at the start of a 'YYYY-MM-DD' day, or null. This is the
 * boundary a student means by a date they picked out of a date input — not UTC
 * midnight, which is the evening before for anyone west of Greenwich.
 */
export function localDayStart(key) {
  const m = typeof key === 'string' ? key.trim().match(DATE_ONLY) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0) : null;
}

/**
 * Local midnight `days` days after the start of that day. Built with setDate so
 * a DST boundary in between does not shorten or lengthen the span.
 */
export function localDayStartPlus(key, days) {
  const start = localDayStart(key);
  if (!start) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return end;
}

/** Does this timestamp fall inside the local week beginning on `mondayKey`? */
export function inWeek(value, mondayKey) {
  const t = entityTime(value);
  if (!Number.isFinite(t)) return false;

  const start = localDayStart(mondayKey);
  const end = localDayStartPlus(mondayKey, 7);
  if (!start) return false;
  return t >= start.getTime() && t < end.getTime();
}
