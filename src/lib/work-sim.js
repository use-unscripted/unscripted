/**
 * Everything a work simulation writes down.
 *
 * The page holds the student's answers in React state and calls in here at the
 * seams: when a step is submitted, when an experience sample is tapped, when the
 * run is abandoned, and once at the end. There is no per keystroke autosave, on
 * purpose. Saving on every character would put a network round trip inside a
 * text area someone is typing a spec into, and the only thing it buys is the
 * middle of a sentence.
 *
 * Three rules hold this module together and none of them are obvious from the
 * call sites:
 *
 * 1. **An abandoned run never creates an Experiments row.** The Experiments
 *    table already holds 266 rows that went nowhere. Adding a row every time
 *    somebody opens the simulation and closes the tab would make the platform's
 *    worst number worse. The row is created in `completeRun` and nowhere else.
 *
 * 2. **The measurement row is created before the experiment exists.** The four
 *    predictions are asked on the setup screen, which is before there is
 *    anything to attach them to, so the row is opened against the run id and
 *    re-pointed at the real experiment id when the run completes. A student who
 *    answers the four questions and then leaves is a pre row with no post row,
 *    which is a countable thing rather than a hole.
 *
 * 3. **No timers.** Step durations are recorded, and nothing in the UI shows a
 *    clock. A visible countdown turns a sample of work into an exam.
 */
import { base44 } from '@/api/base44Client';
import { NORTHGATE_PM } from '@/lib/work-sims/northgate-pm';
import { runWorkSimChecks } from '@/lib/work-sim-checks';
import { cycleLinks } from '@/lib/career-cycle';
import { savePreMeasurement, savePostMeasurement } from '@/lib/experiment-measurement';
import { trackPilotEvent } from '@/lib/pilot-metrics';

/** The five steps, so a caller can ask "is this the last one" without a magic number. */
export const LAST_STEP = 5;

const list = (v) => (Array.isArray(v) ? v : []);

const clean = (payload) => {
  Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
  return payload;
};

/**
 * The stand-in an ExperimentMeasurement row is opened against before the
 * Experiments row exists. Its id is the run id, so the pre answers of a run that
 * was never finished are still traceable to the run that asked for them.
 */
const measurementStub = (run, sim) => ({
  id: run.id,
  title: sim.title,
  career_name: run.career_name || sim.career_name,
  path_name: run.career_name || sim.career_name,
  cycle_id: run.cycle_id || undefined,
});

/**
 * Every run this student owns, newest first. Small by construction: one row per
 * attempt at a 30 minute task.
 */
