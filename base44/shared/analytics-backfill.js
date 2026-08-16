/**
 * Backfill: funnel events for milestones that STORED RECORDS PROVE happened.
 *
 * The rule, and the reason this module is small: an event is only written where
 * a record carries a timestamp that could not exist unless the student reached
 * that milestone. Everything else is left unknown rather than invented.
 *
 * Provable, and backfilled here:
 *   onboarding_completed          a StudentProfile row exists
 *   paths_generated               PathRecommendations rows exist
 *   pre_expectation_completed     ExperimentMeasurement.pre_completed_at
 *   experiment_started            an experiment reached in_progress or completed
 *   experiment_completed          Experiments.status is completed
 *   evidence_completed            a ProofOfWork row exists
 *   post_experiment_completed     ExperimentMeasurement.post_completed_at
 *   reflection_completed          a WeeklyReflections conclusion row exists
 *   path_updated                  a HypothesisUpdate row at stage update
 *   decision_completed            a HypothesisUpdate row carries a decision
 *   cycle_completed               CareerCycle.status completed with completed_at
 *   repeat_cycle_completed        the 2nd+ completed cycle on the same path
 *   experiment_feedback_submitted ExperimentFeedback.submitted_at
 *   scenario_answered             ScenarioResponse.completed_at
 *   human_evidence_submitted      HumanRealityConversation recorded/held
 *
 * NOT provable, and deliberately never written:
 *   every view and recommendation stage, experiment_selected (creation and
 *   selection share one row historically), step progress and the 25/50/75
 *   thresholds, pre_expectation_started, evidence_started, scenario_shown,
 *   repeat_path_test_started, path_investigated, and any account's historical
 *   classification.
 *
 * Every row written carries analytics_backfill: true and a backfill_basis
 * naming the record it was derived from, so a backfilled funnel can always be
 * told apart from observed behaviour.
 */

export const BACKFILL_EVENTS = [
  'onboarding_completed', 'paths_generated', 'pre_expectation_completed',
  'experiment_started', 'experiment_completed', 'evidence_completed',
  'post_experiment_completed', 'reflection_completed', 'path_updated',
  'decision_completed', 'cycle_completed', 'repeat_cycle_completed',
  'experiment_feedback_submitted', 'scenario_answered', 'human_evidence_submitted',
];

export const NOT_BACKFILLABLE = [
  { event: 'path_investigated', why: 'Reading a path was never recorded' },
  { event: 'experiment_recommended', why: 'Recommendations were computed at render time and never stored' },
  { event: 'experiment_card_viewed', why: 'No view was ever recorded' },
  { event: 'experiment_detail_viewed', why: 'No view was ever recorded' },
  { event: 'experiment_selected', why: 'Creation and selection share one row, so historically they cannot be told apart' },
  { event: 'pre_expectation_started', why: 'Only the completed timestamp was stored' },
  { event: 'evidence_started', why: 'Only the saved evidence was stored' },
  { event: 'experiment_step_completed', why: 'Guide progress stores current state, not when each step was crossed' },
  { event: 'scenario_shown', why: 'Only answers were stored, never the render' },
  { event: 'repeat_path_test_started', why: 'A repeat start was never distinguishable from a first start in the records' },
  { event: 'analytics_class', why: 'Historical classification was not stored. Left unclassified rather than guessed' },
];

const owner = (r) => r?.created_by_id || r?.user_id || null;
const iso = (v) => {
  if (!v) return null;
  const raw = String(v);
  const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};
const alive = (rows) => (rows || []).filter(r => r && r.deletion_status !== 'deleted' && r.deletion_status !== 'permanently_deleted');

/**
 * One event payload. The dedupe key is derived from the RECORD, so running the
 * backfill twice produces the same keys and the second run writes nothing.
 */
function ev(event_name, row, { basis, occurred_at, scope, path_id, experiment_id, cycle_id, value }) {
  const user_id = owner(row);
  const at = iso(occurred_at) || iso(row?.created_date);
  if (!user_id || !at) return null;
  return {
    user_id,
    event_name,
    occurred_at: at,
    dedupe_key: `backfill:${event_name}:${scope}`,
    path_id: path_id || undefined,
    experiment_id: experiment_id || undefined,
    cycle_id: cycle_id || undefined,
    value: typeof value === 'number' ? value : undefined,
    analytics_backfill: true,
    backfill_basis: basis,
  };
}

