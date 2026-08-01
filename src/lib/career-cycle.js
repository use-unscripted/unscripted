/**
 * CareerCycle — the one authoritative career-experimentation cycle.
 *
 * A cycle is the parent record that connects: the selected path → the active
 * experiment → its missions → proof → reflections → outreach → a final decision.
 *
 * Rules enforced here (not in the UI, so every call site inherits them):
 *   1. ONE primary active cycle per student. Concurrent calls share a single
 *      in-flight promise, so a double-click cannot create two.
 *   2. A second active experiment cannot start until the current one is
 *      completed, skipped, or the cycle is intentionally ended.
 *   3. Every record created through here carries user_id + cycle_id + path_id
 *      + experiment_id (+ mission_id when applicable), so proof and reflections
 *      can never land on the wrong cycle.
 *
 * Legacy-safe: cycle_id is optional everywhere. Records without one still load,
 * still render, and are never rewritten by this module.
 */
import { base44 } from '@/api/base44Client';

export const CYCLE_STAGES = [
  'onboarding',
  'path_comparison',
  'path_selected',
  'experiment_active',
  'evidence_required',
  'reflection_ready',
  'decision_required',
  'completed',
];

export const FINAL_DECISIONS = ['continue', 'adjust', 'stop_and_explore'];

/** Journey stage (UI) → cycle stage (record). */
const JOURNEY_TO_CYCLE = {
  explore: 'path_comparison',
  choose:  'path_comparison',
  test:    'experiment_active',
  prove:   'evidence_required',
  reflect: 'reflection_ready',
  decide:  'decision_required',
};

export class ActiveExperimentError extends Error {
  constructor(experiment) {
    super('An experiment is already active in this cycle.');
    this.name = 'ActiveExperimentError';
    this.experiment = experiment;
  }
}

// ── One-flight guards — the double-click defence ─────────────────────────────
let ensureInFlight = null;
const opsInFlight = new Map();

/** Runs fn once per key even if called repeatedly before it settles. */
export function onceInFlight(key, fn) {
  if (opsInFlight.has(key)) return opsInFlight.get(key);
  const p = Promise.resolve()
    .then(fn)
    .finally(() => opsInFlight.delete(key));
  opsInFlight.set(key, p);
  return p;
}

async function currentUserId() {
  const me = await base44.auth.me();
  return me?.id || null;
}

/**
 * The single active cycle. If more than one exists (legacy data or a race that
 * beat the guard), the OLDEST is authoritative and the rest are marked
 * 'abandoned' — no user-entered content is touched.
 */
export async function getActiveCycle() {
  const rows = await base44.entities.CareerCycle.filter({ status: 'active' }, 'created_date', 20).catch(() => []);
  const list = Array.isArray(rows) ? rows : [];
  if (list.length <= 1) return list[0] || null;

  const [primary, ...extras] = list;
  await Promise.all(
    extras.map(c => base44.entities.CareerCycle.update(c.id, { status: 'abandoned', legacy_review: true }).catch(() => null))
  );
  return primary;
}

/** Returns the active cycle, creating one if the student has none. */
export function ensureActiveCycle(seed = {}) {
  if (ensureInFlight) return ensureInFlight;
  ensureInFlight = (async () => {
    const existing = await getActiveCycle();
    if (existing) return existing;
    const user_id = await currentUserId();
    return base44.entities.CareerCycle.create({
      user_id,
      current_stage: seed.current_stage || 'path_comparison',
      status: 'active',
      started_at: new Date().toISOString(),
      selected_path_id: seed.selected_path_id,
      selected_path_name: seed.selected_path_name,
      baseline_clarity_score: seed.baseline_clarity_score,
      next_cycle_source_id: seed.next_cycle_source_id,
      institution_id: seed.institution_id,
      cohort_id: seed.cohort_id,
    });
  })().finally(() => { ensureInFlight = null; });
  return ensureInFlight;
}

/** Records the chosen path on the active cycle. Idempotent. */
export async function selectPathForCycle(path) {
  const cycle = await ensureActiveCycle({
    selected_path_id: path?.id,
    selected_path_name: path?.path_name,
    current_stage: 'path_selected',
  });
  const sameAlready = cycle.selected_path_id === path?.id;
  if (sameAlready && cycle.current_stage !== 'path_comparison') return cycle;
  return base44.entities.CareerCycle.update(cycle.id, {
    selected_path_id: path?.id,
    selected_path_name: path?.path_name,
    current_stage: CYCLE_STAGES.indexOf(cycle.current_stage) > CYCLE_STAGES.indexOf('path_selected')
      ? cycle.current_stage
      : 'path_selected',
  });
}

/**
 * Guard before starting a new experiment. Throws ActiveExperimentError when the
 * cycle already has an experiment that is still running.
 */
export async function assertNoActiveExperiment(cycle) {
  if (!cycle?.experiment_id) return null;
  const exp = await base44.entities.Experiments.get(cycle.experiment_id).catch(() => null);
  if (!exp || exp.deletion_status === 'deleted') return null;
  if (['completed', 'skipped'].includes(exp.status)) return null;
  throw new ActiveExperimentError(exp);
}

