/**
 * THE SOURCE-OF-TRUTH RULE for "which hypothesis is the student testing".
 *
 *   The active CareerCycle's `selected_path_id` is authoritative.
 *   `PathRecommendations.is_primary_focus` is DERIVED DISPLAY STATE.
 *
 * Why the cycle wins: every experiment, proof row, reflection and decision is
 * already stamped with a cycle_id and reaches its path through the cycle, so the
 * cycle is the record the rest of the system hangs off. A boolean spread across
 * three sibling rows is not a relationship; it is a cache of one.
 *
 * Consequences, held in one place so no screen re-derives them differently:
 *  - Core logic (stage resolution, the recommendation engine, the Decision
 *    Matrix) resolves the current hypothesis through `resolveCurrentPath`.
 *  - `is_primary_focus` may be written only to keep it in step with the cycle.
 *    `syncPrimaryFocus` is the one writer. Nothing reads it on its own except as
 *    a fallback for a student who has no cycle yet (legacy accounts).
 *  - Selecting a hypothesis writes the cycle first and the flag second, which is
 *    the order `selectPathAndBeginExperiment` already used.
 */
import { base44 } from '@/api/base44Client';

/**
 * The hypothesis being tested.
 * @param cycle the active CareerCycle, or null
 * @param paths the student's live path rows
 */
export function resolveCurrentPath(cycle, paths = []) {
  const live = paths.filter(p => p.status !== 'archived' && p.integrity_status !== 'merged');
  if (cycle?.selected_path_id) {
    const byId = live.find(p => p.id === cycle.selected_path_id);
    if (byId) return byId;
  }
  if (cycle?.selected_path_name) {
    const byName = live.find(p => p.path_name === cycle.selected_path_name);
    if (byName) return byName;
  }
  // No cycle, or a cycle pointing at a row that no longer exists: fall back to
  // the derived flag so legacy accounts still resolve.
  return live.find(p => p.is_primary_focus) || live.find(p => p.status === 'active') || null;
}

/**
 * Brings `is_primary_focus` back in line with the cycle. Writes only when a row
 * actually disagrees, so a correct account is never touched.
 */
export async function syncPrimaryFocus(cycle, paths = []) {
  const current = resolveCurrentPath(cycle, paths);
  if (!current) return null;
  const wrong = paths.filter(p => Boolean(p.is_primary_focus) !== (p.id === current.id));
  if (!wrong.length) return current;
  await Promise.allSettled(
    wrong.map(p => base44.entities.PathRecommendations.update(p.id, { is_primary_focus: p.id === current.id }))
  );
  return current;
}