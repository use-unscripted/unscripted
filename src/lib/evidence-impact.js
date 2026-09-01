/**
 * What the evidence a student just submitted actually did.
 *
 * Reporting only. Nothing here writes a record, changes a weight or a threshold,
 * or recalculates anything: every number it reads was already stored by the pre
 * and post check-ins, the gap chain, and the Career Evidence Profile. The output
 * is plain sentences, deliberately with no scores and no bars.
 *
 * Contradictions come from detectContradictions() in evidence-contradictions.js,
 * which is the only place in the product that decides what a contradiction is.
 */
import { loadConvictionLab } from '@/lib/conviction-lab';
import { detectContradictions } from '@/lib/evidence-contradictions';
import { METHOD_BY_ID } from '@/lib/evidence-methods';
import { GAP_STATES } from '@/lib/conviction-gaps';
import { base44 } from '@/api/base44Client';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The one sentence about the ladder, said at the moment it is learned. */
export const LADDER_RULE =
  'Evidence from higher up the ladder moves the decision about this path more than evidence from lower down.';

/**
 * How what happened compared with what was expected, from the deltas already
 * stored on the measurement row. A pair with either half missing is skipped
 * rather than assumed.
 */
export function comparisonLines(m) {
  const pairs = [
    { delta: m?.enjoyment_expectation_delta, up: 'more enjoyable than you expected', down: 'less enjoyable than you expected', same: 'about as enjoyable as you expected' },
    { delta: m?.energy_expectation_delta, up: 'more energising than you expected', down: 'flatter than you expected', same: 'about as energising as you expected' },
    { delta: m?.difficulty_expectation_delta, up: 'harder than you expected', down: 'easier than you expected', same: 'about as hard as you expected' },
  ];
  return pairs
    .filter(p => num(p.delta) !== null)
    .map(p => (p.delta > 0 ? p.up : p.delta < 0 ? p.down : p.same));
}

/** What this test moved about the path overall, in the same plain register. */
export function pathMovementLines(m) {
  const out = [];
  const interest = num(m?.career_interest_delta);
  const confidence = num(m?.career_confidence_delta);
  if (interest !== null) {
    out.push(interest > 0 ? 'Your interest in this path went up after doing it.'
      : interest < 0 ? 'Your interest in this path went down after doing it.'
      : 'Your interest in this path is unchanged.');
  }
  if (confidence !== null) {
    out.push(confidence > 0 ? 'You are more confident this path fits you than you were before.'
      : confidence < 0 ? 'You are less confident this path fits you than you were before.'
      : 'Your confidence that this path fits you is unchanged.');
  }
  return out;
}

/**
 * @returns {null|object} null when there is nothing honest to report — no path,
 * or a test that was never attached to a gap.
 */
export async function loadEvidenceImpact({ experiment, measurement, pathId }) {
  if (!pathId || !experiment?.id) return null;

  const [lab, outcomes] = await Promise.all([
    loadConvictionLab(pathId).catch(() => null),
    base44.entities.ConvictionGapOutcome
      .filter({ experiment_id: experiment.id }, '-targeted_at', 5).catch(() => []),
  ]);
  if (!lab) return null;

  const outcome = (Array.isArray(outcomes) ? outcomes : [])[0] || null;
  const roster = lab.gapRoster || { gaps: [], withEvidence: 0, total: 0 };
  const gap = outcome ? roster.gaps.find(g => g.id === outcome.gap_id) || null : null;
  const method = METHOD_BY_ID.get(outcome?.evidence_method) || null;

  /* The obvious next move: the first gap on this path with nothing behind it. */
  const nextGap = roster.gaps.find(g => g.state === 'untested' && g.id !== gap?.id) || null;

  return {
    pathName: lab.path?.path_name || null,
    gap: gap ? { label: gap.label, state: GAP_STATES[gap.state]?.label || null } : null,
    method: method ? { label: method.label, weightNote: method.weightNote } : null,
    comparison: comparisonLines(measurement),
    movement: pathMovementLines(measurement),
    contradictions: detectContradictions(lab.signals || []),
    coverage: { withEvidence: roster.withEvidence, total: roster.total },
    nextGap: nextGap ? { label: nextGap.label, question: nextGap.question } : null,
    ladderRule: LADDER_RULE,
  };
}

export default loadEvidenceImpact;