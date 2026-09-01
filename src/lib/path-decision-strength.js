/**
 * Path Decision Strength for ONE path.
 *
 * The question it answers is "how much weight does the evidence behind this path
 * actually carry", which is NOT the question any existing reading answers:
 *
 *   - the fit score says how well the work matches this student
 *   - Path Confidence says how sure the estimate is
 *   - Decision Readiness says whether there is enough here to decide at all
 *   - Path Decision Strength says how much you would bet on it
 *
 * Pure, derived, and nothing is stored: it reads the gap roster that is already
 * derived per path, the ConvictionGapOutcome rows that already record which
 * method each completed test ran at, and the contradictions the existing
 * detector already finds. No weight, threshold or score anywhere else in the
 * product is touched, and this never feeds fit or confidence.
 *
 * Two rules held here on purpose:
 *  - Height on the ladder outweighs breadth. Several Stated and Exposure tests
 *    carry less weight than a couple of Applied or Lived ones.
 *  - A contradiction holds it down, the same way it holds Decision Readiness at
 *    Important Questions Remain however much evidence sits behind the path.
 */

/** How much weight one completed test carries, by the method it ran at. */
export const METHOD_WEIGHT = {
  stated: 0.15,
  exposure: 0.35,
  simulated: 0.55,
  human: 0.85,
  applied: 1,
  lived: 1.25,
};

export const STRENGTH_WEIGHTS = {
  /* Ladder height dominates, which is the whole point of the reading. */
  ladder: 60,
  ladder_cap: 4,
  coverage: 25,
  repeats: 15,
  contradiction_penalty: 14,
  max_contradiction_penalty: 42,
  /* A path with an unresolved contradiction cannot read above this band. */
  contradiction_band_cap: 2,
};

/** Low to High. Named bands, never a number or a percentage on screen. */
export const STRENGTH_BANDS = [
  { key: 'thin', label: 'Thin', tone: 'muted', meaning: 'Almost nothing behind this path yet carries real weight.' },
  { key: 'light', label: 'Light', tone: 'muted', meaning: 'What you have is mostly reading and reacting rather than doing.' },
  { key: 'moderate', label: 'Moderate', tone: 'info', meaning: 'Real evidence exists, and little of it comes from doing the work or from people in it.' },
  { key: 'substantial', label: 'Substantial', tone: 'info', meaning: 'A good part of this rests on work you actually did or people who do it.' },
  { key: 'strong', label: 'Strong', tone: 'success', meaning: 'The evidence here is high on the ladder and has held up more than once.' },
];

/** The one sentence that says how this differs from Decision Readiness. */
export const STRENGTH_VS_READINESS =
  'Decision Readiness asks whether there is enough here to decide. Path Decision Strength asks how much you would bet on it.';

const THRESHOLDS = [15, 32, 52, 74];

function bandFor(score) {
  let i = 0;
  THRESHOLDS.forEach((t, idx) => { if (score >= t) i = idx + 1; });
  return i;
}

/**
 * @param {object} args
 * @param {object|null} args.roster        buildGapRoster() result for the path
 * @param {Array} args.outcomes            ConvictionGapOutcome rows for the path
 * @param {Array} args.contradictions      detectContradictions() result
 * @returns {object} band, reasons, and what is holding it down
 */
export function pathDecisionStrength({ roster = null, outcomes = [], contradictions = [] } = {}) {
  const W = STRENGTH_WEIGHTS;
  const gaps = roster?.gaps || [];
  const total = roster?.total || gaps.length || 0;

  /* Same rule the roster uses: a test with no evidence submitted did not test
     anything, however far the student got through it. */
  const done = (Array.isArray(outcomes) ? outcomes : [])
    .filter(o => o.chain_stage === 'test_completed' && (o.evidence_created || 0) > 0);

  const ladderRaw = done.reduce((n, o) => n + (METHOD_WEIGHT[o.evidence_method] ?? METHOD_WEIGHT.exposure), 0);
  const highest = done
    .map(o => o.evidence_method)
    .sort((a, b) => (METHOD_WEIGHT[b] || 0) - (METHOD_WEIGHT[a] || 0))[0] || null;

  const withEvidence = roster?.withEvidence ?? gaps.filter(g => g.state !== 'untested').length;
  const repeated = gaps.filter(g => g.state === 'tested_more').length;
  const conflicts = Array.isArray(contradictions) ? contradictions : [];

  const ladderPoints = (Math.min(ladderRaw, W.ladder_cap) / W.ladder_cap) * W.ladder;
  const coveragePoints = total ? (withEvidence / total) * W.coverage : 0;
  const repeatPoints = total ? (repeated / total) * W.repeats : 0;
  const penalty = Math.min(conflicts.length * W.contradiction_penalty, W.max_contradiction_penalty);

  const score = Math.max(0, Math.min(100, Math.round(ladderPoints + coveragePoints + repeatPoints - penalty)));
  const capped = conflicts.length > 0;
  const index = capped ? Math.min(bandFor(score), W.contradiction_band_cap) : bandFor(score);

  const reasons = [];
  if (!done.length) {
    reasons.push('No completed test has produced evidence on this path yet.');
  } else {
    reasons.push(`${done.length} ${done.length === 1 ? 'test has' : 'tests have'} produced evidence, the highest of them ${String(highest || 'exposure')} evidence.`);
  }
  if (total) reasons.push(`${withEvidence} of ${total} gaps have something behind them, and ${repeated} ${repeated === 1 ? 'has' : 'have'} held up more than once.`);
  if (conflicts.length) {
    reasons.push(`${conflicts.length} ${conflicts.length === 1 ? 'reading disagrees' : 'readings disagree'} with itself, which holds this down until further testing settles it.`);
  }

  return {
    ...STRENGTH_BANDS[index],
    index,
    bands: STRENGTH_BANDS.length,
    reasons,
    heldDownByContradiction: capped,
    testsWithEvidence: done.length,
    highestMethod: highest,
    repeated,
    withEvidence,
    total,
  };
}

export default pathDecisionStrength;