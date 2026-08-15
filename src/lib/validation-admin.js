/**
 * Staff-side validation operations.
 *
 * The important rule lives here: when an experiment is materially rewritten, the
 * reviews that approved the OLD wording must stop counting. Reviews are tied to
 * an `experiment_version`, so bumping the version already removes them from the
 * score (see countingReviews); this also marks them superseded so the trail says
 * why, and drops the validation back to needs_rereview.
 */
import { base44 } from '@/api/base44Client';
import { experimentStrength, strengthSnapshot } from '@/lib/experiment-strength';

const list = (rows) => (Array.isArray(rows) ? rows : []);

/** Everything the dashboard reads, in one pass. */
export async function loadValidationAdmin() {
  const [validations, blueprints, sources, reviews] = await Promise.all([
    base44.entities.ExperimentValidation.list('-created_date', 300).catch(() => []),
    base44.entities.RoleBlueprint.list('-created_date', 200).catch(() => []),
    base44.entities.CareerSource.list('-source_verified_at', 400).catch(() => []),
    base44.entities.ProfessionalExperimentReview.list('-review_date', 400).catch(() => []),
  ]);

  const rows = list(validations).map(validation => {
    const blueprint = list(blueprints).find(b => b.id === validation.role_blueprint_id) || null;
    const rowSources = list(sources).filter(s => s.role_blueprint_id === validation.role_blueprint_id);
    const rowReviews = list(reviews).filter(r =>
      (validation.experiment_id && r.experiment_id === validation.experiment_id)
      || (validation.blueprint_key && r.blueprint_key === validation.blueprint_key));
    return {
      validation,
      blueprint,
      sources: rowSources,
      reviews: rowReviews,
      strength: experimentStrength({ validation, sources: rowSources, reviews: rowReviews }),
    };
  });

  return { rows, blueprints: list(blueprints) };
}

/** Save a field change and refresh the stored score snapshot alongside it. */
export async function updateValidation(row, patch) {
  const next = { ...row.validation, ...patch };
  const strength = experimentStrength({ validation: next, sources: row.sources, reviews: row.reviews });
  return base44.entities.ExperimentValidation.update(row.validation.id, {
    ...patch,
    ...strengthSnapshot(strength, next),
    last_validated_at: new Date().toISOString(),
  });
}

/** The experiment was materially rewritten: retire the reviews and re-open it. */
export async function markRewritten(row) {
  const nextVersion = Number(row.validation.experiment_version || 1) + 1;
  const stale = row.reviews.filter(r => r.approval_status === 'approved');
  if (stale.length) {
    await base44.entities.ProfessionalExperimentReview.bulkUpdate(
      stale.map(r => ({ id: r.id, approval_status: 'superseded' })),
    );
  }
  const next = { ...row.validation, experiment_version: nextVersion, field_calibrated: false, mapping_reviewed: false };
  const strength = experimentStrength({ validation: next, sources: row.sources, reviews: [] });
  return base44.entities.ExperimentValidation.update(row.validation.id, {
    experiment_version: nextVersion,
    validation_status: 'needs_rereview',
    mapping_reviewed: false,
    field_calibrated: false,
    ...strengthSnapshot(strength, next),
  });
}