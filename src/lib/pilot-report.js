/**
 * Pilot reporting — aggregate only.
 *
 * Everything here is computed from PilotEvent rows (ids, numbers, timestamps)
 * and the User list. It deliberately never reads ProofOfWork, WeeklyReflections,
 * OutreachContacts, Resume or StudentProfile, so private reflections, uploaded
 * proof, contact notes, resume content, onboarding answers and individual files
 * can never reach this dashboard.
 */
import { base44 } from '@/api/base44Client';

/** The funnel, in order. Label + the event that proves the student reached it. */
export const FUNNEL = [
  ['Registrations', 'signup_completed'],
  ['Onboarding started', 'onboarding_started'],
  ['Onboarding completion', 'onboarding_completed'],
  ['Paths generated', 'paths_generated'],
  ['All paths viewed', 'all_paths_viewed'],
  ['Path selected', 'path_selected'],
  ['Experiment starts', 'experiment_started'],
  ['Mission completion', 'mission_completed'],
  ['Proof submissions', 'proof_submitted'],
  ['Reflection completion', 'reflection_completed'],
  ['Full-cycle completion', 'cycle_completed'],
];

const uniq = (rows) => new Set(rows.map(r => r.user_id).filter(Boolean)).size;
const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);

/**
 * @param {object} [filter] { institution_id, cohort_id, access_source }
 */
export async function loadPilotReport(filter = {}) {
  const [events, users] = await Promise.all([
    base44.entities.PilotEvent.list('-occurred_at', 5000).catch(() => []),
    base44.entities.User.list('-created_date', 2000).catch(() => []),
  ]);

  const all = (Array.isArray(events) ? events : []).filter(e => {
    if (filter.institution_id && e.institution_id !== filter.institution_id) return false;
    if (filter.cohort_id && e.cohort_id !== filter.cohort_id) return false;
    if (filter.access_source && e.access_source !== filter.access_source) return false;
    return true;
  });

  const byEvent = (name) => all.filter(e => e.event_name === name);
  const firstAt = new Map(); // `${user}:${event}` → ms of first occurrence
  all.forEach(e => {
    const key = `${e.user_id}:${e.event_name}`;
    const t = new Date(e.occurred_at || e.created_date).getTime();
    if (!Number.isFinite(t)) return;
    if (!firstAt.has(key) || t < firstAt.get(key)) firstAt.set(key, t);
  });

  // Funnel + stage-by-stage drop-off, measured in unique students.
  const funnel = [];
  FUNNEL.forEach(([label, event], i) => {
    const count = uniq(byEvent(event));
    const prev = i === 0 ? count : funnel[i - 1].count;
    funnel.push({
      label,
      event,
      count,
      dropOffFromPrevious: prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0,
    });
  });

  // Time from signup to each stage, in days (median-free mean, one per student).
  const timeToStage = FUNNEL.slice(1).map(([label, event]) => {
    const days = [];
    byEvent(event).forEach(e => {
      const start = firstAt.get(`${e.user_id}:signup_completed`);
      const reached = firstAt.get(`${e.user_id}:${event}`);
      if (start && reached && reached >= start) days.push((reached - start) / 86400000);
    });
    const mean = avg(days);
    return { label, days: mean == null ? null : Math.round(mean * 10) / 10, students: days.length };
  });

  // Clarity change: cycle_completed carries the post-cycle score in `value` and
  // the baseline in `stage`. Numbers only — no reflection text is involved.
  const clarityDeltas = byEvent('cycle_completed')
    .map(e => ({ post: Number(e.value), base: Number(e.stage) }))
    .filter(d => Number.isFinite(d.post) && Number.isFinite(d.base))
    .map(d => d.post - d.base);
  const clarityMean = avg(clarityDeltas);

  const registered = uniq(byEvent('signup_completed'));
  const cycleCompleters = uniq(byEvent('cycle_completed'));
  const secondAttempts = uniq(byEvent('second_cycle_attempted'));

  // Cohort-level completion.
  const cohorts = {};
  all.forEach(e => {
    const key = e.cohort_id || (e.institution_id ? `${e.institution_id} (no cohort)` : 'Independent / no cohort');
    cohorts[key] = cohorts[key] || { started: new Set(), completed: new Set() };
    if (e.event_name === 'signup_completed') cohorts[key].started.add(e.user_id);
    if (e.event_name === 'cycle_completed') cohorts[key].completed.add(e.user_id);
  });

  const institutions = [...new Set(all.map(e => e.institution_id).filter(Boolean))];
  const cohortIds = [...new Set(all.map(e => e.cohort_id).filter(Boolean))];

  return {
    // Invitations = accounts that exist (users join Unscripted by invite);
    // registrations = accounts that actually completed a first sign-in.
    invitations: Array.isArray(users) ? users.length : 0,
    registrations: registered,
    funnel,
    timeToStage,
    returnEngagement: {
      sevenDay: uniq(byEvent('seven_day_return')),
      thirtyDay: uniq(byEvent('thirty_day_return')),
    },
    fullCycleRate: registered ? Math.round((cycleCompleters / registered) * 100) : 0,
    secondCycleRate: cycleCompleters ? Math.round((secondAttempts / cycleCompleters) * 100) : 0,
    continuationInterestRecorded: uniq(byEvent('continuation_interest_recorded')),
    averageClarityChange: clarityMean == null ? null : Math.round(clarityMean * 10) / 10,
    clarityStudents: clarityDeltas.length,
    cohorts: Object.entries(cohorts).map(([name, v]) => ({
      name,
      started: v.started.size,
      completed: v.completed.size,
      rate: v.started.size ? Math.round((v.completed.size / v.started.size) * 100) : 0,
    })).sort((a, b) => b.started - a.started),
    filterOptions: { institutions, cohorts: cohortIds },
    totalEvents: all.length,
  };
}