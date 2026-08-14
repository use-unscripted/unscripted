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
import { scoreSimulationRun } from '@/lib/work-sim-review';
import { cycleLinks } from '@/lib/career-cycle';
import { savePreMeasurement, savePostMeasurement } from '@/lib/experiment-measurement';
import { trackPilotEvent } from '@/lib/pilot-metrics';

/** The five steps, so a caller can ask "is this the last one" without a magic number. */
export const LAST_STEP = 5;

/**
 * WHAT `current_step` AND `abandoned_at_step` MEAN. One definition, both routes.
 *
 * **The step whose screen the student was looking at when they stopped.** Not
 * the last step they finished. Somebody who submits step 2 and then closes the
 * tab on the spec is an abandon at step 3, because step 3 is the screen that
 * lost them.
 *
 * That is the only reading the field is any use for. Its whole job is to answer
 * whether a low completion rate is the concept or the revision, and "how far
 * did they get" cannot answer that if the two ways out of a run disagree by
 * one. The in-app route already used the stage. The sweep that catches a closed
 * tab reads this field, and a closed tab is the ordinary abandon, so the field
 * had to move to meet it: it is written on every stage change now, from this
 * one map, rather than being set to whichever step was last submitted.
 *
 * The sample screens and the two halves of the revision are not steps of their
 * own. Somebody who leaves on the second sample left during step 4, and
 * grouping it any other way would make the number say something untrue.
 */
export const STEP_OF = {
  setup: 1,
  step1: 1,
  step2: 2, sample1: 2,
  step3: 3,
  step4a: 4, sample2: 4, step4b: 4,
  step5: 5, after: 5, scoring: 5, done: 5,
};

/**
 * How long the page holds the read-out back waiting for the review.
 *
 * The review is one model call with a small prompt, and `generateValidated` is
 * allowed one retry, so the realistic worst case is somewhere in the twenties.
 * This is set below that on purpose: past twenty seconds the read-out is worth
 * more to the student than the two extra checks are, and the call keeps running
 * either way, so a late answer still lands on the row.
 */
export const REVIEW_WAIT_MS = 20000;

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
 * One finished run and the measurement row its read-out is built from.
 *
 * The read-out is not a screen that happens once at the end of a run. The
 * want-more row compares what a student said they would do against what they
 * did, and at the moment they finish there is nothing to compare, so that half
 * only exists on a later visit. This is what a later visit loads.
 *
 * A row that is not this student's own comes back as null, because the read-out
 * reads their own writing back to them and row level security is the only thing
 * standing behind that. An unfinished run comes back as null too: there is a
 * separate screen for a run in progress and it is not this one.
 */
