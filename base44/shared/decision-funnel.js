/**
 * The decision-cycle funnel, computed from events, with internal accounts held
 * apart from real students.
 *
 * Two independent readings come out of here and are deliberately NOT merged:
 *
 *   event-derived    what students demonstrably did. Only events emitted by the
 *                    instrumented product count, so it starts at the moment the
 *                    instrumentation shipped and says nothing about before.
 *   record-derived   what the stored rows imply. Available for all of history,
 *                    but a row cannot prove a student saw, opened or progressed
 *                    through anything, so every stage here is marked as an
 *                    inference rather than an observation.
 *
 * Nothing in this module writes, deletes or rewrites anything.
 */

export const ANALYTICS_CLASSES = [
  'real_beta_user', 'founder', 'admin', 'internal_test', 'automated_test_agent', 'unclassified',
];

/** Counted as real students by default. Everything else is excluded. */
export const REAL_CLASSES = ['real_beta_user'];
/** Known-internal. Never counted, and reported separately so the split is visible. */
export const INTERNAL_CLASSES = ['founder', 'admin', 'internal_test', 'automated_test_agent'];

/**
 * The ordered admin funnel. `event` is what proves the stage; `viaRecord`
 * describes how the same stage is inferred from stored rows for history.
 */
export const FUNNEL_STAGES = [
  { key: 'onboarding_completed', label: 'Onboarding completed', event: 'onboarding_completed', viaRecord: 'profile' },
  { key: 'paths_generated', label: 'Paths generated', event: 'paths_generated', viaRecord: 'path' },
  { key: 'path_investigated', label: 'Path investigated', event: 'path_investigated', viaRecord: null },
  { key: 'experiment_recommended', label: 'Experiment recommended', event: 'experiment_recommended', viaRecord: null },
  { key: 'experiment_selected', label: 'Experiment selected', event: 'experiment_selected', viaRecord: 'experiment' },
  { key: 'pre_expectation_completed', label: 'Pre-expectations recorded', event: 'pre_expectation_completed', viaRecord: 'measurement_pre' },
  { key: 'experiment_started', label: 'Experiment started', event: 'experiment_started', viaRecord: 'experiment_in_progress' },
  { key: 'experiment_completed', label: 'Experiment completed', event: 'experiment_completed', viaRecord: 'experiment_completed' },
  { key: 'evidence_completed', label: 'Evidence submitted', event: 'evidence_completed', viaRecord: 'proof' },
  { key: 'post_experiment_completed', label: 'Post-experience recorded', event: 'post_experiment_completed', viaRecord: 'measurement_post' },
  { key: 'reflection_completed', label: 'Reflection completed', event: 'reflection_completed', viaRecord: 'reflection' },
  { key: 'path_updated', label: 'Path updated', event: 'path_updated', viaRecord: 'hypothesis_update' },
  { key: 'decision_completed', label: 'Decision made', event: 'decision_completed', viaRecord: 'decision' },
  { key: 'next_experiment_recommended', label: 'Next test recommended', event: 'next_experiment_recommended', viaRecord: null },
  { key: 'repeat_path_test_started', label: 'Next test started', event: 'repeat_path_test_started', viaRecord: null },
  { key: 'cycle_completed', label: 'Cycle completed', event: 'cycle_completed', viaRecord: 'cycle' },
  { key: 'repeat_cycle_completed', label: 'Repeat cycle completed', event: 'repeat_cycle_completed', viaRecord: 'second_conclusion' },
];

/**
 * Stages that sit beside the cycle rather than inside it: optional or
 * supplementary steps whose absence is not drop-off.
 */
export const SIDE_STAGES = [
  { key: 'scenario_shown', label: 'Scenario shown', event: 'scenario_shown' },
  { key: 'scenario_answered', label: 'Scenario answered', event: 'scenario_answered' },
  { key: 'experiment_feedback_submitted', label: 'Experiment feedback sent', event: 'experiment_feedback_submitted' },
  { key: 'human_reality_recommended', label: 'Conversation recommended', event: 'human_reality_recommended' },
  { key: 'professional_conversation_completed', label: 'Conversation completed', event: 'professional_conversation_completed' },
  { key: 'human_evidence_submitted', label: 'Human evidence submitted', event: 'human_evidence_submitted' },
];

