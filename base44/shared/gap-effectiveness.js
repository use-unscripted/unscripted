/**
 * Which Conviction Tests actually resolve which Conviction Gaps.
 *
 * The chain, end to end, per test VERSION:
 *
 *   Conviction Gap → test completed → expectation vs reality → evidence created
 *                  → conviction change → Path decision
 *
 * The first four stages are recorded on ConvictionGapOutcome as the student goes.
 * The last two are joined here from records that already exist: the confidence
 * movement measured around the test, and the Path decision the student later
 * recorded on that same path.
 *
 * Two rules this module exists to enforce:
 *
 *  1. No effectiveness claim below the sample. Under the admin threshold every
 *     rate is null and the group carries NOT_ENOUGH_DATA. Raw counts stay
 *     visible, because a count is not a conclusion.
 *  2. Grouped by the EXACT experiment version. A materially rewritten test is a
 *     different row, so it can never inherit the readings of the version that
 *     was reviewed before it.
 *
 * Pure. Nothing here writes, and nothing here returns a per-student row.
 */
import { EFFECTIVENESS_THRESHOLDS, NOT_ENOUGH_DATA, safeRate } from './effectiveness-thresholds.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const mean = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const time = (v) => Date.parse(v || '') || 0;

/** A confidence movement of a point or more counts as conviction having moved. */
const MOVED = 1;

/**
 * @param {object} data
 * @param {Array}  data.outcomes ConvictionGapOutcome rows
 * @param {Array}  data.cycles   CareerCycle rows, for the Path decision stage
 */
export function gapEffectiveness({ outcomes = [], cycles = [], thresholds = EFFECTIVENESS_THRESHOLDS } = {}) {
  const rows = Array.isArray(outcomes) ? outcomes : [];
  const completed = rows.filter(r => r.chain_stage === 'test_completed');
  const minStudents = thresholds.admin.min_students_completed;

  /* Decisions, per student and path. A decision recorded after the test is the
     last link in the chain; one recorded before it belongs to an earlier cycle
     and is deliberately not counted. */
  const decisions = (Array.isArray(cycles) ? cycles : [])
    .filter(c => c.final_decision && c.selected_path_id)
    .map(c => ({
      student: c.created_by_id,
      path_id: c.selected_path_id,
      decision: c.final_decision,
      at: time(c.completed_at || c.updated_date || c.created_date),
    }));

  const decisionFor = (row) => decisions
    .filter(d => d.student === row.created_by_id && d.path_id === row.path_id && d.at >= time(row.test_completed_at))
    .sort((a, b) => a.at - b.at)[0] || null;

  const groups = new Map();
  completed.forEach(row => {
    const version = num(row.experiment_version);
    const key = [row.gap_area || 'Unassigned gap', row.blueprint_key || row.experiment_title || 'Unversioned test', version === null ? 'no version' : `v${version}`].join(' · ');
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        gap_area: row.gap_area || null,
        blueprint_key: row.blueprint_key || null,
        experiment_version: version,
        role_blueprint_version: num(row.role_blueprint_version),
        rows: [],
      });
    }
    groups.get(key).rows.push(row);
  });

  const summarised = [...groups.values()].map(g => {
    const students = new Set(g.rows.map(r => r.created_by_id).filter(Boolean)).size;
    const gate = students < minStudents;
    const withExpectation = g.rows.filter(r => r.expectation_recorded);
    const confidenceDeltas = g.rows.map(r => num(r.career_confidence_delta)).filter(v => v !== null);
    const interestDeltas = g.rows.map(r => num(r.career_interest_delta)).filter(v => v !== null);
    const moved = confidenceDeltas.filter(v => Math.abs(v) >= MOVED).length;
    const withEvidence = g.rows.filter(r => (num(r.evidence_created) || 0) > 0).length;
    const decided = g.rows.map(decisionFor).filter(Boolean);

    const base = {
      key: g.key,
      gap_area: g.gap_area,
      blueprint_key: g.blueprint_key,
      // Effectiveness is always reported against one exact version.
      experiment_version: g.experiment_version,
      role_blueprint_version: g.role_blueprint_version,
      // Raw counts. Visible below the threshold, because they are not claims.
      students,
      tests_completed: g.rows.length,
      expectations_recorded: withExpectation.length,
      decisions_recorded: decided.length,
      required_students: minStudents,
      suppressed: gate,
      message: gate ? NOT_ENOUGH_DATA : null,
    };

    if (gate) {
      return {
        ...base,
        evidence_rate: null,
        conviction_moved_rate: null,
        mean_confidence_change: null,
        mean_interest_change: null,
        decision_rate: null,
        decision_breakdown: null,
      };
    }

    const breakdown = decided.reduce((acc, d) => ({ ...acc, [d.decision]: (acc[d.decision] || 0) + 1 }), {});
    return {
      ...base,
      // Did the test produce something to reason from?
      evidence_rate: safeRate(withEvidence, g.rows.length),
      // Did the reading actually move, in either direction? A test that lowers a
      // path's confidence has resolved the gap just as well as one that raises it.
      conviction_moved_rate: safeRate(moved, confidenceDeltas.length),
      mean_confidence_change: mean(confidenceDeltas),
      mean_interest_change: mean(interestDeltas),
      // And did a decision follow on that path?
      decision_rate: safeRate(decided.length, g.rows.length),
      decision_breakdown: breakdown,
    };
  }).sort((a, b) => b.students - a.students || b.tests_completed - a.tests_completed);

  const publishable = summarised.filter(g => !g.suppressed);

  return {
    min_students: minStudents,
    /* The chain, as counts. Useful long before any group is publishable, and
       never presented as effectiveness. */
    chain: {
      gaps_targeted: rows.length,
      tests_completed: completed.length,
      expectations_recorded: completed.filter(r => r.expectation_recorded).length,
      evidence_created: completed.filter(r => (num(r.evidence_created) || 0) > 0).length,
      conviction_measured: completed.filter(r => num(r.career_confidence_delta) !== null).length,
      decisions_recorded: completed.filter(r => decisionFor(r)).length,
    },
    groups: summarised,
    publishable_groups: publishable.length,
    // The whole panel says this until at least one group clears the gate.
    message: publishable.length ? null : NOT_ENOUGH_DATA,
    disclaimer: 'Descriptive only. Grouped by exact experiment version, and no rate is shown until enough students have completed that version.',
  };
}

export default gapEffectiveness;