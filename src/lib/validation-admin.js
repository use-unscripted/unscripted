/**
 * Staff-side validation operations.
 *
 * The important rule lives here: when an experiment is materially rewritten, the
 * reviews that approved the OLD wording must stop counting. Reviews are tied to
 * an `experiment_version`, so bumping the version already removes them from the
 * score (see countingReviews); this also marks them superseded so the trail says
 * why, and drops the validation back to needs_rereview.
 *
 * Nothing here deletes a review or a prior version. A superseded review keeps
 * every word the professional wrote and stays readable in the audit trail, and
 * each published version is snapshotted into its own ExperimentVersion row, so a
 * student who completed v2 keeps a validation history that still describes v2.
 */
import { base44 } from '@/api/base44Client';
import { experimentStrength, strengthSnapshot } from '@/lib/experiment-strength';
import { diffExperimentVersions, revisionPlan } from '@/lib/experiment-revision';

const list = (rows) => (Array.isArray(rows) ? rows : []);
const now = () => new Date().toISOString();

/**
 * The new wording is stored whole in `content_snapshot`. Only the fields the
 * validation record itself declares are copied onto the record — writing an
 * experiment's own fields (core task, instructions) onto a validation row is
 * rejected by the schema and would abort the revision half-done.
 */
const VALIDATION_CONTENT_FIELDS = [
  'experiment_title', 'decision_dimension_ids', 'work_characteristics_tested',
  'career_characteristics_represented', 'career_characteristics_not_represented',
  'estimated_minutes_low', 'estimated_minutes_high', 'role_blueprint_id', 'role_blueprint_version',
  'validation_scope', 'what_it_does', 'best_for',
];
const validationFieldsOf = (content = {}) => VALIDATION_CONTENT_FIELDS.reduce((acc, key) => {
  if (content[key] !== undefined) acc[key] = content[key];
  return acc;
}, {});