/**
 * Builds every provable event from stored records. Pure: it writes nothing and
 * reads no clock, so the same records always produce the same events.
 */
export function buildBackfillEvents({
  profiles = [], paths = [], experiments = [], measurements = [], proof = [],
  reflections = [], updates = [], cycles = [], feedback = [], scenarios = [],
  conversations = [],
} = {}) {
  const out = [];
  const push = (e) => { if (e) out.push(e); };

  // Onboarding — one per student, at their profile's creation.
  const firstProfile = new Map();
  (profiles || []).forEach(p => {
    const u = owner(p);
    if (!u) return;
    const at = iso(p.created_date);
    if (!at) return;
    if (!firstProfile.has(u) || at < firstProfile.get(u).at) firstProfile.set(u, { row: p, at });
  });
  firstProfile.forEach(({ row, at }, u) => push(ev('onboarding_completed', row, {
    basis: 'StudentProfile row exists', occurred_at: at, scope: u,
  })));

  // Paths generated — one per student, at their earliest path row.
  const firstPath = new Map();
  (paths || []).forEach(p => {
    const u = owner(p);
    const at = iso(p.created_date);
    if (!u || !at) return;
    if (!firstPath.has(u) || at < firstPath.get(u).at) firstPath.set(u, { row: p, at });
  });
  firstPath.forEach(({ row, at }, u) => push(ev('paths_generated', row, {
    basis: 'PathRecommendations rows exist', occurred_at: at, scope: u,
  })));

  // Experiments: started and completed.
  alive(experiments).forEach(e => {
    const started = e.status === 'in_progress' || e.status === 'completed';
    const startedAt = (e.status_history || []).find(h => h?.to_status === 'in_progress')?.changed_at || e.created_date;
    if (started) {
      push(ev('experiment_started', e, {
        basis: 'Experiment status reached in_progress or completed',
        occurred_at: startedAt, scope: e.id, path_id: e.path_id, experiment_id: e.id, cycle_id: e.cycle_id,
      }));
    }
    if (e.status === 'completed') {
      const doneAt = (e.status_history || []).find(h => h?.to_status === 'completed')?.changed_at || e.updated_date || e.created_date;
      push(ev('experiment_completed', e, {
        basis: 'Experiment status is completed',
        occurred_at: doneAt, scope: e.id, path_id: e.path_id, experiment_id: e.id, cycle_id: e.cycle_id,
      }));
    }
  });

  // Measurements: the two halves, each at its own recorded timestamp.
  (measurements || []).forEach(m => {
    if (m.pre_completed_at) {
      push(ev('pre_expectation_completed', m, {
        basis: 'ExperimentMeasurement.pre_completed_at', occurred_at: m.pre_completed_at,
        scope: `${m.experiment_id || m.id}:pre`, experiment_id: m.experiment_id, cycle_id: m.cycle_id,
      }));
    }
    if (m.post_completed_at) {
      push(ev('post_experiment_completed', m, {
        basis: 'ExperimentMeasurement.post_completed_at', occurred_at: m.post_completed_at,
        scope: `${m.experiment_id || m.id}:post`, experiment_id: m.experiment_id, cycle_id: m.cycle_id,
      }));
    }
  });

  // Evidence — one per proof record.
  alive(proof).forEach(p => push(ev('evidence_completed', p, {
    basis: 'ProofOfWork row exists', occurred_at: p.created_date,
    scope: p.id, path_id: p.path_id, experiment_id: p.experiment_id, cycle_id: p.cycle_id,
  })));

  // Reflection — conclusion rows only. A weekly reflection is not a conclusion.
  alive(reflections).filter(r => r.is_experiment_conclusion).forEach(r => push(ev('reflection_completed', r, {
    basis: 'WeeklyReflections conclusion row exists', occurred_at: r.created_date,
    scope: r.id, path_id: r.path_id, experiment_id: r.experiment_id, cycle_id: r.cycle_id,
  })));

  // Hypothesis updates: the path moved, and the branch the student chose.
  (updates || []).forEach(u => {
    if (u.stage === 'update') {
      push(ev('path_updated', u, {
        basis: 'HypothesisUpdate row at stage update', occurred_at: u.recorded_at || u.created_date,
        scope: u.id, path_id: u.path_id, experiment_id: u.experiment_id, cycle_id: u.cycle_id,
        value: typeof u.sequence === 'number' ? u.sequence : undefined,
      }));
    }
    if (u.decision) {
      push(ev('decision_completed', u, {
        basis: 'HypothesisUpdate carries a decision', occurred_at: u.recorded_at || u.created_date,
        scope: `${u.id}:decision`, path_id: u.path_id, experiment_id: u.experiment_id, cycle_id: u.cycle_id,
      }));
    }
  });

  // Cycles: completed, and repeat completions on the same path.
  const perUserPath = new Map();
  (cycles || [])
    .filter(c => c.status === 'completed' && (c.completed_at || c.updated_date))
    .map(c => ({ c, at: iso(c.completed_at || c.updated_date) }))
    .filter(x => x.at && owner(x.c))
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .forEach(({ c, at }) => {
      push(ev('cycle_completed', c, {
        basis: 'CareerCycle status completed', occurred_at: at,
        scope: c.id, path_id: c.selected_path_id, experiment_id: c.experiment_id, cycle_id: c.id,
      }));
      const key = `${owner(c)}:${c.selected_path_id || 'unknown_path'}`;
      const n = (perUserPath.get(key) || 0) + 1;
      perUserPath.set(key, n);
      if (n >= 2) {
        push(ev('repeat_cycle_completed', c, {
          basis: 'Second or later completed cycle on the same path', occurred_at: at,
          scope: `${c.id}:repeat`, path_id: c.selected_path_id, experiment_id: c.experiment_id, cycle_id: c.id,
          value: n,
        }));
      }
    });

  // The experiment quality survey.
  (feedback || []).filter(f => f.submitted_at).forEach(f => push(ev('experiment_feedback_submitted', f, {
    basis: 'ExperimentFeedback.submitted_at', occurred_at: f.submitted_at,
    scope: f.id, path_id: f.path_id, experiment_id: f.experiment_id, cycle_id: f.cycle_id,
  })));

  // Scenario answers. The render was never stored, so only the answer is written.
  (scenarios || []).filter(s => s.completed_at).forEach(s => push(ev('scenario_answered', s, {
    basis: 'ScenarioResponse.completed_at', occurred_at: s.completed_at,
    scope: s.id, path_id: s.path_id, experiment_id: s.experiment_id, cycle_id: s.career_cycle_id,
  })));

  // Human Reality conversations that reached recorded evidence.
  (conversations || [])
    .filter(c => c.recorded_at || c.evidence_status === 'human_evidence_recorded')
    .forEach(c => push(ev('human_evidence_submitted', c, {
      basis: 'HumanRealityConversation recorded as evidence',
      occurred_at: c.recorded_at || c.created_date,
      scope: c.id, path_id: c.path_id, experiment_id: c.experiment_id, cycle_id: c.career_cycle_id || c.cycle_id,
    })));

  return out;
}

/** Drops anything already on file, matched on event name + dedupe key. */
export function withoutExisting(events = [], existing = []) {
  const seen = new Set((existing || [])
    .filter(e => e?.dedupe_key)
    .map(e => `${e.event_name}:${e.dedupe_key}`));
  const out = [];
  const local = new Set();
  events.forEach(e => {
    const key = `${e.event_name}:${e.dedupe_key}`;
    if (seen.has(key) || local.has(key)) return;
    local.add(key);
    out.push(e);
  });
  return out;
}

/** Counts per event name, for the report the admin screen shows. */
export function summarise(events = []) {
  return events.reduce((acc, e) => {
    acc[e.event_name] = (acc[e.event_name] || 0) + 1;
    return acc;
  }, {});
}