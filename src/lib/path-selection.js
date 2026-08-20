/**
 * Path selection — the single transition from "comparing three paths" to
 * "testing one path".
 *
 * One call does the whole thing, in a fixed order, so a failure can never leave
 * a half-selected state:
 *   1. record the path on the active cycle (selected_path_id)
 *   2. mark the path active + primary, and drop the primary flag elsewhere
 *   3. connect exactly ONE experiment — an existing planned one for this path if
 *      there is one, otherwise a new one built from its recommended first
 *      experiment (never a second one)
 *   4. stamp that experiment with user_id + cycle_id + path_id
 *   5. move the cycle to experiment_active
 *
 * Duplicate protection: the whole sequence runs once per path even if the
 * button is pressed repeatedly, and step 3 always looks for an existing
 * experiment before creating one.
 */
import { base44 } from '@/api/base44Client';
import { onceInFlight, selectPathForCycle, attachExperimentToCycle } from '@/lib/career-cycle';
import { trackPilotEvent } from '@/lib/pilot-metrics';

const OPEN_STATUSES = ['draft', 'planned', 'in_progress'];

async function currentUserId() {
  const me = await base44.auth.me();
  return me?.id || null;
}

/** An existing open experiment for this path, if the student already has one. */
const belongsToPath = (e, path) =>
  e.path_id === path.id || e.path_recommendation_id === path.id || e.path_name === path.path_name;

async function findExistingExperiment(path, cycle) {
  if (cycle?.experiment_id) {
    const bound = await base44.entities.Experiments.get(cycle.experiment_id).catch(() => null);
    // It must be an experiment for THIS path. Without that check, switching the
    // chosen path kept the previous path's experiment attached to the cycle, so
    // Test said you were testing a career you had not picked.
    if (bound && bound.deletion_status !== 'deleted' && OPEN_STATUSES.includes(bound.status) && belongsToPath(bound, path)) return bound;
  }
  const rows = await base44.entities.Experiments.list('-created_date', 200).catch(() => []);
  const mine = (Array.isArray(rows) ? rows : []).filter(
    e => e.deletion_status !== 'deleted'
      && OPEN_STATUSES.includes(e.status)
      && belongsToPath(e, path)
  );
  const preferred = path.first_experiment
    ? mine.find(e => e.title && path.first_experiment.toLowerCase().includes(e.title.toLowerCase().slice(0, 18)))
    : null;
  return preferred || mine[0] || null;
}

/**
 * Selects `path` and returns { path, experiment, cycle }.
 * Throws on failure — the caller keeps the student's selection and offers retry.
 */
export function selectPathAndBeginExperiment(path, allPaths = []) {
  if (!path?.id) throw new Error('No path to select.');
  // A duplicate that the integrity pass merged away must never become the
  // selected hypothesis again — the surviving row is the one that carries the
  // history.
  if (path.integrity_status === 'merged' && path.duplicate_of_id) {
    const survivor = allPaths.find(p => p.id === path.duplicate_of_id);
    if (survivor) path = survivor;
  }

  return onceInFlight(`select-path:${path.id}`, async () => {
    /* No access gate here. Choosing which path you test is navigation, not a new
       purchase: a student whose first cycle had been closed hit the one-cycle
       limit the moment they picked a different path, so the button wrote nothing
       at all, bounced them to My Journey, and every screen carried on naming the
       path they were trying to leave — permanently, since the count of closed
       cycles never goes back down.

       The limit still holds where it means something: completeCycle refuses to
       open the next cycle once it is reached, and My Journey shows the
       continuation step there. */
    const user_id = await currentUserId();

    // 1 — cycle records the choice first, so every later write can reference it.
    const cycle = await selectPathForCycle(path);

    // 2 — one primary focus at a time. A previously chosen path also drops back
    // out of 'active', so it can never be picked up as the path being tested.
    await Promise.all(
      allPaths
        .filter(p => p.id !== path.id && (p.is_primary_focus || p.status === 'active'))
        .map(p => base44.entities.PathRecommendations.update(p.id, {
          is_primary_focus: false,
          ...(p.status === 'active' ? { status: 'exploring' } : {}),
        }))
    );
    await base44.entities.PathRecommendations.update(path.id, {
      status: 'active',
      is_primary_focus: true,
      started_at: path.started_at || new Date().toISOString().split('T')[0],
      last_active_at: new Date().toISOString().split('T')[0],
    });

    // 3 + 4 — exactly one experiment, correctly linked.
    const links = { user_id, cycle_id: cycle.id, path_id: path.id, path_name: path.path_name };
    let experiment = await findExistingExperiment(path, cycle);
    if (experiment) {
      const patch = {};
      if (!experiment.cycle_id) patch.cycle_id = cycle.id;
      if (!experiment.path_id) patch.path_id = path.id;
      if (!experiment.user_id) patch.user_id = user_id;
      if (!experiment.path_name) patch.path_name = path.path_name;
      if (Object.keys(patch).length) {
        experiment = await base44.entities.Experiments.update(experiment.id, patch);
      }
    } else {
      experiment = await base44.entities.Experiments.create({
        ...links,
        path_recommendation_id: path.id,
        title: path.first_experiment || `First test: ${path.path_name}`,
        objective: path.first_experiment
          ? `Run this test and record what it tells you about ${path.path_name}.`
          : `Find out what working in ${path.path_name} actually feels like.`,
        expected_learning: path.fit_reason || path.why_it_fits || undefined,
        status: 'planned',
        estimated_hours: path.weekly_hours || undefined,
      });
    }

    // 5 — cycle moves to experiment_active.
    const updatedCycle = await attachExperimentToCycle(experiment);

    await trackPilotEvent('path_selected', { cycle_id: cycle.id, path_id: path.id, dedupe_key: `${cycle.id}:${path.id}` });
    await trackPilotEvent('experiment_started', {
      cycle_id: cycle.id, path_id: path.id, experiment_id: experiment.id, dedupe_key: experiment.id,
    });

    return { path, experiment, cycle: updatedCycle };
  });
}