/** Everything the dashboard reads, in one pass. */
export async function loadValidationAdmin() {
  const [validations, blueprints, sources, reviews, versions] = await Promise.all([
    base44.entities.ExperimentValidation.list('-created_date', 300).catch(() => []),
    base44.entities.RoleBlueprint.list('-created_date', 200).catch(() => []),
    base44.entities.CareerSource.list('-source_verified_at', 400).catch(() => []),
    base44.entities.ProfessionalExperimentReview.list('-review_date', 400).catch(() => []),
    base44.entities.ExperimentVersion.list('-created_date', 400).catch(() => []),
  ]);

  const rows = list(validations).map(validation => {
    const blueprint = list(blueprints).find(b => b.id === validation.role_blueprint_id) || null;
    const rowSources = list(sources).filter(s => s.role_blueprint_id === validation.role_blueprint_id);
    const matches = (r) => (validation.experiment_id && r.experiment_id === validation.experiment_id)
      || (validation.blueprint_key && r.blueprint_key === validation.blueprint_key);
    const rowReviews = list(reviews).filter(matches);
    const rowVersions = list(versions).filter(matches)
      .sort((a, b) => Number(b.experiment_version || 0) - Number(a.experiment_version || 0));
    return {
      validation,
      blueprint,
      sources: rowSources,
      reviews: rowReviews,
      versions: rowVersions,
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
    last_validated_at: now(),
  });
}

/**
 * Publish an edit to an experiment's content.
 *
 * `nextContent` is the new wording. The diff decides everything else: a typo or
 * a reformat is stored as a minor revision and the reviews keep counting, while
 * a material change bumps the version, supersedes the approvals that described
 * the old wording, re-opens review, and re-scores the experiment without them.
 */
export async function publishRevision(row, nextContent, options = {}) {
  const v = row.validation;
  const previousContent = v.content_snapshot || {};
  const diff = diffExperimentVersions(previousContent, nextContent);
  const plan = revisionPlan({ validation: v, diff });
  const summary = options.summary?.trim() || plan.summary;
  const before = row.strength;

  // Reviews of the old wording: kept in full, marked superseded so the trail
  // says why they stopped counting.
  let superseded = 0;
  if (plan.supersede_reviews) {
    const stale = row.reviews.filter(r => r.approval_status === 'approved');
    superseded = stale.length;
    if (stale.length) {
      await base44.entities.ProfessionalExperimentReview.bulkUpdate(
        stale.map(r => ({ id: r.id, approval_status: 'superseded' })),
      );
    }
  }

  const nextValidation = {
    ...v,
    ...validationFieldsOf(nextContent),
    experiment_version: plan.next_version,
    validation_status: plan.validation_status,
    ...(plan.material ? { mapping_reviewed: false, field_calibrated: false } : {}),
  };
  const strength = experimentStrength({
    validation: nextValidation,
    sources: row.sources,
    reviews: plan.material ? [] : row.reviews,
  });

  // The prior version is preserved as its own record before anything moves.
  const version = await base44.entities.ExperimentVersion.create({
    experiment_id: v.experiment_id,
    blueprint_key: v.blueprint_key,
    experiment_title: nextContent.experiment_title || v.experiment_title,
    experiment_version: plan.next_version,
    supersedes_version: Number(v.experiment_version || 1),
    is_current: true,
    content_snapshot: nextContent,
    change_summary: summary,
    material: plan.material,
    changes: diff.changes,
    validation_level_before: before?.validation_level ?? null,
    validation_level_after: strength.validation_level,
    strength_score_before: before?.score ?? null,
    strength_score_after: strength.score,
    reviews_superseded: superseded,
    rereview_status: plan.material ? 'pending' : 'not_required',
    published_at: now(),
  }).catch(() => null);

  if (plan.material) {
    const stillCurrent = row.versions?.filter(x => x.is_current && x.id !== version?.id) || [];
    if (stillCurrent.length) {
      await base44.entities.ExperimentVersion.bulkUpdate(stillCurrent.map(x => ({ id: x.id, is_current: false })))
        .catch(() => null);
    }
  }

  await base44.entities.ExperimentValidation.update(v.id, {
    ...validationFieldsOf(nextContent),
    experiment_version: plan.next_version,
    validation_status: plan.validation_status,
    content_snapshot: nextContent,
    current_version_record_id: version?.id || v.current_version_record_id || null,
    ...(plan.material
      ? {
        mapping_reviewed: false,
        field_calibrated: false,
        previous_experiment_version: Number(v.experiment_version || 1),
        previous_validation_level: before?.validation_level ?? null,
        rereview_reason: summary,
        rereview_change_labels: [...new Set(diff.material_changes.map(c => c.label))],
        rereview_opened_at: now(),
        pending_reviewer_id: null,
        pending_reviewer_display: null,
      }
      : {}),
    ...strengthSnapshot(strength, nextValidation),
    last_validated_at: now(),
  });

  return { plan, diff, superseded, version, strength };
}

/**
 * The old entry point, kept because the console still offers "this was
 * rewritten" for an edit made outside the app. It is a material change by
 * declaration rather than by diff.
 */
export async function markRewritten(row, summary = 'Marked as materially rewritten by staff.') {
  const content = { ...(row.validation.content_snapshot || {}), core_task: `rewritten:${Date.now()}` };
  return publishRevision(row, content, { summary });
}

/** Put a named reviewer against the version that is awaiting re-review. */
export async function assignReviewer(row, { reviewer_id, reviewer_display }) {
  const current = row.versions?.find(x => x.is_current);
  if (current) {
    await base44.entities.ExperimentVersion.update(current.id, {
      assigned_reviewer_id: reviewer_id || null,
      assigned_reviewer_display: reviewer_display || null,
      assigned_at: now(),
      rereview_status: 'assigned',
    }).catch(() => null);
  }
  return base44.entities.ExperimentValidation.update(row.validation.id, {
    pending_reviewer_id: reviewer_id || null,
    pending_reviewer_display: reviewer_display || null,
  });
}

/**
 * A re-review of the CURRENT version. Recorded against this version number, so
 * it can never retroactively validate the wording it did not see.
 */
export async function submitRereview(row, review) {
  const v = row.validation;
  const created = await base44.entities.ProfessionalExperimentReview.create({
    experiment_id: v.experiment_id,
    blueprint_key: v.blueprint_key,
    experiment_version: Number(v.experiment_version || 1),
    role_blueprint_id: v.role_blueprint_id,
    review_date: now(),
    approval_status: review.approval_status || 'pending',
    reviewer_display: review.reviewer_display || v.pending_reviewer_display || null,
    reviewer_role: review.reviewer_role || null,
    relevant_experience: review.relevant_experience || null,
    share_identity: Boolean(review.share_identity),
    realism_rating: review.realism_rating ?? null,
    entry_level_realism_rating: review.entry_level_realism_rating ?? null,
    workstyle_validity_rating: review.workstyle_validity_rating ?? null,
    terminology_rating: review.terminology_rating ?? null,
    recommendations: review.recommendations || null,
  });

  const current = row.versions?.find(x => x.is_current);
  if (current) {
    const map = { approved: 'approved', changes_requested: 'changes_requested', rejected: 'rejected' };
    await base44.entities.ExperimentVersion.update(current.id, {
      rereview_status: map[created.approval_status] || 'assigned',
      ...(created.approval_status === 'approved' ? { approved_at: now() } : {}),
    }).catch(() => null);
  }

  // Re-score with the new review included, and lift the status back out of
  // re-review only once an approval actually exists for THIS version.
  const reviews = [...row.reviews, created];
  const approvedHere = reviews.some(r =>
    r.approval_status === 'approved' && Number(r.experiment_version) === Number(v.experiment_version || 1));
  const nextValidation = { ...v, validation_status: approvedHere ? 'published' : 'needs_rereview' };
  const strength = experimentStrength({ validation: nextValidation, sources: row.sources, reviews });

  await base44.entities.ExperimentValidation.update(v.id, {
    validation_status: nextValidation.validation_status,
    ...(approvedHere ? { rereview_reason: null, rereview_change_labels: [] } : {}),
    ...strengthSnapshot(strength, nextValidation),
    last_validated_at: now(),
  });

  return { review: created, strength, approved: approvedHere };
}