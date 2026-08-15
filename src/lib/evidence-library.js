/**
 * Evidence library — organisation only.
 *
 * Every record here is already owned by the signed-in student (all of these
 * entities are owner-scoped), so this module never widens visibility: it groups,
 * labels and filters what the student already has.
 */
import { entityTime, localDayStart, localDayStartPlus } from '@/lib/dates';

const live = (r) => r && r.deletion_status !== 'deleted' && r.deletion_status !== 'permanently_deleted';

export const VISIBILITY_LABELS = {
  private: 'Private',
  public: 'Shared',
  followers: 'Followers',
  my_university: 'My university',
  all_unscripted: 'All Unscripted',
};

export function typeLabel(category) {
  if (!category) return 'Other';
  return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Build the enriched library: evidence items + one record per career cycle. */
export function buildLibrary({ cycles = [], paths = [], experiments = [], missions = [], proof = [], outreach = [], reflections = [] }) {
  const exps = experiments.filter(live);
  const mis = missions.filter(live);
  const out = outreach.filter(live);
  const refs = reflections.filter(live);
  const byId = (arr) => new Map(arr.map((r) => [r.id, r]));
  const expMap = byId(exps);
  const misMap = byId(mis);

  const cycleLabel = (c) => (c ? `${c.selected_path_name || 'Unassigned path'}, started ${fmtDate(c.started_at || c.created_date)}` : 'No cycle');
  const cycleMap = byId(cycles);

  const evidence = proof.filter(live).map((p) => {
    const experiment = p.experiment_id ? expMap.get(p.experiment_id) : null;
    const mission = p.mission_id ? misMap.get(p.mission_id) : null;
    const cycleId = p.cycle_id || experiment?.cycle_id || '';
    const cycle = cycleId ? cycleMap.get(cycleId) : null;
    return {
      proof: p,
      id: p.id,
      title: p.title,
      type: p.category || 'other',
      date: p.completed_at || p.created_date,
      pathName: p.path_tested || experiment?.path_name || cycle?.selected_path_name || '',
      cycleId,
      cycleLabel: cycle ? cycleLabel(cycle) : '',
      experimentId: experiment?.id || '',
      experimentTitle: experiment?.title || '',
      experimentDeliverable: experiment?.deliverable || '',
      experimentTools: experiment?.tools || [],
      missionId: mission?.id || '',
      missionTitle: mission?.title || '',
      skills: p.skills_demonstrated || [],
      // The student's own reading of what this work says about the hypothesis,
      // and the question it was answering.
      interpretation: p.hypothesis_interpretation || '',
      interpretationDirection: p.interpretation_direction || '',
      interpretedTestQuestion: p.interpreted_test_question || experiment?.test_question || '',
      visibility: p.network_visibility || p.visibility || 'private',
    };
  });

  const cycleRecords = cycles.map((c) => {
    const cycleExps = exps.filter((e) => e.cycle_id === c.id);
    const expIds = new Set(cycleExps.map((e) => e.id));
    const inCycle = (r) => r.cycle_id === c.id || (r.experiment_id && expIds.has(r.experiment_id));
    return {
      cycle: c,
      label: cycleLabel(c),
      path: paths.find((p) => p.id === c.selected_path_id) || null,
      pathName: c.selected_path_name || '',
      experiments: cycleExps,
      missions: mis.filter(inCycle),
      outreach: out.filter(inCycle),
      evidence: evidence.filter((e) => e.cycleId === c.id || (e.experimentId && expIds.has(e.experimentId))),
      reflections: refs.filter(inCycle),
      decision: c.final_decision || '',
    };
  });

  return { evidence, cycleRecords };
}

export const DEFAULT_FILTERS = {
  q: '', path: 'all', cycle: 'all', experiment: 'all', mission: 'all',
  type: 'all', skill: 'all', visibility: 'all', from: '', to: '',
};

export function filterEvidence(items, f) {
  const q = f.q.trim().toLowerCase();
  return items.filter((i) => {
    if (f.path !== 'all' && i.pathName !== f.path) return false;
    if (f.cycle !== 'all' && i.cycleId !== f.cycle) return false;
    if (f.experiment !== 'all' && i.experimentId !== f.experiment) return false;
    if (f.mission !== 'all' && i.missionId !== f.mission) return false;
    if (f.type !== 'all' && i.type !== f.type) return false;
    if (f.skill !== 'all' && !i.skills.includes(f.skill)) return false;
    if (f.visibility !== 'all' && i.visibility !== f.visibility) return false;
    // From/To come from <input type="date">, so they are the student's own
    // local calendar days: the range runs local midnight to local end-of-day.
    // `i.date` is an entity timestamp, which is UTC with no `Z` on it — parsing
    // it with `new Date()` shifted it hours forward and dropped work logged in
    // the evening of the last day in the range.
    if (f.from || f.to) {
      const t = entityTime(i.date);
      if (!Number.isFinite(t)) return false;
      const from = localDayStart(f.from);
      const to = localDayStartPlus(f.to, 1); // through the end of the To day
      if (from && t < from.getTime()) return false;
      if (to && t >= to.getTime()) return false;
    }
    if (q && ![i.title, i.pathName, i.experimentTitle, i.missionTitle, i.interpretation, ...(i.skills || [])].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Option lists for the filter bar, derived from the student's own records. */
export function filterOptions(items) {
  const uniq = (vals) => [...new Set(vals.filter(Boolean))].sort();
  return {
    paths: uniq(items.map((i) => i.pathName)),
    cycles: [...new Map(items.filter((i) => i.cycleId).map((i) => [i.cycleId, i.cycleLabel])).entries()],
    experiments: [...new Map(items.filter((i) => i.experimentId).map((i) => [i.experimentId, i.experimentTitle])).entries()],
    missions: [...new Map(items.filter((i) => i.missionId).map((i) => [i.missionId, i.missionTitle])).entries()],
    types: uniq(items.map((i) => i.type)),
    skills: uniq(items.flatMap((i) => i.skills)),
    visibilities: uniq(items.map((i) => i.visibility)),
  };
}