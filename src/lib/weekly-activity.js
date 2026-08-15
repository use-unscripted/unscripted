/**
 * What a student actually logged against one experiment during one week.
 *
 * Lives here rather than inside the reflection page because "which week does
 * this row belong to" is the only part of that page that has ever been wrong,
 * and it is the part worth having tests for. See src/lib/weekly-activity.test.js.
 *
 * Everything is filtered to one experiment id, and the experiment list that id
 * came from is itself row-level-scoped to the signed-in user. That filter is
 * load-bearing for proof: ProofOfWork has `"read": null` in the schema, so
 * ProofOfWork.list() returns *every student's* proof. Removing it puts another
 * student's work on this screen.
 */
import { inWeek } from '@/lib/dates';

const isActive = (r) => !r?.deletion_status || r.deletion_status === 'active';

/**
 * @param {{missions?: object[], proofs?: object[]}} data
 * @param {string} expId
 * @param {string} weekKey  'YYYY-MM-DD' Monday
 * @returns {{key: string, label: string, desc: string}[]}
 */
export function activityFor({ missions = [], proofs = [] }, expId, weekKey) {
  if (!expId || !weekKey) return [];
  const items = [];

  missions
    .filter(m => isActive(m) && m.experiment_id === expId && m.status === 'completed')
    // `completed_at` is written by src/lib/mission-completion.js at the moment
    // the mission is marked complete, and never again. `updated_date` used to
    // be read here and is not a completion time at all — ANY later edit bumps
    // it, and the 2026-08-01 backfill bumped all seven production missions
    // within one second, which would have refiled every one of them under that
    // week. `created_date` is the fallback for a row completed before the field
    // started being written; it can be early, but unlike `updated_date` it
    // never moves. Same shape as the two branches below, which were already
    // right.
    .filter(m => inWeek(m.completed_at || m.created_date, weekKey))
    .forEach(m => items.push({ key: `mission:${m.id}`, label: m.title, desc: 'Mission you marked complete' }));

  proofs
    .filter(p => isActive(p) && p.experiment_id === expId)
    .filter(p => inWeek(p.completed_at || p.created_date, weekKey))
    .forEach(p => items.push({ key: `proof:${p.id}`, label: p.title, desc: 'Proof you logged' }));

  return items.filter(i => i.label);
}