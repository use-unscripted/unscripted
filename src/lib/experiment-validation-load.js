/**
 * Loading the validation records behind one or more experiments, and turning
 * them into a strength reading plus a per-student learning value.
 *
 * Validation records are keyed by `experiment_id` where an experiment is a
 * concrete student row, and by `blueprint_key` where a validated template backs
 * many student copies of the same experiment. Both are looked up, so a validated
 * template covers every student who ran it without duplicating rows.
 */
import { base44 } from '@/api/base44Client';
import { experimentStrength } from '@/lib/experiment-strength';
import { personalLearningValue } from '@/lib/personal-learning-value';
import { dimensionsFromActivity, CAREER_DIMENSIONS } from '@/lib/career-dimensions';
import { loadMeasurements } from '@/lib/experiment-measurement';

const list = (rows) => (Array.isArray(rows) ? rows : []);
const keyOf = (e) => e?.blueprint_key || e?.path_recommendation_id || null;

/** Every validation record that could apply to these experiments. */
export async function loadValidations(experiments = []) {
  const rows = list(await base44.entities.ExperimentValidation.list('-created_date', 300).catch(() => []));
  const byExperiment = new Map();
  const byKey = new Map();
  rows.forEach(v => {
    if (v.experiment_id) byExperiment.set(v.experiment_id, v);
    if (v.blueprint_key) byKey.set(v.blueprint_key, v);
  });
  return experiments.map(e => ({
    experiment: e,
    validation: byExperiment.get(e.id) || byKey.get(keyOf(e)) || null,
  }));
}

/** The blueprint, sources and approved reviews behind one validation record. */
export async function loadValidationContext(validation, experiment) {
  if (!validation) return { blueprint: null, sources: [], reviews: [], effectiveness: null };
  const [blueprint, sources, reviews, effectiveness] = await Promise.all([
    validation.role_blueprint_id
      ? base44.entities.RoleBlueprint.get(validation.role_blueprint_id).catch(() => null)
      : Promise.resolve(null),
    validation.role_blueprint_id
      ? base44.entities.CareerSource.filter({ role_blueprint_id: validation.role_blueprint_id }, '-source_verified_at', 50).catch(() => [])
      : Promise.resolve([]),
    base44.entities.ProfessionalExperimentReview.filter(
      validation.experiment_id ? { experiment_id: validation.experiment_id } : { blueprint_key: validation.blueprint_key },
      '-review_date', 50,
    ).catch(() => []),
    // Admin-only under row-level security. Students simply get null, which is
    // what keeps low-sample field statistics off their screens.
    validation.blueprint_key
      ? base44.entities.ExperimentEffectiveness.filter({ blueprint_key: validation.blueprint_key }, '-computed_at', 1).catch(() => [])
      : Promise.resolve([]),
  ]);
  return {
    blueprint,
    sources: list(sources),
    reviews: list(reviews),
    effectiveness: list(effectiveness)[0] || null,
    experiment,
  };
}

/** The dimension evidence the student already has, plus what their paths turn on. */
export async function loadStudentEvidence() {
  const [experiments, reflections, profiles, paths] = await Promise.all([
    base44.entities.Experiments.list('-created_date', 200).catch(() => []),
    base44.entities.WeeklyReflections.list('-created_date', 100).catch(() => []),
    base44.entities.StudentProfile.list('-created_date', 1).catch(() => []),
    base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []),
  ]);
  const measurements = await loadMeasurements().catch(() => ({}));
  const dimensions = dimensionsFromActivity({
    experiments: list(experiments).filter(e => e.deletion_status !== 'deleted'),
    measurements,
    reflections: list(reflections),
    profile: list(profiles)[0] || {},
  });

  // The dimensions the student's live paths actually turn on.
  const live = list(paths).filter(p => p.status !== 'archived' && p.hypothesis_status !== 'archived');
  const tags = new Set();
  live.forEach(p => (p.path_fit_signals || []).forEach(s => tags.add(String(s).toLowerCase().replace(/\s+/g, '_'))));
  const hypothesisDimensionIds = CAREER_DIMENSIONS
    .filter(d => tags.has(d.id) || d.signals.some(s => tags.has(s)))
    .map(d => d.id);

  return { dimensions, hypothesisDimensionIds, paths: live };
}

/** One experiment, fully read: strength, personal value and the review trail. */
export async function loadExperimentValidation(experiment) {
  const [[pair], evidence] = await Promise.all([
    loadValidations([experiment]),
    loadStudentEvidence(),
  ]);
  const ctx = await loadValidationContext(pair.validation, experiment);
  const strength = experimentStrength({ validation: pair.validation, ...ctx });
  const minutes = pair.validation?.estimated_minutes_high
    || (Number(experiment?.estimated_hours) ? Number(experiment.estimated_hours) * 60 : null);
  const value = personalLearningValue({
    validation: pair.validation,
    experiment,
    dimensions: evidence.dimensions,
    hypothesisDimensionIds: evidence.hypothesisDimensionIds,
    estimatedMinutes: minutes,
  });
  return { experiment, validation: pair.validation, ...ctx, strength, value, minutes, evidence };
}