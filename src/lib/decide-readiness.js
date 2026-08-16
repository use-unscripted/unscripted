/**
 * When the Decide stage is open.
 *
 * The cycle is: choose a path, test it (a Deep Dive with its full reflection, or
 * a Quick Test with its short one), then decide. A decision is only worth
 * recording once every key dimension of the path has been looked at at least
 * once, so this module answers one question and nothing else: is anything that
 * matters on this path still completely untested?
 *
 * "At least once" is deliberate, and weaker than the `tested` bar used elsewhere:
 * one reading is enough to open the decision, while two is what makes a
 * dimension read as tested. A student is never blocked from deciding because a
 * dimension needs a second reading — only because it has none at all.
 *
 * Reads dimension-progress rows. Stores nothing, decides nothing else.
 */

/**
 * @param {object|null} progress dimensionProgress() result for the path
 * @returns {{ready: boolean, remaining: array, seen: number, total: number}}
 */
export function decideReadiness(progress) {
  const rows = progress?.rows || [];
  // No uncertainty map yet: nothing to gate on, so the decision stays open.
  if (!rows.length) return { ready: true, remaining: [], seen: 0, total: 0 };

  const remaining = rows.filter(r => r.status === 'untested');
  return {
    ready: remaining.length === 0,
    remaining,
    seen: rows.length - remaining.length,
    total: rows.length,
  };
}

/** What is still missing, in the student's own terms. */
export function readinessMessage(readiness) {
  const { remaining, seen, total } = readiness;
  if (!remaining.length) {
    return `Every one of the ${total} key dimensions on this path now has at least one reading behind it, so the decision rests on evidence rather than a guess.`;
  }
  const n = remaining.length;
  return n === 1
    ? `One key dimension on this path has never been tested, so the decision would still rest on a guess about it. ${seen} of ${total} have a reading.`
    : `${n} key dimensions on this path have never been tested. ${seen} of ${total} have a reading, and each remaining one is a short test.`;
}