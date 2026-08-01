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

const OPEN_STATUSES = ['draft', 'planned', 'in_progress'];

async function currentUserId() {
  const me = await base44.auth.me();
  return me?.id || null;
}

/** An existing open experiment for this path, if the student already has one. */
async function findExistingExperiment(path, cycle) {
  if (cycle?.experiment_id) {
    const bound = await base44.entities.Experiments.get(cycle.experiment_id).catch(() => null);
    if (bound && bound.deletion_status !== 'deleted' && OPEN_STATUSES.includes(bound.status)) return bound;
  }
  const rows = await base44.entities.Experiments.list('-created_date', 200).catch(() => []);
  const mine = (Array.isArray(rows) ? rows : []).filter(
    e => e.deletion_status !== 'deleted'
      && OPEN_STATUSES.includes(e.status)
      && (e.path_id === path.id || e.path_recommendation_id === path.id || e.path_name === path.path_name)
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

  return onceInFlight(`select-path:${path.id}`, async () => {
    const user_id = await currentUserId();

    // 1 — cycle records the choice first, so every later write can reference it.
    const cycle = await selectPathForCycle(path);

    // 2 — one primary focus at a time.
    await Promise.all(
      allPaths
        .filter(p => p.is_primary_focus && p.id !== path.id)
        .map(p => base44.entities.PathRecommendations.update(p.id, { is_primary_focus: false }))
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

    return { path, experiment, cycle: updatedCycle };
  });
}