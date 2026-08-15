/**
 * Reading several experiments at once, so a student can compare them.
 *
 * The student's evidence is loaded ONCE and reused across every experiment,
 * because personal learning value is a comparison against the same evidence for
 * all of them. Strength is per experiment and reads only stored records.
 */
import { base44 } from '@/api/base44Client';
import { experimentStrength } from '@/lib/experiment-strength';
import { personalLearningValue, bestNextTest } from '@/lib/personal-learning-value';
import { loadValidations, loadValidationContext, loadStudentEvidence } from '@/lib/experiment-validation-load';

const alive = (rows) => (Array.isArray(rows) ? rows : []).filter(r => r.deletion_status !== 'deleted');

/** Candidate experiments to compare: everything not already finished. */
export async function loadComparableExperiments(pathName = null) {
  const rows = alive(await base44.entities.Experiments.list('-created_date', 200).catch(() => []));
  const open = rows.filter(e => ['draft', 'planned', 'in_progress', 'paused'].includes(e.status));
  const scoped = pathName ? open.filter(e => e.path_name === pathName) : open;
  return (scoped.length ? scoped : open).slice(0, 6);
}

/** Full readings for a set of experiments, plus which one is the best next test. */
export async function loadComparison(experiments = []) {
  if (!experiments.length) return { rows: [], best: null, evidence: null };

  const [pairs, evidence] = await Promise.all([
    loadValidations(experiments),
    loadStudentEvidence(),
  ]);

  const rows = await Promise.all(pairs.map(async ({ experiment, validation }) => {
    const ctx = await loadValidationContext(validation, experiment);
    const strength = experimentStrength({ validation, ...ctx });
    const minutes = validation?.estimated_minutes_high
      || (Number(experiment?.estimated_hours) ? Number(experiment.estimated_hours) * 60 : null);
    const value = personalLearningValue({
      validation,
      experiment,
      dimensions: evidence.dimensions,
      hypothesisDimensionIds: evidence.hypothesisDimensionIds,
      estimatedMinutes: minutes,
    });
    return { experiment, validation, ...ctx, strength, value, minutes };
  }));

  return { rows, best: bestNextTest(rows), evidence };
}

export default loadComparison;