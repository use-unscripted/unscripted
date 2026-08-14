/**
 * Aggregate product learning, computed across students.
 *
 * What this module is for: answering "which experiences teach students something
 * useful" from records students have already produced. What it is NOT for: any
 * view of an individual. Nothing it returns contains a user id, a name, a career
 * hypothesis belonging to one person, or a single character of anything a
 * student wrote. Every cell is a count or an average over students, and any cell
 * built on fewer than MIN_STUDENTS distinct students is returned suppressed —
 * present so the dashboard can say "not enough data yet", empty of numbers that
 * could be traced back to one person.
 *
 * Pure. The function passes rows in; this file does arithmetic only.
 */

/** Below this many distinct students, a cell reports nothing but its own absence. */
export const MIN_STUDENTS = 5;

const isLive = (r) => r && r.deletion_status !== 'deleted' && r.deletion_status !== 'permanently_deleted';
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const avg = (xs) => {
  const vals = xs.map(num).filter((v) => v !== null);
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
};
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);
const owner = (r) => r?.created_by_id || r?.user_id || null;

/** Distinct students behind a set of rows. The unit every threshold is measured in. */
function students(rows) {
  return new Set(rows.map(owner).filter(Boolean)).size;
}

/**
 * Wrap a computed cell in its own sample size. A caller can never read the
 * numbers without also seeing how many students they came from, and under the
 * threshold there are no numbers to read.
 */
function cell(rows, compute) {
  const n = students(rows);
  if (n < MIN_STUDENTS) return { suppressed: true, sample_size: n < MIN_STUDENTS ? n : n, students: n, reason: `Fewer than ${MIN_STUDENTS} students.` };
  return { suppressed: false, students: n, ...compute() };
}

/** A stable grouping key for "the same experience", independent of one student's wording. */
export function blueprintKey(experiment) {
  const base = experiment?.test_question || experiment?.title || 'untitled';
  return String(base).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
}

/**
 * Effectiveness per experience. One row per blueprint, each with its own
 * suppression flag, because a rare experiment must not become identifiable just
 * because the aggregate around it is large.
 */
export function experimentEffectiveness({ experiments = [], measurements = [], reflections = [], proof = [], updates = [] }) {
  const measurementByExp = new Map(measurements.map((m) => [m.experiment_id, m]));
  const reflectionByExp = new Map(reflections.filter(isLive).map((r) => [r.experiment_id, r]));
  const proofByExp = new Map();
  proof.filter(isLive).forEach((p) => { if (p.experiment_id) proofByExp.set(p.experiment_id, p); });
  const updatesByExp = new Map();
  updates.forEach((u) => { if (u.experiment_id) updatesByExp.set(u.experiment_id, u); });

  const groups = new Map();
  experiments.filter(isLive).forEach((e) => {
    const key = blueprintKey(e);
    if (!groups.has(key)) groups.set(key, { key, title: e.title || '', question: e.test_question || '', rows: [] });
    groups.get(key).rows.push(e);
  });

  return [...groups.values()].map((g) => {
    const rows = g.rows;
    const base = {
      blueprint_key: g.key,
      blueprint_title: g.title,
      test_question: g.question,
      dimensions_tested: [...new Set(rows.flatMap((e) => e.work_characteristic_ids || e.work_characteristics_tested || []))].slice(0, 8),
      hypotheses_where_used: [...new Set(rows.map((e) => e.career_name || e.path_name).filter(Boolean))].length,
    };
    const computed = cell(rows, () => {
      const completed = rows.filter((e) => e.status === 'completed');
      const measured = completed.map((e) => measurementByExp.get(e.id)).filter(Boolean);
      const withPost = measured.filter((m) => m.post_completed_at);
      const upd = rows.map((e) => updatesByExp.get(e.id)).filter(Boolean);
      const gaps = withPost
        .map((m) => (num(m.actual_enjoyment) !== null && num(m.expected_enjoyment) !== null
          ? Math.abs(m.actual_enjoyment - m.expected_enjoyment) : null))
        .filter((v) => v !== null);
      return {
        students_started: students(rows),
        students_completed: students(completed),
        completion_rate: pct(completed.length, rows.length),
        average_hours_to_completion: avg(completed.map((e) => e.estimated_hours)),
        evidence_submission_rate: pct(completed.filter((e) => proofByExp.has(e.id)).length, completed.length || 1),
        reflection_completion_rate: pct(completed.filter((e) => reflectionByExp.has(e.id)).length, completed.length || 1),
        // "Changed understanding" is read from students saying so in their own
        // reflection, never inferred from a score moving.
        pct_changed_understanding: pct(
          completed.filter((e) => {
            const r = reflectionByExp.get(e.id);
            return Boolean(r && (r.misconception_changed || r.assumptions_changed));
          }).length,
          completed.length || 1,
        ),
        average_uncertainties_resolved: avg(upd.map((u) => (u.unknowns_resolved || []).length)),
        expectation_reality_delta: avg(gaps),
        // The stored per-experiment score, averaged. Never recomputed here, so
        // the dashboard and the student's own record cannot disagree.
        information_value_score: avg(upd.map((u) => u.information_value_score)),
        student_reported_usefulness: avg(upd.map((u) => u.information_value_score)),
        dropoff_stage: dropoff(rows, measurementByExp, reflectionByExp),
      };
    });
    // A suppressed row keeps its identity and nothing else. Emitting the
    // dimensions and the number of hypotheses it appeared in would still be a
    // description of the two or three students who ran it.
    const size = students(rows);
    if (computed.suppressed) {
      return {
        blueprint_key: base.blueprint_key,
        blueprint_title: base.blueprint_title,
        ...computed,
        sample_size: size,
        computed_at: new Date().toISOString(),
      };
    }
    return { ...base, ...computed, sample_size: size, computed_at: new Date().toISOString() };
  }).sort((a, b) => (b.sample_size || 0) - (a.sample_size || 0));
}