/**
 * What a completed decision cycle requires. Creating an experiment is not on
 * this list, and cannot be: it is the one thing the product does on the
 * student's behalf.
 */
export const CYCLE_REQUIRED = [
  'experiment_selected',
  'pre_expectation_completed',
  'experiment_completed',
  'evidence_completed',
  'post_experiment_completed',
  'reflection_completed',
  'decision_completed',
];

const time = (v) => {
  if (!v) return null;
  const raw = String(v);
  const t = new Date(/Z|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`).getTime();
  return Number.isFinite(t) ? t : null;
};

const median = (xs) => {
  const s = xs.filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null);
const HOUR = 3600000;

/** classOf: the stored classification, defaulting to unclassified rather than guessed. */
export function classifyUsers(users = []) {
  const byId = new Map();
  const counts = Object.fromEntries(ANALYTICS_CLASSES.map(c => [c, 0]));
  (users || []).forEach(u => {
    const cls = ANALYTICS_CLASSES.includes(u?.analytics_class) ? u.analytics_class : 'unclassified';
    byId.set(u.id, cls);
    counts[cls] += 1;
  });
  return { byId, counts, total: (users || []).length };
}

/**
 * The event funnel.
 * @param include which classes count. Defaults to real students only.
 */
export function eventFunnel({ events = [], users = [], include = REAL_CLASSES } = {}) {
  const { byId, counts, total } = classifyUsers(users);
  const allowed = new Set(include);

  /**
   * The ACCOUNT's current classification decides, not the class stamped on the
   * row when it was written.
   *
   * This ordering is the whole point of the exercise: most of the existing
   * activity was recorded before anyone was classified, and the fix for
   * founder and QA runs polluting the numbers is to classify the account and
   * have its whole history follow. If the stamp won, an account marked
   * internal_test today would keep counting as a real student for everything it
   * did yesterday, which is the bug this endpoint exists to remove.
   *
   * The stamp is the fallback, for a row whose account no longer exists or was
   * not in the page of accounts read. Neither path guesses: an account nobody
   * classified is unclassified, and unclassified is not counted as real.
   */
  /* user_id first, created_by_id second. A backfilled row is created by the
     service role on the student's behalf, so created_by_id is not the student —
     reading it first would attribute their whole history to the admin who ran
     the backfill. Live events carry the same value in both. */
  const classOf = (row) => {
    const current = byId.get(row?.user_id) || byId.get(row?.created_by_id) || null;
    if (current && current !== 'unclassified') return current;
    const stamped = ANALYTICS_CLASSES.includes(row?.analytics_class) ? row.analytics_class : null;
    return current || stamped || 'unclassified';
  };

  const rows = (events || []).filter(e => allowed.has(classOf(e)));
  const byStage = new Map();
  const firstAt = new Map(); // `${userId}:${stage}` → earliest ms

  rows.forEach(e => {
    const userId = e.user_id || e.created_by_id || 'unknown';
    const at = time(e.occurred_at || e.created_date);
    if (!byStage.has(e.event_name)) byStage.set(e.event_name, { records: 0, students: new Set(), backfilled: 0 });
    const bucket = byStage.get(e.event_name);
    bucket.records += 1;
    if (e.analytics_backfill) bucket.backfilled += 1;
    bucket.students.add(userId);
    const key = `${userId}:${e.event_name}`;
    if (at !== null && (!firstAt.has(key) || at < firstAt.get(key))) firstAt.set(key, at);
  });

  const entry = byStage.get(FUNNEL_STAGES[0].key)?.students?.size || 0;
  let previous = null;

  const stages = FUNNEL_STAGES.map(stage => {
    const bucket = byStage.get(stage.event) || { records: 0, students: new Set(), backfilled: 0 };
    const students = bucket.students.size;

    // Median hours from the previous stage, per student who reached both.
    let medianHours = null;
    if (previous) {
      const gaps = [...bucket.students].map(u => {
        const a = firstAt.get(`${u}:${previous.event}`);
        const b = firstAt.get(`${u}:${stage.event}`);
        return a !== undefined && b !== undefined && b >= a ? (b - a) / HOUR : null;
      });
      const m = median(gaps);
      medianHours = m === null ? null : Math.round(m * 10) / 10;
    }

    const row = {
      key: stage.key,
      label: stage.label,
      event: stage.event,
      students,
      records: bucket.records,
      // How much of this stage came from the records backfill rather than from
      // observed behaviour. Kept visible: a stage that is entirely backfilled
      // says a milestone happened, never that a student was seen doing it.
      backfilled_records: bucket.backfilled || 0,
      // The entry stage has nothing to convert from, and with nobody there it
      // must not read as 100%.
      conversion_from_previous: previous ? pct(students, previous.students) : (students > 0 ? 100 : null),
      conversion_from_entry: pct(students, entry),
      dropped_from_previous: previous ? Math.max(0, previous.students - students) : 0,
      median_hours_from_previous: medianHours,
      event_backed: true,
    };
    previous = row;
    return row;
  });

  // The optional steps beside the cycle. Reported separately so a low count
  // never reads as drop-off in the cycle itself.
  const side = SIDE_STAGES.map(s => {
    const bucket = byStage.get(s.event) || { records: 0, students: new Set(), backfilled: 0 };
    return {
      key: s.key, label: s.label, event: s.event,
      students: bucket.students.size, records: bucket.records,
      backfilled_records: bucket.backfilled || 0,
      event_backed: true,
    };
  });

  return {
    stages,
    side_stages: side,
    entry_students: entry,
    included_classes: include,
    class_counts: counts,
    accounts: total,
    events_considered: rows.length,
    events_total: (events || []).length,
  };
}

/**
 * Completed cycles, per student and per path.
 *
 * A cycle is keyed by experiment: the experiment a student selected is the unit
 * of work, and every required event carries its id. Repeat cycles on the SAME
 * path are the number the pilot cares about, so paths are grouped and their
 * cycles ordered in time.
 */
export function cycleMetrics({ events = [], users = [], include = REAL_CLASSES } = {}) {
  const { byId } = classifyUsers(users);
  const allowed = new Set(include);
  // Same precedence as eventFunnel: the account's current class decides.
  const classOf = (row) => {
    const current = byId.get(row?.user_id) || byId.get(row?.created_by_id) || null;
    if (current && current !== 'unclassified') return current;
    return current || (ANALYTICS_CLASSES.includes(row?.analytics_class) ? row.analytics_class : null) || 'unclassified';
  };

  // experimentKey → { user, path, events: Map<name, ms> }
  const work = new Map();
  (events || []).forEach(e => {
    if (!allowed.has(classOf(e))) return;
    if (!e.experiment_id) return;
    const user = e.user_id || e.created_by_id || 'unknown';
    const key = `${user}:${e.experiment_id}`;
    if (!work.has(key)) work.set(key, { user, path_id: e.path_id || null, experiment_id: e.experiment_id, at: new Map() });
    const row = work.get(key);
    if (!row.path_id && e.path_id) row.path_id = e.path_id;
    const at = time(e.occurred_at || e.created_date);
    if (at !== null && (!row.at.has(e.event_name) || at < row.at.get(e.event_name))) row.at.set(e.event_name, at);
  });

  const attempts = [...work.values()].map(row => {
    const missing = CYCLE_REQUIRED.filter(name => !row.at.has(name));
    const startedAt = row.at.get('experiment_selected') ?? row.at.get('experiment_started') ?? null;
    const completedAt = missing.length ? null : Math.max(...CYCLE_REQUIRED.map(n => row.at.get(n)));
    return {
      user: row.user,
      path_id: row.path_id,
      experiment_id: row.experiment_id,
      started_at: startedAt,
      completed_at: completedAt,
      complete: missing.length === 0,
      // Where an incomplete attempt actually stopped, which is the only honest
      // way to talk about abandonment.
      furthest_stage: [...CYCLE_REQUIRED].filter(n => row.at.has(n)).slice(-1)[0] || null,
      missing,
    };
  });

  // Per student + path.
  const perPath = new Map();
  attempts.forEach(a => {
    const key = `${a.user}:${a.path_id || 'unknown_path'}`;
    if (!perPath.has(key)) perPath.set(key, { user: a.user, path_id: a.path_id, attempts: [] });
    perPath.get(key).attempts.push(a);
  });

  const paths = [...perPath.values()].map(row => {
    const ordered = [...row.attempts].sort((a, b) => (a.started_at || 0) - (b.started_at || 0));
    const completed = ordered.filter(a => a.complete).sort((a, b) => a.completed_at - b.completed_at);
    const gaps = completed.slice(1).map((c, i) => (c.completed_at - completed[i].completed_at) / HOUR);
    const nth = (n) => ({
      started_at: ordered[n]?.started_at || null,
      completed_at: completed[n]?.completed_at || null,
    });
    return {
      user: row.user,
      path_id: row.path_id,
      tests_started: ordered.filter(a => a.started_at).length,
      cycles_completed: completed.length,
      first: nth(0),
      second: nth(1),
      third: nth(2),
      median_hours_between_cycles: gaps.length ? Math.round(median(gaps)) : null,
      furthest_stage_of_incomplete: ordered.filter(a => !a.complete).map(a => a.furthest_stage),
    };
  });

  const students = [...new Set(paths.map(p => p.user))];
  const perStudent = students.map(u => {
    const rows = paths.filter(p => p.user === u);
    return {
      user: u,
      paths_tested: rows.length,
      cycles_completed: rows.reduce((a, p) => a + p.cycles_completed, 0),
      max_cycles_on_one_path: Math.max(0, ...rows.map(p => p.cycles_completed)),
    };
  });

  const withOne = perStudent.filter(s => s.cycles_completed >= 1).length;
  const withTwoSame = perStudent.filter(s => s.max_cycles_on_one_path >= 2).length;
  const withThreeSame = perStudent.filter(s => s.max_cycles_on_one_path >= 3).length;

  return {
    attempts_total: attempts.length,
    cycles_completed_total: attempts.filter(a => a.complete).length,
    students_with_a_completed_cycle: withOne,
    students_with_two_cycles_same_path: withTwoSame,
    students_with_three_cycles_same_path: withThreeSame,
    repeat_cycle_rate: pct(withTwoSame, withOne),
    median_hours_between_cycles: median(paths.map(p => p.median_hours_between_cycles).filter(n => n !== null)),
    // Where incomplete attempts actually stopped. Absent from this list means
    // no event proves anyone stopped there, not that nobody did.
    stopped_after: CYCLE_REQUIRED.reduce((acc, name) => {
      acc[name] = attempts.filter(a => !a.complete && a.furthest_stage === name).length;
      return acc;
    }, {}),
    per_path: paths,
    per_student: perStudent,
  };
}

/**
 * The same funnel inferred from stored records, for the history that predates
 * instrumentation. Every stage is an inference; the three view/recommendation
 * stages are simply unavailable, because no record has ever implied them.
 */
export function recordFunnel({ users = [], profiles = [], paths = [], experiments = [], measurements = [], proof = [], reflections = [], updates = [], include = REAL_CLASSES } = {}) {
  const { byId } = classifyUsers(users);
  const allowed = new Set(include);
  const mine = (rows) => (rows || []).filter(r => allowed.has(byId.get(r?.created_by_id) || 'unclassified'));
  const owner = (r) => r.created_by_id || r.user_id || 'unknown';
  const uniq = (rows) => new Set(rows.map(owner)).size;

  const p = mine(profiles);
  const pathRows = mine(paths);
  const exp = mine(experiments).filter(e => e.deletion_status !== 'deleted' && e.deletion_status !== 'permanently_deleted');
  const ms = mine(measurements);
  const pf = mine(proof);
  const rf = mine(reflections);
  const up = mine(updates);
  const conclusions = rf.filter(r => r.is_experiment_conclusion);

  const rows = [
    { key: 'onboarding_completed', label: 'Onboarding completed', students: uniq(p), records: p.length, basis: 'A StudentProfile row exists' },
    { key: 'paths_generated', label: 'Paths generated', students: uniq(pathRows), records: pathRows.length, basis: 'PathRecommendations rows exist' },
    { key: 'path_investigated', label: 'Path investigated', students: null, records: null, basis: 'Not reconstructable: no record implies a path was read' },
    { key: 'experiment_recommended', label: 'Experiment recommended', students: null, records: null, basis: 'Not reconstructable: recommendations were never stored' },
    { key: 'experiment_selected', label: 'Experiment selected', students: uniq(exp), records: exp.length, basis: 'An Experiments row exists. This proves creation, NOT that a student chose it' },
    { key: 'pre_expectation_completed', label: 'Pre-expectations recorded', students: uniq(ms.filter(m => m.pre_completed_at)), records: ms.filter(m => m.pre_completed_at).length, basis: 'ExperimentMeasurement.pre_completed_at' },
    { key: 'experiment_started', label: 'Experiment started', students: uniq(exp.filter(e => e.status === 'in_progress' || e.status === 'completed')), records: exp.filter(e => e.status === 'in_progress' || e.status === 'completed').length, basis: 'Experiment status reached in_progress or completed' },
    { key: 'experiment_completed', label: 'Experiment completed', students: uniq(exp.filter(e => e.status === 'completed')), records: exp.filter(e => e.status === 'completed').length, basis: 'Experiment status is completed' },
    { key: 'evidence_completed', label: 'Evidence submitted', students: uniq(pf), records: pf.length, basis: 'ProofOfWork rows exist' },
    { key: 'post_experiment_completed', label: 'Post-experience recorded', students: uniq(ms.filter(m => m.post_completed_at)), records: ms.filter(m => m.post_completed_at).length, basis: 'ExperimentMeasurement.post_completed_at' },
    { key: 'reflection_completed', label: 'Reflection completed', students: uniq(conclusions), records: conclusions.length, basis: 'A WeeklyReflections conclusion row exists' },
    { key: 'path_updated', label: 'Path updated', students: uniq(up.filter(u => u.stage === 'update')), records: up.filter(u => u.stage === 'update').length, basis: 'HypothesisUpdate rows at stage update' },
    { key: 'decision_completed', label: 'Decision made', students: uniq(up.filter(u => u.decision)), records: up.filter(u => u.decision).length, basis: 'HypothesisUpdate carries a decision' },
  ];

  const entry = rows[0].students || 0;
  let prev = null;
  const stages = rows.map(r => {
    const out = {
      ...r,
      event_backed: false,
      conversion_from_previous: r.students === null || !prev?.students ? null : pct(r.students, prev.students),
      conversion_from_entry: r.students === null ? null : pct(r.students, entry),
    };
    if (r.students !== null) prev = r;
    return out;
  });

  // Record-derived repeat cycles: conclusions per student and path.
  const byUserPath = new Map();
  conclusions.forEach(r => {
    const key = `${owner(r)}:${r.path_id || r.path_name || 'unknown_path'}`;
    byUserPath.set(key, (byUserPath.get(key) || 0) + 1);
  });
  const counts = [...byUserPath.values()];

  return {
    stages,
    repeat: {
      students_with_a_conclusion: new Set(conclusions.map(owner)).size,
      path_runs_with_two_conclusions: counts.filter(n => n >= 2).length,
      path_runs_with_three_conclusions: counts.filter(n => n >= 3).length,
    },
    caveat: 'Record-derived. A stored row proves a record exists; it cannot prove a student saw, opened, or progressed through anything. Do not read drop-off from these numbers.',
  };
}

/** What can and cannot be rebuilt for history, stated once, in one place. */
export const RECONSTRUCTION = {
  reconstructable: [
    { stage: 'Onboarding completed', from: 'StudentProfile rows' },
    { stage: 'Paths generated', from: 'PathRecommendations rows' },
    { stage: 'Pre-expectations / post-experience', from: 'ExperimentMeasurement timestamps' },
    { stage: 'Experiment completed', from: 'Experiments.status and status_history' },
    { stage: 'Evidence submitted', from: 'ProofOfWork rows' },
    { stage: 'Reflection completed', from: 'WeeklyReflections conclusion rows' },
    { stage: 'Path updated / decision made', from: 'HypothesisUpdate rows' },
    { stage: 'Repeat cycles per path', from: 'Conclusion rows grouped by path' },
  ],
  not_reconstructable: [
    { stage: 'Path investigated', why: 'Reading a path was never recorded' },
    { stage: 'Experiment recommended', why: 'Recommendations were computed at render time and never stored' },
    { stage: 'Experiment card viewed / detail viewed', why: 'No view was ever recorded' },
    { stage: 'Experiment selected (as distinct from generated)', why: 'Creation and selection share one row, so historically they are indistinguishable' },
    { stage: 'Step-level progress and the 25/50/75 thresholds', why: 'Guide progress stores current state, not the moment each step was crossed' },
    { stage: 'Historical account classification', why: 'Not stored at the time. Left unclassified rather than guessed' },
  ],
};

export default eventFunnel;