/**
 * The state of each of the eight student-facing Conviction Gaps, for one path.
 *
 * Pure, and entirely DERIVED. Nothing is stored for this, no new entity exists
 * for it, and the student is never asked to fill anything in to populate it.
 * Three sources, all of which already exist:
 *
 *   - dimension readings from dimensionProgress(): how many observations exist
 *     on the work characteristics that make up the gap
 *   - the eight internal areas from buildConvictionRecord(): whether the
 *     evidence-quality area behind the gap has anything at all
 *   - ConvictionGapOutcome rows: written when a gap is targeted and again when
 *     its test completes; only completed tests count as evidence
 *
 * State is deliberately coarse: untested, tested once, tested more than once.
 */
import { CONVICTION_GAPS } from '@/lib/conviction-gaps';

const AREA_WEIGHT = { none: 0, early: 1, some: 1, strong: 2 };

/**
 * @param {object} args
 * @param {object|null} args.progress dimensionProgress() result for the path
 * @param {object|null} args.record   buildConvictionRecord() result for the path
 * @param {Array}  args.outcomes      ConvictionGapOutcome rows for the path
 * @returns {{ gaps: Array, withEvidence: number, total: number }}
 */
export function buildGapRoster({ progress = null, record = null, outcomes = [] } = {}) {
  const rows = new Map((progress?.rows || []).map(r => [r.id, r]));
  const areas = new Map((record?.areas || []).map(a => [a.id, a]));
  /* A test with no evidence submitted did not test its gap, however far the
     student got through it. Evidence is the requirement, not completion. */
  const done = (Array.isArray(outcomes) ? outcomes : [])
    .filter(o => o.chain_stage === 'test_completed' && (o.evidence_created || 0) > 0);

  const gaps = CONVICTION_GAPS.map(gap => {
    const matched = gap.characteristics.map(id => rows.get(id)).filter(Boolean);
    const readings = matched.reduce((n, r) => n + (r.observations || 0), 0);
    const areaEvidence = gap.areas.reduce((n, id) => n + (AREA_WEIGHT[areas.get(id)?.state] || 0), 0);
    const tests = done.filter(o => o.gap_id === gap.id).length;

    const count = readings + areaEvidence + tests;
    const state = count >= 2 ? 'tested_more' : count >= 1 ? 'tested_once' : 'untested';

    /* Which characteristic a test on this gap should aim at: the one with the
       least evidence, so a second test does not repeat the first. */
    const target = [...matched].sort((a, b) => (a.observations || 0) - (b.observations || 0))[0] || null;

    return {
      id: gap.id,
      label: gap.label,
      question: gap.question,
      state,
      /* The gap shape the next-test flow and gap-outcomes already expect. */
      variable: target?.id || gap.characteristics[0],
      area: gap.areas[0],
      unknown: gap.label,
    };
  });

  return {
    gaps,
    withEvidence: gaps.filter(g => g.state !== 'untested').length,
    total: gaps.length,
  };
}

export default buildGapRoster;