/**
 * Privacy-safe aggregate analytics for the Decision Scenario system.
 *
 * Counts and averages across students only: no user ids, no per-student rows, no
 * free text. Suppressed below the shared student threshold, like every other cell
 * on the Decision Intelligence dashboard.
 *
 * Explicitly NOT a validity claim. The confirmed / contradicted counts describe
 * what has happened so far in a small sample; nothing here should be read as
 * predictive until the sample is large enough for that question to be asked
 * properly, which is why the payload carries its own disclaimer.
 */

const MIN_STUDENTS = 5;
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null);
const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

const SETTLED = ['moderate', 'strong'];

/**
 * @param responses         ScenarioResponse rows across students
 * @param dimensionEvidence CareerDimensionEvidence rows across students
 */
export function scenarioAnalytics({ responses = [], dimensionEvidence = [] } = {}) {
  const students = new Set(responses.map(r => r.created_by_id).filter(Boolean));
  if (students.size < MIN_STUDENTS) {
    return {
      suppressed: true,
      students: students.size,
      reason: `Fewer than ${MIN_STUDENTS} students have answered a scenario.`,
    };
  }

  const workstyle = responses.filter(r => (r.dimension_signals_generated || []).length);
  const scored = responses.filter(r => r.performance_result);
  const revised = responses.filter(r => r.previous_option_id);

  // Consistency: per student per dimension, did their answers agree with themselves?
  const perStudentDim = new Map();
  workstyle.forEach(r => {
    (r.dimension_signals_generated || []).forEach(s => {
      const key = `${r.created_by_id}|${s.dimension}`;
      const list = perStudentDim.get(key) || [];
      list.push(s.signal_direction);
      perStudentDim.set(key, list);
    });
  });
  const multi = [...perStudentDim.values()].filter(v => v.length >= 2);
  const consistent = multi.filter(v => new Set(v).size === 1).length;

  // Scenario direction against behavioural direction, where both exist.
  const behaviourBy = new Map();
  dimensionEvidence.forEach(d => {
    if (d.created_by_id && d.dimension) behaviourBy.set(`${d.created_by_id}|${d.dimension}`, d);
  });
  let confirmed = 0;
  let contradicted = 0;
  let awaiting = 0;
  perStudentDim.forEach((directions, key) => {
    const behaviour = behaviourBy.get(key);
    const lean = new Set(directions).size === 1 ? directions[0] : 'unclear';
    if (!behaviour || !SETTLED.includes(behaviour.current_evidence_level)) { awaiting += 1; return; }
    if (lean === 'unclear' || !behaviour.direction || behaviour.direction === 'none') { awaiting += 1; return; }
    if (lean === behaviour.direction) confirmed += 1; else contradicted += 1;
  });

  // Which scenarios carry information, by how often a student's reading on that
  // dimension later moved at all. A scenario nobody's behaviour ever agrees or
  // disagrees with is a candidate for retirement, not a validated instrument.
  const byScenario = new Map();
  workstyle.forEach(r => {
    const key = r.scenario_key || r.scenario_id;
    const row = byScenario.get(key) || { scenario: key, answers: 0, students: new Set(), revisions: 0 };
    row.answers += 1;
    if (r.created_by_id) row.students.add(r.created_by_id);
    if (r.previous_option_id) row.revisions += 1;
    byScenario.set(key, row);
  });
  const scenarioRows = [...byScenario.values()]
    .filter(row => row.students.size >= MIN_STUDENTS)
    .map(row => ({ scenario: row.scenario, answers: row.answers, students: row.students.size, revised: row.revisions }))
    .sort((a, b) => b.answers - a.answers)
    .slice(0, 12);

  return {
    suppressed: false,
    students: students.size,
    scenario_answers: responses.length,
    workstyle_answers: workstyle.length,
    scored_answers: scored.length,
    answers_revised: revised.length,
    average_answers_per_student: avg([...students].map(id => responses.filter(r => r.created_by_id === id).length)),
    self_consistency_rate: pct(consistent, multi.length),
    scenario_vs_behaviour_agreed: confirmed,
    scenario_vs_behaviour_disagreed: contradicted,
    scenario_vs_behaviour_untested: awaiting,
    scenarios_with_enough_answers: scenarioRows,
    note: 'Descriptive only. No predictive validity is claimed at this sample size, and low-information scenarios are candidates for review rather than automatic retirement.',
  };
}

export default scenarioAnalytics;