/** Binds an experiment to the active cycle and moves the cycle forward. */
export async function attachExperimentToCycle(experiment) {
  const cycle = await ensureActiveCycle();
  await base44.entities.CareerCycle.update(cycle.id, {
    experiment_id: experiment.id,
    selected_path_id: cycle.selected_path_id || experiment.path_id,
    selected_path_name: cycle.selected_path_name || experiment.path_name,
    current_stage: 'experiment_active',
  });
  return { ...cycle, experiment_id: experiment.id };
}

/**
 * The relationship stamp every new record should carry.
 * Missing values are omitted rather than written as null.
 */
export async function cycleLinks({ path, experiment, mission } = {}) {
  const [user_id, cycle] = await Promise.all([currentUserId(), getActiveCycle()]);
  const links = {};
  if (user_id) links.user_id = user_id;
  if (cycle?.id) links.cycle_id = cycle.id;
  const path_id = path?.id || experiment?.path_id || cycle?.selected_path_id;
  if (path_id) links.path_id = path_id;
  const experiment_id = experiment?.id || mission?.experiment_id || cycle?.experiment_id;
  if (experiment_id) links.experiment_id = experiment_id;
  if (mission?.id) links.mission_id = mission.id;
  return links;
}

/**
 * Links for a record that belongs to a KNOWN experiment (proof, reflections,
 * missions, outreach). The experiment's own cycle wins, so a record can never be
 * filed under a cycle it does not belong to. When the experiment predates cycles
 * the active cycle is used only if that cycle owns this experiment; otherwise the
 * record is created without a cycle_id and flagged for review.
 */
export async function linksForExperiment(experiment, mission) {
  const [user_id, cycle] = await Promise.all([currentUserId(), getActiveCycle()]);
  const links = {};
  if (user_id) links.user_id = user_id;
  const cycle_id = experiment?.cycle_id
    || (cycle && experiment?.id && cycle.experiment_id === experiment.id ? cycle.id : undefined);
  if (cycle_id) links.cycle_id = cycle_id;
  else if (experiment?.id) links.legacy_review = true;
  const path_id = experiment?.path_id || (cycle_id && cycle?.id === cycle_id ? cycle.selected_path_id : undefined);
  if (path_id) links.path_id = path_id;
  if (experiment?.id) links.experiment_id = experiment.id;
  if (mission?.id) links.mission_id = mission.id;
  return links;
}

/** Keeps cycle.current_stage in step with the derived journey stage. */
export async function syncCycleStage(journeyStage) {
  const target = JOURNEY_TO_CYCLE[journeyStage];
  if (!target) return null;
  const cycle = await getActiveCycle();
  if (!cycle || cycle.current_stage === target) return cycle;
  // Forward only. A stale render (or a page that mounts mid-transition) must
  // never pull a cycle back to an earlier stage than the one it reached.
  if (CYCLE_STAGES.indexOf(target) <= CYCLE_STAGES.indexOf(cycle.current_stage)) return cycle;
  return base44.entities.CareerCycle.update(cycle.id, { current_stage: target });
}

/**
 * Closes the cycle with a decision. 'continue' and 'adjust' open a fresh cycle
 * linked back through next_cycle_source_id; 'stop_and_explore' returns the
 * student to path comparison in a new cycle.
 */
export async function completeCycle({ final_decision, post_cycle_clarity_score, decision_note } = {}) {
  if (!FINAL_DECISIONS.includes(final_decision)) throw new Error('Unknown decision.');
  return onceInFlight(`complete:${final_decision}`, async () => {
    const cycle = await getActiveCycle();
    if (!cycle) return null;
    await base44.entities.CareerCycle.update(cycle.id, {
      status: 'completed',
      current_stage: 'completed',
      completed_at: new Date().toISOString(),
      final_decision,
      post_cycle_clarity_score,
      decision_note,
    });
    const user_id = await currentUserId();
    const next = await base44.entities.CareerCycle.create({
      user_id,
      status: 'active',
      started_at: new Date().toISOString(),
      next_cycle_source_id: cycle.id,
      institution_id: cycle.institution_id,
      cohort_id: cycle.cohort_id,
      baseline_clarity_score: post_cycle_clarity_score,
      current_stage: final_decision === 'stop_and_explore' ? 'path_comparison' : 'path_selected',
      selected_path_id: final_decision === 'stop_and_explore' ? undefined : cycle.selected_path_id,
      selected_path_name: final_decision === 'stop_and_explore' ? undefined : cycle.selected_path_name,
    });
    return { closed: cycle, next };
  });
}

/** Ends the current cycle without a full decision (explicit user intent). */
export async function endCycleEarly(reason) {
  const cycle = await getActiveCycle();
  if (!cycle) return null;
  return base44.entities.CareerCycle.update(cycle.id, {
    status: 'ended_early',
    completed_at: new Date().toISOString(),
    decision_note: reason,
  });
}