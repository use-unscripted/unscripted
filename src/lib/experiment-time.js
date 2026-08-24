/**
 * How long an experiment is allowed to claim it takes.
 *
 * The library was authored in afternoons: "2 to 3 hours", "several days",
 * estimates of 90 to 240 minutes. Students read that as a project and never
 * start, and in practice even the longest of these tests is done inside half an
 * hour. So the estimate is compressed here, in one place, rather than being
 * re-typed across 36 template definitions and every screen that prints it.
 *
 * Two bands, and nothing above 45 minutes:
 *   a normal test   15 to 25 minutes
 *   a longer test   25 to 40 minutes  (what used to be a multi-day design)
 *
 * Anything already inside a single sitting is left exactly as authored.
 */

/** Nothing in the product may estimate longer than this. */
export const MAX_SESSION_MINUTES = 45;

/**
 * @param {[number, number]|number[]} range authored [low, high] in minutes
 * @returns {[number, number]} the range a student is actually shown
 */
export function compressMinutes(range) {
  const low = Number(range?.[0]) || 0;
  const high = Number(range?.[1]) || low || 0;
  if (!high || high <= 30) return [low || high, high];
  // A design that used to span days is the "longer" band; everything else is
  // the normal one.
  return high > 240 ? [25, 40] : [15, 25];
}

/** The effort id that matches a compressed range. */
export function effortForMinutes(high) {
  return Number(high) > 30 ? '30-45 minutes' : '15-30 minutes';
}

/** Hours, for the records that store a number rather than a band. */
export function hoursForMinutes(high) {
  return Math.round(((Number(high) || 25) / 60) * 100) / 100;
}