export async function loadCompletedRun(runId, known) {
  if (!runId) return null;
  const rows = known || await loadRuns();
  const run = list(rows).find(r => r?.id === runId && r?.status === 'completed');
  if (!run) return null;

  // The pre row was opened against the run id and re-pointed at the experiment
  // when the run completed, so look for the experiment first and fall back to
  // the run for a completion whose post write did not land.
  const byExperiment = run.experiment_id
    ? await base44.entities.ExperimentMeasurement
      .filter({ experiment_id: run.experiment_id }, '-created_date', 1).catch(() => [])
    : [];
  const byRun = list(byExperiment).length
    ? []
    : await base44.entities.ExperimentMeasurement
      .filter({ experiment_id: run.id }, '-created_date', 1).catch(() => []);

  return { run, measurement: list(byExperiment)[0] || list(byRun)[0] || null };
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
 *
 * `nextStage` is the screen the student is about to be on, and it is what
 * `current_step` records, per the definition on STEP_OF. Timing is still filed
 * against `step`, the one they just submitted.
 */
export async function saveStep(run, step, patch, seconds, nextStage) {
  const step_seconds = [
    ...list(run?.step_seconds).filter(s => s.step !== step),
    ...(Number.isFinite(seconds) ? [{ step, seconds: Math.max(0, Math.round(seconds)) }] : []),
  ];
  const payload = clean({ ...patch, current_step: STEP_OF[nextStage] ?? step, step_seconds });
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
export async function recordSample(run, { at_step, score, skipped }, nextStage) {
  const experience_samples = [
    ...list(run?.experience_samples).filter(s => s.at_step !== at_step),
    clean({
      at_step,
      score: skipped ? undefined : score,
      skipped: !!skipped,
      sampled_at: new Date().toISOString(),
    }),
  ].sort((a, b) => a.at_step - b.at_step);

  // A sample is a stage change like any other, so it carries the step the
  // student moves on to. Without this, a tab closed on the screen after a
  // sample would be swept up as an abandon one step early.
  const payload = clean({ experience_samples, current_step: STEP_OF[nextStage] });
  await base44.entities.WorkSimulationRun.update(run.id, payload).catch(() => null);
  return { ...run, ...payload };
}

/**
 * Leaving part way through. Keeps the step, keeps the samples already taken,
 * and creates nothing else.
 *
 * The only writer of the abandoned status, so both routes into it (the page on
 * its way out, and the sweep on the next visit) produce the same row and the
 * same event. The event carries the step in `value`, deduped on the run id, so
 * the two routes cannot double count one abandon.
 *
 * Both routes now write the same number as well. The page passes the step of
 * the stage it is leaving; the sweep passes nothing and falls back to
 * `current_step`, which is that same step because every stage change writes it.
 * See STEP_OF for what the number means.
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
 * The two model-scored criteria, added to a run that is already saved.
 *
 * Called by `completeRun` and by nothing else, at the very end, after every
 * write that holds a student's work has already landed. That order is the
 * point of this function existing separately: a model that is unreachable, slow
 * or hanging costs two criteria and nothing more. Put the call in front of the
 * save and a closed tab costs somebody thirty minutes of work.
 *
 * **Idempotent, on the same guard the rest of the app uses.**
 * `system_evaluated_at` on the measurement row is what `evaluateExperimentWork`
 * already treats as "already done", and it means the same thing here: set, and
 * this returns without calling anything. The model rows on `check_results` are
 * the second guard, for the case where the measurement write failed and there
 * was nowhere to stamp. Reloading a finished read-out, or opening it twice,
 * therefore buys no second call.
 *
 * Returns the upgraded rows, or `null` when nothing changed: the review failed,
 * timed out inside the SDK, returned nothing usable, or had already run. `null`
 * leaves the run holding exactly its three computed checks and the measurement
 * with no `system_evaluated_at`, which is the state a later backfill reads.
 * Never rejects.
 */
export async function reviewCompletedRun({ run, measurement = null, sim = NORTHGATE_PM }) {
  if (!run?.id || run.status !== 'completed') return null;
  if (measurement?.system_evaluated_at) return null;
  if (list(run.check_results).some(r => r?.scored_by === 'model')) return null;

  let scored;
  try {
    scored = await scoreSimulationRun(run, { sim });
  } catch {
    return null;
  }
  if (!scored?.model_scored) return null;

  const at = new Date().toISOString();
  await base44.entities.WorkSimulationRun
    .update(run.id, { check_results: scored.check_results }).catch(() => null);

  let stamped = measurement;
  if (measurement?.id) {
    stamped = { ...measurement, system_evaluated_at: at };
    await base44.entities.ExperimentMeasurement
      .update(measurement.id, { system_evaluated_at: at }).catch(() => null);
  }

  return { run: { ...run, check_results: scored.check_results }, measurement: stamped };
}

/**
 * The end of a run: the three model-free checks, the Experiments row this
 * becomes, the measurement, the proof of work, and the passive signal.
 *
 * The two model-scored criteria are not merged in here. They are started on the
 * last line, once every write above has landed, and handed back as the `review`
 * promise so the page can draw the read-out without waiting on a model. The
 * work is durable before the call is made, and that ordering is the whole
 * reason this function returns a promise instead of awaiting one.
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

  // Last line, deliberately. Everything a student typed is on the server by the
  // time this starts, so the call below can fail, hang or never answer and the
  // only thing lost is two of the five checks. Not awaited: the caller gets the
  // saved run straight away and decides for itself how long to wait.
  const review = reviewCompletedRun({ run: completedRun, measurement, sim }).catch(() => null);

  return { run: completedRun, experiment, measurement, review };
}