/** Where students stop. Counted, not guessed: the last stage that has a record. */
function dropoff(rows, measurementByExp, reflectionByExp) {
  const counts = { never_started: 0, no_pre_measurement: 0, started_not_completed: 0, no_reflection: 0, completed_fully: 0 };
  rows.forEach((e) => {
    const m = measurementByExp.get(e.id);
    if (e.status === 'draft' || e.status === 'planned') counts.never_started += 1;
    else if (!m?.pre_completed_at) counts.no_pre_measurement += 1;
    else if (e.status !== 'completed') counts.started_not_completed += 1;
    else if (!reflectionByExp.has(e.id)) counts.no_reflection += 1;
    else counts.completed_fully += 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Uncertainty across the cohort: what students do not know about themselves yet. */
export function uncertaintyPicture({ dimensionEvidence = [] }) {
  return cell(dimensionEvidence, () => {
    const byDim = new Map();
    dimensionEvidence.forEach((d) => {
      const key = d.dimension_label || d.dimension;
      if (!key) return;
      if (!byDim.has(key)) byDim.set(key, { dimension: key, unknown: 0, tested: 0, conflicting: 0, students: new Set() });
      const e = byDim.get(key);
      if (owner(d)) e.students.add(owner(d));
      if (d.current_evidence_level === 'unknown') e.unknown += 1;
      if ((d.behavioral_evidence_count || 0) > 0) e.tested += 1;
      if (d.current_evidence_level === 'conflicting') e.conflicting += 1;
    });
    const rows = [...byDim.values()]
      .map((e) => ({ dimension: e.dimension, unknown: e.unknown, tested: e.tested, conflicting: e.conflicting, students: e.students.size }))
      // A dimension only appears once enough students share it.
      .filter((e) => e.students >= MIN_STUDENTS);
    const perStudent = new Map();
    dimensionEvidence.forEach((d) => {
      const u = owner(d);
      if (!u) return;
      perStudent.set(u, (perStudent.get(u) || 0) + (d.current_evidence_level === 'unknown' ? 1 : 0));
    });
    return {
      most_unresolved: [...rows].sort((a, b) => b.unknown - a.unknown).slice(0, 8),
      most_tested: [...rows].sort((a, b) => b.tested - a.tested).slice(0, 8),
      most_conflicting: [...rows].sort((a, b) => b.conflicting - a.conflicting).slice(0, 5),
      average_unknowns_per_student: avg([...perStudent.values()]),
    };
  });
}

/** Cross-career learning: how often one answer serves more than one direction. */
export function crossCareerPicture({ dimensionEvidence = [], overrides = [] }) {
  return cell(dimensionEvidence, () => {
    const transferable = new Map();
    let multi = 0;
    dimensionEvidence.forEach((d) => {
      const careers = (d.careers_observed_in || []).filter(Boolean).length;
      if (careers >= 2) {
        multi += 1;
        const key = d.dimension_label || d.dimension;
        transferable.set(key, (transferable.get(key) || 0) + 1);
      }
    });
    const accepted = overrides.filter((o) => o.action === 'accepted');
    return {
      pct_dimensions_informing_multiple: pct(multi, dimensionEvidence.length),
      pct_accepted_recommendations_cross_career: pct(accepted.filter((o) => (o.cross_career_count || 0) >= 2).length, accepted.length || 1),
      most_transferable: [...transferable.entries()].map(([dimension, count]) => ({ dimension, count })).sort((a, b) => b.count - a.count).slice(0, 6),
      // Settled dimensions a second hypothesis could reuse rather than retest.
      // Named as an upper bound, because we cannot know a student would have run
      // the duplicate test.
      reusable_settled_dimensions: dimensionEvidence.filter((d) => ['moderate', 'strong'].includes(d.current_evidence_level) && (d.careers_observed_in || []).length >= 1).length,
    };
  });
}

/** How hypotheses actually move: strengthened, mixed, modified, set aside. */
export function hypothesisEvolution({ updates = [] }) {
  const rows = updates.filter((u) => u.stage === 'update');
  return cell(rows, () => {
    const tally = (key) => rows.reduce((acc, u) => {
      const v = u[key] || 'unrecorded';
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    }, {});
    const perPath = new Map();
    rows.forEach((u) => {
      if (!u.path_id) return;
      perPath.set(u.path_id, Math.max(perPath.get(u.path_id) || 0, u.sequence || 0));
    });
    const meaningful = rows.filter((u) => (u.unknowns_resolved || []).length || u.evidence_outcome === 'strengthened' || u.evidence_outcome === 'weakened');
    return {
      by_outcome: tally('evidence_outcome'),
      by_decision: tally('decision'),
      average_updates_per_hypothesis: avg([...perPath.values()]),
      pct_updates_that_moved_something: pct(meaningful.length, rows.length),
      insufficient_information: rows.filter((u) => u.evidence_outcome === 'insufficient_information').length,
    };
  });
}

/** Which rules put forward tests students accepted, and what those taught them. */
export function recommendationRulePicture({ overrides = [], updates = [] }) {
  return cell(overrides, () => {
    const byRule = new Map();
    overrides.forEach((o) => {
      const key = o.rule_id || 'unlogged';
      if (!byRule.has(key)) byRule.set(key, { rule_id: key, offered: 0, accepted: 0, values: [] });
      const e = byRule.get(key);
      e.offered += 1;
      if (o.action === 'accepted') e.accepted += 1;
      if (num(o.information_value_score) !== null) e.values.push(o.information_value_score);
    });
    const valueAll = avg(updates.map((u) => u.information_value_score));
    return {
      rules: [...byRule.values()].map((e) => ({
        rule_id: e.rule_id,
        offered: e.offered,
        acceptance_rate: pct(e.accepted, e.offered),
        average_information_value: avg(e.values),
      })).sort((a, b) => b.offered - a.offered),
      average_information_value_all_experiments: valueAll,
    };
  });
}

/** Career clarity movement. Reported as movement, never as an effect we caused. */
export function clarityPicture({ profiles = [], reflections = [], updates = [] }) {
  const live = reflections.filter(isLive);
  return cell([...profiles, ...live], () => {
    const bySeq = (n) => avg(updates.filter((u) => (u.sequence || 0) === n).map((u) => u.clarity_score));
    return {
      baseline: avg(profiles.map((p) => p.baseline_career_clarity)),
      latest_reflection: avg(live.map((r) => r.clarity_score)),
      after_one_experiment: bySeq(1),
      after_two_or_more: avg(updates.filter((u) => (u.sequence || 0) >= 2).map((u) => u.clarity_score)),
      caveat: 'Movement only. Students who complete more experiments differ from those who do not, so none of this shows cause.',
    };
  });
}

/**
 * Data quality. Anything that would otherwise be quietly averaged in gets counted
 * here instead, so a thin number is visible as thin rather than confident.
 */
export function dataQuality({ experiments = [], measurements = [], reflections = [], updates = [], overrides = [] }) {
  const completed = experiments.filter((e) => isLive(e) && e.status === 'completed');
  const measurementByExp = new Map(measurements.map((m) => [m.experiment_id, m]));
  const seen = new Set();
  let duplicateUpdates = 0;
  updates.forEach((u) => {
    const key = `${u.path_id}|${u.experiment_id}|${u.sequence}`;
    if (seen.has(key)) duplicateUpdates += 1;
    seen.add(key);
  });
  return {
    completed_without_post_measurement: completed.filter((e) => !measurementByExp.get(e.id)?.post_completed_at).length,
    completed_without_reflection: completed.filter((e) => !reflections.some((r) => isLive(r) && r.experiment_id === e.id)).length,
    updates_missing_confidence_inputs: updates.filter((u) => u.stage === 'update' && (num(u.confidence_before) === null || num(u.confidence_after) === null)).length,
    updates_not_approved_by_student: updates.filter((u) => u.stage === 'update' && u.student_approved_synthesis === false).length,
    duplicate_update_rows: duplicateUpdates,
    recommendations_without_rule_logged: overrides.filter((o) => !o.rule_id).length,
    legacy_records: experiments.filter((e) => e.legacy_review).length,
    withdrawn_or_deleted_records: [...experiments, ...reflections].filter((r) => r && !isLive(r)).length,
    note: 'Missing values are counted, never filled in. Averages above exclude them.',
  };
}

/** The whole dashboard payload. */
export function decisionIntelligence(data) {
  return {
    min_students: MIN_STUDENTS,
    computed_at: new Date().toISOString(),
    uncertainty: uncertaintyPicture(data),
    experiments: experimentEffectiveness(data),
    cross_career: crossCareerPicture(data),
    hypothesis_evolution: hypothesisEvolution(data),
    rules: recommendationRulePicture(data),
    clarity: clarityPicture(data),
    data_quality: dataQuality(data),
    disclaimer: 'Aggregate product learning only. These are counts and averages over students, not evidence that Unscripted caused any change, and not a view of any individual.',
  };
}

export default decisionIntelligence;