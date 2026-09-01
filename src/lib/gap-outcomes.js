/**
 * The Conviction Gap chain.
 *
 * One row per (gap, test), so that later — with enough real students — the
 * product can ask which tests actually resolve which gaps:
 *
 *   Conviction Gap  →  test completed  →  expectation vs reality
 *                   →  evidence created  →  conviction change  →  Path decision
 *
 * Two things are written here, both at moments that already exist: the gap being
 * TARGETED (the student accepting a gap-led recommendation) and the test being
 * COMPLETED (the post-experiment check-in, which is where expectation against
 * reality already lands). Everything after that — the conviction change and the
 * Path decision — is joined at aggregation time from records that already exist,
 * so no new step is added to the student's path.
 *
 * The row carries the EXACT experiment version it belongs to. A test that is
 * materially rewritten produces a new version, so its effectiveness never
 * inherits the old one's readings.
 *
 * Nothing here is ever shown to a student, and nothing here is allowed to break
 * a save: every call is guarded and returns null on failure.
 */
import { base44 } from '@/api/base44Client';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/**
 * A student accepted a recommendation that was pointed at a Conviction Gap.
 * The test itself does not exist yet, so the row opens with the gap and the
 * conviction reading it starts from.
 */
export async function targetGap({ gap, recommendation }) {
  if (!gap?.id) return null;
  try {
    const user = await base44.auth.me();
    const payload = {
      user_id: user?.id,
      gap_id: gap.id,
      gap_area: gap.area || undefined,
      gap_label: gap.unknown || undefined,
      gap_dimension: gap.variable || undefined,
      path_id: recommendation?.path_id || undefined,
      path_name: recommendation?.path_name || undefined,
      rule_id: recommendation?.rule_id || undefined,
      rule_version: recommendation?.rule_version || undefined,
      test_type: recommendation?.test_type || undefined,
      /* Where on the evidence ladder this test was chosen to sit. */
      evidence_method: recommendation?.method || undefined,
      conviction_before: num(recommendation?.candidate?.attached?.confidence),
      chain_stage: 'gap_targeted',
      targeted_at: new Date().toISOString(),
    };
    // Re-accepting the same recommendation updates the open row rather than
    // adding a second one, so one gap targeted twice is not two data points.
    const open = await base44.entities.ConvictionGapOutcome
      .filter({ gap_id: gap.id, chain_stage: 'gap_targeted' }, '-targeted_at', 5).catch(() => []);
    const row = (Array.isArray(open) ? open : []).find(r => !r.path_id || r.path_id === payload.path_id);
    if (row) return base44.entities.ConvictionGapOutcome.update(row.id, payload);
    return base44.entities.ConvictionGapOutcome.create(payload);
  } catch {
    return null;
  }
}

/**
 * A test finished and its post check-in was saved. Closes the open gap row for
 * that path with the expectation-against-reality readings, the evidence the test
 * produced, and the exact experiment version it ran at.
 *
 * A test that was not started from a gap has no open row, and nothing is
 * written: an unattributed completion is not a data point about a gap.
 */
export async function completeGapOutcome({ experiment, measurement }) {
  if (!experiment?.id) return null;
  try {
    const open = await base44.entities.ConvictionGapOutcome
      .filter({ chain_stage: 'gap_targeted' }, '-targeted_at', 20).catch(() => []);
    const rows = Array.isArray(open) ? open : [];
    const row = rows.find(r => r.path_id && (r.path_id === experiment.path_id
      || r.path_id === experiment.career_hypothesis_id
      || r.path_name === experiment.path_name));
    if (!row) return null;

    const [validations, proof] = await Promise.all([
      base44.entities.ExperimentValidation.filter({ experiment_id: experiment.id }, '-created_date', 1).catch(() => []),
      base44.entities.ProofOfWork.filter({ experiment_id: experiment.id }, '-created_date', 20).catch(() => []),
    ]);
    const v = (Array.isArray(validations) ? validations : [])[0] || {};

    return base44.entities.ConvictionGapOutcome.update(row.id, {
      experiment_id: experiment.id,
      experiment_title: experiment.title || undefined,
      cycle_id: experiment.cycle_id || undefined,
      // Tied to the exact version reviewed, never to the test's name.
      blueprint_key: v.blueprint_key || undefined,
      experiment_version: num(v.experiment_version),
      role_blueprint_version: num(v.role_blueprint_version),
      validation_level: num(v.validation_level),
      career_interest_delta: num(measurement?.career_interest_delta),
      career_confidence_delta: num(measurement?.career_confidence_delta),
      enjoyment_expectation_delta: num(measurement?.enjoyment_expectation_delta),
      expectation_recorded: Boolean(measurement?.pre_completed_at),
      evidence_created: (Array.isArray(proof) ? proof : []).length,
      chain_stage: 'test_completed',
      test_completed_at: new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

export default targetGap;