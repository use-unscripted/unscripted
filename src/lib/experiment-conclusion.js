/**
 * The conclusion of an active experiment: context loading, availability gating,
 * and the one write that records the reflection.
 *
 * Everything is loaded from the student's OWN records. Experiments arrive through
 * the row-level-scoped SDK list, so an id that is not in that list belongs to
 * someone else (or nothing) and is refused rather than rendered.
 */
import { base44 } from '@/api/base44Client';
import { getActiveCycle, onceInFlight } from '@/lib/career-cycle';
import { readProgress } from '@/lib/guide-progress';
import { reflectionFields } from '@/lib/reflection-sections';
import { loadExperimentProgress } from '@/lib/active-experiments';

const alive = (rows) => (Array.isArray(rows) ? rows : []).filter(r => r?.deletion_status !== 'deleted');
const OPEN_EXPERIMENT = ['draft', 'planned', 'in_progress'];

// The local draft, so a failed save never costs the student their words, moved
// to src/lib/student-drafts.js. It is the same private free text the weekly
// reflection holds and it now lives under the same rules: owned by one
// signed-in student, cleared on sign-out, expired after a week. Import
// readConclusionDraft / writeConclusionDraft / clearConclusionDraft from there.

/**
 * Everything the reflection needs, resolved without asking the student to pick
 * anything: user, cycle, path, experiment, missions, outreach, proof, baseline
 * clarity, and any conclusion already written for this experiment.
 */
export async function loadConclusionContext(experimentIdParam) {
  const [user, cycle, experiments] = await Promise.all([
    base44.auth.me(),
    getActiveCycle().catch(() => null),
    base44.entities.Experiments.list('-created_date', 100).catch(() => []),
  ]);
  const own = alive(experiments);

  let experiment = null;
  if (experimentIdParam) {
    experiment = own.find(e => e.id === experimentIdParam) || null;
    // The id was supplied but is not one of this student's experiments.
    if (!experiment) return { user, cycle, experiment: null, forbidden: true };
  }
  /* No id supplied: the experiment that owes a reflection, decided by the same
     shared reading the Test screen uses, so the two screens agree. Only if
     nothing is owed does this fall back to the cycle and to open work. */
  if (!experiment) {
    /* Same reading, same scope as the Test screen: the test the student is on if
       its work is finished, otherwise the oldest one on this path that still
       owes a reflection. */
    const { current, awaitingReflection } = await loadExperimentProgress({ pathName: cycle?.selected_path_name || undefined })
      .catch(() => ({ current: null, awaitingReflection: [] }));
    const owed = (current?.awaitingReflection ? current : null) || awaitingReflection[0] || null;
    experiment = owed?.experiment || null;
  }
  if (!experiment && cycle?.experiment_id) experiment = own.find(e => e.id === cycle.experiment_id) || null;
  if (!experiment && cycle?.selected_path_name) {
    experiment = own.find(e => e.path_name === cycle.selected_path_name) || null;
  }
  if (!experiment) {
    experiment = own.find(e => OPEN_EXPERIMENT.includes(e.status)) || own.find(e => e.status === 'completed') || null;
  }
  if (!experiment) return { user, cycle, experiment: null };

  const [guideRows, proofRows, outreachRows, reflectionRows, pathRows] = await Promise.all([
    base44.entities.MissionGuides.filter({ experiment_id: experiment.id }, '-version_number', 20).catch(() => []),
    base44.entities.ProofOfWork.filter({ experiment_id: experiment.id }, '-created_date', 200).catch(() => []),
    base44.entities.OutreachContacts.filter({ experiment_id: experiment.id }, '-created_date', 200).catch(() => []),
    base44.entities.WeeklyReflections.filter({ experiment_id: experiment.id }, '-created_date', 50).catch(() => []),
    base44.entities.PathRecommendations.list('-created_date', 200).catch(() => []),
  ]);

  const guides = alive(guideRows);
  const proof = alive(proofRows);
  const outreach = alive(outreachRows);
  const reflections = alive(reflectionRows);
  const paths = Array.isArray(pathRows) ? pathRows : [];

  const path = paths.find(p => p.id === (experiment.path_id || cycle?.selected_path_id))
    || paths.find(p => p.path_name === experiment.path_name)
    || null;

  /* Step progress on the experiment's own guide. Experiments carry their steps
     directly now, so nothing here reads Missions. */
  const guide = guides.find(g => g.is_active) || guides[0] || null;
  const progress = guide ? readProgress(guide) : { steps: [], completed: [], total: 0 };
  const completedStepTitles = progress.steps
    .filter(s => progress.completed.includes(s.step_number))
    .map(s => s.title)
    .filter(Boolean);

  /* Every experiment this student has finished, and the finished ones on this
     same path — the reflection can point back at them. */
  const completedExperiments = own.filter(e => e.status === 'completed');

  return {
    user,
    cycle,
    path,
    paths,
    experiment,
    guide,
    stepsTotal: progress.total,
    stepsDone: progress.completed.length,
    completedStepTitles,
    completedExperiments,
    proof,
    outreach,
    reflections,
    // The conclusion already written for this experiment, if any. Editing it
    // updates that record — a second submission never becomes a second row.
    existing: reflections.find(r => r.is_experiment_conclusion) || null,
    baselineClarity: cycle?.baseline_clarity_score ?? null,
    endedEarly: experiment.status === 'skipped',
  };
}

