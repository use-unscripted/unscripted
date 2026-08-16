/**
 * The decision-cycle funnel, as events.
 *
 * The problem this exists to solve: an Experiments row proves that a record was
 * created. It does not prove a student saw a recommendation, opened it, started
 * the work, got a quarter of the way through, or finished. Retention and
 * abandonment conclusions drawn from records alone are conclusions about our own
 * generator, not about students.
 *
 * Every emitter here writes through trackPilotEvent, so there is exactly one
 * writer, one dedupe mechanism and one privacy rule in the product: ids, counts
 * and fixed-choice values only, never a word a student typed.
 *
 * Dedupe keys are per (user, experiment) or per (user, path) on purpose. A
 * student who reloads the experiment page five times has viewed it once for
 * funnel purposes; without that, view counts inflate and every conversion below
 * them reads as worse than it is.
 */
import { trackPilotEvent } from '@/lib/pilot-metrics';
import { base44 } from '@/api/base44Client';

/** The ordered funnel. Stage keys double as PilotEvent event names. */
export const FUNNEL_EVENTS = [
  'onboarding_started',
  'onboarding_completed',
  'paths_generated',
  'path_investigated',
  'path_selected',
  'experiment_generated',
  'experiment_recommended',
  'experiment_card_viewed',
  'experiment_detail_viewed',
  'experiment_selected',
  'pre_expectation_started',
  'pre_expectation_completed',
  'experiment_started',
  'experiment_step_completed',
  'experiment_progress_25',
  'experiment_progress_50',
  'experiment_progress_75',
  'experiment_completed',
  'evidence_started',
  'evidence_completed',
  'post_experiment_completed',
  'reflection_started',
  'reflection_completed',
  'path_updated',
  'decision_completed',
  'next_experiment_recommended',
  'repeat_path_test_started',
  'cycle_completed',
];

const ids = (props = {}) => ({
  experiment_id: props.experimentId || undefined,
  path_id: props.pathId || undefined,
  cycle_id: props.cycleId || undefined,
});

/** One event, deduped per experiment (or per path when there is no experiment). */
function once(name, props = {}, keyExtra = '') {
  const scope = props.experimentId || props.pathId || 'account';
  return trackPilotEvent(name, {
    ...ids(props),
    stage: props.stage || undefined,
    value: typeof props.value === 'number' ? props.value : undefined,
    step_number: typeof props.step === 'number' ? props.step : undefined,
    dedupe_key: `${scope}${keyExtra ? `:${keyExtra}` : ''}`,
  });
}

/* ── Recommendation and selection ─────────────────────────────────────────── */

/** A recommendation was actually rendered to the student. */
export const recommendationShown = ({ pathId, experimentId, stage, repeat = false } = {}) => {
  once('experiment_recommended', { pathId, experimentId, stage });
  // The same render is also the "what comes next" event after a finished cycle.
  if (repeat) once('next_experiment_recommended', { pathId, experimentId, stage });
};

/** A card for a specific experiment came into view in a list or comparison. */
export const cardViewed = ({ experimentId, pathId, stage } = {}) =>
  once('experiment_card_viewed', { experimentId, pathId, stage });

/** The student opened one experiment's own screen. */
export const detailViewed = ({ experimentId, pathId, cycleId } = {}) =>
  once('experiment_detail_viewed', { experimentId, pathId, cycleId });

/** An experiment record was created by the product for this student. */
export const experimentGenerated = ({ experimentId, pathId, stage } = {}) =>
  once('experiment_generated', { experimentId, pathId, stage });

/**
 * The student chose this experiment to run. Also emits repeat_path_test_started
 * when this path already has a completed cycle behind it, which is the behaviour
 * the pilot most wants to see.
 */
export async function experimentSelected({ experimentId, pathId, cycleId, stage } = {}) {
  await once('experiment_selected', { experimentId, pathId, cycleId, stage });
  if (!pathId) return;
  const prior = await base44.entities.PilotEvent
    .filter({ event_name: 'cycle_completed', path_id: pathId }, '-occurred_at', 5)
    .catch(() => []);
  const count = Array.isArray(prior) ? prior.length : 0;
  if (count > 0) {
    await once('repeat_path_test_started', { experimentId, pathId, cycleId, value: count + 1 });
  }
}

/* ── Expectations, work, progress ─────────────────────────────────────────── */

export const preExpectationStarted = ({ experimentId, pathId } = {}) =>
  once('pre_expectation_started', { experimentId, pathId });

/**
 * The expectations were recorded, which is also the moment the work begins: the
 * check-in's own button says "Start the experiment".
 */
export async function preExpectationCompleted({ experimentId, pathId, cycleId } = {}) {
  await once('pre_expectation_completed', { experimentId, pathId, cycleId });
  await once('experiment_started', { experimentId, pathId, cycleId });
}

/**
 * One step done, plus the quarter thresholds. Each threshold is deduped per
 * experiment, so re-crossing 50% after going back a step does not double count.
 */
export async function stepCompleted({ experimentId, pathId, step, pct, allDone } = {}) {
  await trackPilotEvent('experiment_step_completed', {
    ...ids({ experimentId, pathId }),
    step_number: typeof step === 'number' ? step : undefined,
    value: typeof pct === 'number' ? pct : undefined,
    dedupe_key: `${experimentId || 'account'}:${step}`,
  });
  const marks = [[75, 'experiment_progress_75'], [50, 'experiment_progress_50'], [25, 'experiment_progress_25']];
  for (const [threshold, name] of marks) {
    if (typeof pct === 'number' && pct >= threshold) await once(name, { experimentId, pathId, value: pct });
  }
  if (allDone) await once('experiment_completed', { experimentId, pathId, value: 100 });
}

/** The experiment finished, however it got there (all steps, or marked complete). */
export const experimentCompleted = ({ experimentId, pathId, cycleId, stage } = {}) =>
  once('experiment_completed', { experimentId, pathId, cycleId, stage });

/* ── Evidence ─────────────────────────────────────────────────────────────── */

export const evidenceStarted = ({ experimentId, pathId } = {}) =>
  once('evidence_started', { experimentId, pathId });

export const evidenceCompleted = ({ experimentId, pathId, step } = {}) =>
  once('evidence_completed', { experimentId, pathId, step }, typeof step === 'number' ? `step-${step}` : '');

/* ── Outcome, reflection, decision ────────────────────────────────────────── */

export const postExperimentCompleted = ({ experimentId, pathId, cycleId } = {}) =>
  once('post_experiment_completed', { experimentId, pathId, cycleId });

export const reflectionStarted = ({ experimentId, pathId } = {}) =>
  once('reflection_started', { experimentId, pathId });

export const reflectionCompleted = ({ experimentId, pathId, cycleId } = {}) =>
  once('reflection_completed', { experimentId, pathId, cycleId });

/** The path's own record moved: a new version was appended to its history. */
export const pathUpdated = ({ experimentId, pathId, sequence } = {}) =>
  once('path_updated', { experimentId, pathId, value: sequence });

/**
 * Continue / modify / eliminate. `stage` carries which one, so drop-off can be
 * read per branch without storing the student's note.
 */
export const decisionCompleted = ({ experimentId, pathId, cycleId, decision } = {}) =>
  once('decision_completed', { experimentId, pathId, cycleId, stage: decision });

/** A path was opened and read, which is what "investigated" means here. */
export const pathInvestigated = ({ pathId, stage } = {}) =>
  once('path_investigated', { pathId, stage });