export async function loadRuns() {
  const rows = await base44.entities.WorkSimulationRun.list('-created_date', 50).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

/**
 * Closes out any run left open by an earlier visit.
 *
 * The common abandon is a closed tab, and a closed tab cannot be relied on to
 * finish a network write. So the page marks the run abandoned on its way out
 * when it can, and this sweep catches the rest the next time the student opens
 * the simulation. Either way the row ends up with the step they left at, which
 * is the number that says whether 40% completion is the concept or the revision.
 */
export async function closeStaleRuns(rows) {
  const open = list(rows).filter(r => r.status === 'in_progress');
  await Promise.all(open.map(r => abandonRun(r)));
  return open;
}

/**
 * Opens a run. Called when the student presses start on the setup screen, not
 * when the page loads, so opening the page and reading the framing costs
 * nothing and counts as nothing.
 */
export async function startRun(sim = NORTHGATE_PM, known) {
  const previous = known || await loadRuns();
  await closeStaleRuns(previous);

  /** @type {any} */
  const links = await cycleLinks({}).catch(() => ({}));
  const run = await base44.entities.WorkSimulationRun.create(clean({
    user_id: links.user_id,
    cycle_id: links.cycle_id,
    path_id: links.path_id,
    simulation_key: sim.key,
    simulation_version: sim.version,
    career_name: sim.career_name,
    status: 'in_progress',
    current_step: 1,
    started_at: new Date().toISOString(),
  }));

  trackPilotEvent('simulation_started', {
    path_id: links.path_id,
    cycle_id: links.cycle_id,
    dedupe_key: run.id,
  });

  // Second and later attempts, which is the "did they want another one enough
  // to do one" half of the want-more measure. The earlier completed runs get
  // stamped so the read-out can compare what the student said with what they
  // did, rather than asking them again.
  const done = previous.filter(r => r.status === 'completed');
  if (done.length) {
    trackPilotEvent('simulation_second_started', {
      path_id: links.path_id,
      value: done.length + 1,
      dedupe_key: run.id,
    });
    const at = new Date().toISOString();
    await Promise.all(done
      .filter(r => !r.started_another_at)
      .map(r => base44.entities.WorkSimulationRun.update(r.id, { started_another_at: at }).catch(() => null)));
  }

  return run;
}

/** The four predictions, asked before the first step opens. */
export async function saveSimPredictions(run, values, sim = NORTHGATE_PM) {
  return savePreMeasurement(measurementStub(run, sim), values);
}

/**
 * One step submitted. `patch` carries whatever that step produced, and
 * `seconds` is how long it took, appended rather than replaced so a step is
 * never silently re-timed.
 */
export async function saveStep(run, step, patch, seconds) {
  const step_seconds = [
    ...list(run?.step_seconds).filter(s => s.step !== step),
    ...(Number.isFinite(seconds) ? [{ step, seconds: Math.max(0, Math.round(seconds)) }] : []),
  ];
  const payload = clean({ ...patch, current_step: step, step_seconds });
  await base44.entities.WorkSimulationRun.update(run.id, payload).catch(() => null);
  return { ...run, ...payload };
}

/**
 * One experience sample, written the instant it is tapped so an abandon
 * straight afterwards still keeps it.
 *
 * A skip is a row with `skipped: true`, never an absent row. The difference
 * between "did not want to answer" and "never got asked" is the whole reason
 * the skip control exists.
 */
export async function recordSample(run, { at_step, score, skipped }) {
  const experience_samples = [
    ...list(run?.experience_samples).filter(s => s.at_step !== at_step),
    clean({
      at_step,
      score: skipped ? undefined : score,
      skipped: !!skipped,
      sampled_at: new Date().toISOString(),
    }),
  ].sort((a, b) => a.at_step - b.at_step);

  await base44.entities.WorkSimulationRun.update(run.id, { experience_samples }).catch(() => null);
  return { ...run, experience_samples };
}

/**
 * Leaving part way through. Keeps the step, keeps the samples already taken,
 * and creates nothing else.
 *
 * The only writer of the abandoned status, so both routes into it (the page on
 * its way out, and the sweep on the next visit) produce the same row and the
 * same event. The event carries the step in `value`, deduped on the run id, so
 * the two routes cannot double count one abandon.
 */
export async function abandonRun(run, step) {
  if (!run?.id || run.status !== 'in_progress') return null;
  const at = step ?? run.current_step ?? 1;
  trackPilotEvent('simulation_abandoned', { value: at, dedupe_key: run.id });
  return base44.entities.WorkSimulationRun.update(run.id, {
    status: 'abandoned',
    abandoned_at_step: at,
  }).catch(() => null);
}

/**
 * The mean of the samples the student actually answered. Skips are not zeroes
 * and they are not fives; they are left out of the average entirely, and two
 * skips leave the field absent so nothing downstream reads an invented number.
 */
export function sampledEnjoyment(run) {
  const scores = list(run?.experience_samples)
    .filter(s => !s.skipped && Number.isFinite(s.score))
    .map(s => s.score);
  if (!scores.length) return undefined;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

/**
 * The end of a run: the three model-free checks, the Experiments row this
 * becomes, the measurement, the proof of work, and the passive signal.
 *
 * The two model-scored criteria are not merged here. `work-sim-review.js` runs
 * after this resolves, against the saved row, so a model that is unreachable
 * costs the student nothing and loses none of their work. Until it exists,
 * `check_results` holds three rows and the read-out says three of five.
 */
export async function completeRun({ run, answers = /** @type {any} */ ({}), sim = NORTHGATE_PM }) {
  const checks = runWorkSimChecks(run, sim);
  /** @type {any} */
  const links = await cycleLinks({ path: run.path_id ? { id: run.path_id } : undefined }).catch(() => ({}));
  const now = new Date().toISOString();

  const experiment = await base44.entities.Experiments.create(clean({
    ...links,
    title: sim.title,
    objective: sim.objective,
    career_name: sim.career_name,
    path_name: sim.career_name,
    realistic_scenario: sim.setup,
    experiment_type: 'Work Simulation',
    design_source: 'custom',
    difficulty_level: 'moderate',
    estimated_hours: 0.5,
    deliverable: sim.deliverable,
    evaluation_criteria: list(sim.rubric).map(r => r.criterion),
    status: 'completed',
  }));

  const completedRun = {
    ...run,
    status: 'completed',
    completed_at: now,
    experiment_id: experiment.id,
    check_results: checks,
    current_step: LAST_STEP,
  };
  await base44.entities.WorkSimulationRun.update(run.id, {
    status: 'completed',
    completed_at: now,
    experiment_id: experiment.id,
    check_results: checks,
    current_step: LAST_STEP,
  }).catch(() => null);

  // The pre row was opened against the run id. Handing it to savePostMeasurement
  // as the existing row is what re-points it at the experiment and computes the
  // deltas against the predictions in one write.
  const preRow = await base44.entities.ExperimentMeasurement
    .filter({ experiment_id: run.id }, '-created_date', 1).catch(() => []);
  const measurement = await savePostMeasurement(experiment, list(preRow)[0], {
    actual_enjoyment: sampledEnjoyment(run),
    actual_energy: answers.actual_energy,
    desire_to_repeat: answers.desire_to_repeat,
    surprise_reflection: answers.surprise_reflection,
  }).catch(() => null);

  const spec = (run.spec_v2 || run.spec_v1 || '').trim();
  if (spec) {
    await base44.entities.ProofOfWork.create(clean({
      ...links,
      experiment_id: experiment.id,
      title: sim.title,
      category: 'written_summary',
      path_tested: sim.career_name,
      description: spec,
    })).catch(() => null);
  }

  const totalSeconds = list(run.step_seconds).reduce((sum, s) => sum + (Number(s.seconds) || 0), 0);
  await base44.entities.BehavioralSignal.create(clean({
    user_id: links.user_id,
    experiment_id: experiment.id,
    career_name: sim.career_name,
    evidence_source: 'observed_task_performance',
    evidence_weight: 'supporting',
    outcome: 'completed',
    seconds_total: totalSeconds || undefined,
    seconds_to_begin: list(run.step_seconds).find(s => s.step === 1)?.seconds,
    answer_revisions: run.spec_v2 ? 1 : 0,
    rationale_characters: spec.length,
    voluntary_continuation: !!run.started_another_at,
    occurred_at: now,
  })).catch(() => null);

  trackPilotEvent('simulation_completed', {
    experiment_id: experiment.id,
    path_id: links.path_id,
    cycle_id: links.cycle_id,
    dedupe_key: run.id,
  });

  return { run: completedRun, experiment, measurement };
}