/**
 * Is the reflection open yet? Three doors: the experiment is marked complete,
 * every step of it is done, or the student ended it early with a reason.
 */
export function conclusionAvailability(ctx) {
  if (!ctx?.experiment) return { ready: false, reason: 'no_experiment' };
  if (ctx.endedEarly) return { ready: true, reason: 'ended_early' };
  if (ctx.experiment.status === 'completed') return { ready: true, reason: 'experiment_complete' };
  if (ctx.stepsTotal > 0 && ctx.stepsDone >= ctx.stepsTotal) return { ready: true, reason: 'steps_complete' };
  return {
    ready: false,
    reason: 'experiment_open',
    stepsDone: ctx.stepsDone || 0,
    stepsTotal: ctx.stepsTotal || 0,
  };
}

/** Ends the experiment early with the student's own reason. */
export async function endExperimentEarly(experiment, reason) {
  const text = String(reason || '').trim();
  if (!text) throw new Error('A reason is required to end this experiment early.');
  return onceInFlight(`end-early:${experiment.id}`, () =>
    base44.entities.Experiments.update(experiment.id, {
      status: 'skipped',
      pause_reason: text,
      status_history: [
        ...(experiment.status_history || []),
        { from_status: experiment.status, to_status: 'skipped', changed_at: new Date().toISOString(), reason: text },
      ],
    })
  );
}

function localDateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Records the conclusion. One row per experiment, enforced by conclusion_key and
 * a single in-flight promise, so a double-tap or a retry after an error can
 * never produce a duplicate or a second reflection over the first.
 */
export async function saveConclusion(ctx, answers, dimensions = []) {
  const { experiment, cycle, path, user } = ctx;
  const payload = {
    ...reflectionFields(answers, dimensions),
    user_id: user?.id,
    cycle_id: experiment.cycle_id || (cycle?.experiment_id === experiment.id ? cycle.id : undefined),
    experiment_id: experiment.id,
    path_id: experiment.path_id || path?.id || cycle?.selected_path_id,
    path_name: experiment.path_name || path?.path_name,
    week_start: ctx.existing?.week_start || localDateKey(),
    is_experiment_conclusion: true,
    conclusion_key: `conclusion:${experiment.id}`,
    ended_early_reason: ctx.endedEarly ? (experiment.pause_reason || undefined) : undefined,
    interest_direction: answers.interest,
    path_feedback: answers.interest
      ? `${{ more: 'More interested in this path', same: 'About as interested as before', less: 'Less interested in this path' }[answers.interest]}${answers.interestNote.trim() ? `: ${answers.interestNote.trim()}` : ''}`
      : undefined,
    next_changes: String(answers.unresolved || '').trim() || undefined,
    clarity_score: answers.clarity ?? undefined,
    baseline_clarity_score: ctx.baselineClarity ?? undefined,
    missions_completed_count: ctx.stepsDone || 0,
    proof_count: ctx.proof.length,
    outreach_count: ctx.outreach.length,
    completed_items: ctx.completedStepTitles,
    referenced_experiment_ids: answers.references?.length ? answers.references : undefined,
    referenced_experiment_titles: answers.references?.length
      ? answers.references
        .map(id => (ctx.completedExperiments.find(e => e.id === id)?.title))
        .filter(Boolean)
      : undefined,
  };
  Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

  await import('@/lib/analytics/decision-funnel-events')
    .then(m => m.reflectionCompleted({
      experimentId: experiment.id,
      pathId: payload.path_id,
      cycleId: payload.cycle_id,
    }))
    .catch(() => {});

  return onceInFlight(`conclusion:${experiment.id}`, async () => {
    // Re-read rather than trusting the render: another tab may have saved first.
    const rows = alive(await base44.entities.WeeklyReflections.filter(
      { experiment_id: experiment.id, is_experiment_conclusion: true }, '-created_date', 10
    ).catch(() => []));
    const target = ctx.existing || rows[0];
    if (target) {
      await base44.entities.WeeklyReflections.update(target.id, payload);
      return { ...target, ...payload, reused: true };
    }
    return base44.entities.WeeklyReflections.create(payload);
  });
}