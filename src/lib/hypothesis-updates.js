/**
 * Hypothesis update history.
 *
 * The rule this module exists to hold: a hypothesis is never overwritten by an
 * update. Each reflection appends one HypothesisUpdate row, and the first row
 * for a career is an `initial` snapshot of where it started, so the chain always
 * reads Initial hypothesis → Experiment 1 → Update → Experiment 2 → Update →
 * Current position.
 *
 * The scores on PathRecommendations are the CURRENT position and are meant to
 * move. The history of what they were, and why, lives here and in
 * HypothesisRecalculation, and nothing in this file deletes either.
 */
import { base44 } from '@/api/base44Client';
import { informationValue, evidenceOutcome, unknownsDelta } from '@/lib/experiment-information-value';

/** The three outcomes. Elimination is a result, not a failure. */
export const DECISIONS = [
  {
    key: 'continue_testing',
    label: 'Continue testing',
    sub: 'This hypothesis still looks promising. Test the next most important unknown.',
    cycle_decision: 'continue',
    hypothesis_status: 'testing',
  },
  {
    key: 'modify_hypothesis',
    label: 'Modify hypothesis',
    sub: 'Something about the broader direction fits, but a different role, environment, specialty or version may fit better.',
    cycle_decision: 'adjust',
    hypothesis_status: 'modified',
  },
  {
    key: 'eliminate_hypothesis',
    label: 'Eliminate hypothesis',
    sub: 'You learned enough to stop investing time in this direction for now.',
    cycle_decision: 'stop_and_explore',
    hypothesis_status: 'eliminated',
  },
];

export const decisionMeta = (key) => DECISIONS.find(d => d.key === key) || null;

/** What is said after an elimination. Neutral, and never congratulatory. */
export const ELIMINATION_NOTE =
  'This direction is now recorded as tested and set aside, with the evidence behind that kept. You reached it with evidence rather than by guessing, and everything you produced stays in your library.';

/**
 * The snapshot of where a career hypothesis started.
 * `originalScores` comes from the earliest recorded recalculation when one
 * exists, so the starting numbers are the ones from before any update.
 */
export function buildInitialSnapshot({ path, originalScores = null, dimensions = [] }) {
  const before = originalScores || {};
  return {
    path_id: path.id,
    path_name: path.path_name,
    stage: 'initial',
    sequence: 0,
    hypothesis_statement: path.why_this_may_fit || path.why_it_fits || path.fit_reason || '',
    rationale: path.fit_reason || path.goals_supported || '',
    status_after: path.hypothesis_status || 'untested',
    fit_after: typeof before.career_fit_score === 'number' ? before.career_fit_score : (path.career_fit_score ?? undefined),
    confidence_after: typeof before.fit_confidence_score === 'number' ? before.fit_confidence_score : (path.fit_confidence_score ?? undefined),
    remaining_unknowns: (path.unresolved_questions || []).map(q => q?.question).filter(Boolean).slice(0, 6),
    dimensions_tested: dimensions.map(d => d.dimension_label).slice(0, 8),
    recorded_at: new Date().toISOString(),
  };
}

/**
 * One update row, built from the reviewed synthesis and the decision.
 *
 * `previous` is the row this version follows, which is what makes the chain a
 * chain: each version points back at the state it replaced, and what changed
 * between them (unknowns closed, unknowns opened, the recommendation that moved)
 * is stored rather than recomputed later from records that may since have moved.
 */
export function buildUpdateRow({ synthesis, decision, decisionNote, reflection, experiment, sequence, previous = null, measurement = null, approvedSynthesis = true, crossCareerCount = 1 }) {
  const meta = decisionMeta(decision);
  const { resolved, added } = unknownsDelta(previous?.remaining_unknowns || [], synthesis.unknowns || []);
  const outcome = evidenceOutcome({
    strengthened: synthesis.strengthened || [],
    weakened: synthesis.weakened || [],
    resolved, added, decision,
  });
  const value = informationValue({
    synthesis, measurement, reflection, experiment, resolved, added, crossCareerCount,
  });
  const previousNext = previous?.next_best_test || '';
  const nextNow = synthesis.next_test?.question || '';
  return {
    previous_version_id: previous?.id || undefined,
    career_cycle_id: experiment?.career_cycle_id || experiment?.cycle_id || undefined,
    unknowns_resolved: resolved.length ? resolved : undefined,
    unknowns_added: added.length ? added : undefined,
    decision_dimensions_updated: (synthesis.dimensions_tested || []).length ? synthesis.dimensions_tested : undefined,
    // What the recommendation did as a result, in words, so the chain shows the
    // loop closing rather than just a new score.
    recommendation_change: nextNow && nextNow !== previousNext
      ? (previousNext ? `Next test moved from "${previousNext}" to "${nextNow}".` : `Next test is now "${nextNow}".`)
      : undefined,
    ai_synthesis: synthesis.summary || synthesis.statement || undefined,
    student_approved_synthesis: Boolean(approvedSynthesis),
    evidence_outcome: outcome,
    information_value_score: value.score,
    information_value_reasons: value.reasons.length ? value.reasons : undefined,
    path_id: synthesis.path_id,
    path_name: synthesis.path_name,
    stage: 'update',
    sequence,
    experiment_id: experiment?.id,
    experiment_title: experiment?.title,
    reflection_id: reflection?.id,
    cycle_id: experiment?.cycle_id,
    test_question: experiment?.test_question || experiment?.unresolved_question || undefined,
    status_before: synthesis.status_before,
    status_after: meta?.hypothesis_status || synthesis.status_after,
    fit_before: synthesis.before.fit ?? undefined,
    fit_after: synthesis.after.fit ?? undefined,
    confidence_before: synthesis.before.confidence ?? undefined,
    confidence_after: synthesis.after.confidence ?? undefined,
    confidence_label_before: synthesis.before.confidenceLabel,
    confidence_label_after: synthesis.after.confidenceLabel,
    confidence_label_source: synthesis.confidence_label_source || 'derived',
    strengthened_by: synthesis.strengthened,
    weakened_by: synthesis.weakened,
    remaining_unknowns: synthesis.unknowns,
    next_best_test: synthesis.next_test?.question || undefined,
    next_best_test_link: synthesis.next_test?.to || undefined,
    dimensions_tested: synthesis.dimensions_tested,
    student_correction: synthesis.student_correction || undefined,
    decision,
    decision_note: String(decisionNote || '').trim() || undefined,
    clarity_score: reflection?.clarity_score ?? undefined,
    recorded_at: new Date().toISOString(),
  };
}

const strip = (row) => {
  const out = { ...row };
  Object.keys(out).forEach(k => { if (out[k] === undefined) delete out[k]; });
  return out;
};

/** Every update for one career, oldest first. */
export async function loadHypothesisHistory(pathId) {
  if (!pathId) return [];
  const rows = await base44.entities.HypothesisUpdate
    .filter({ path_id: pathId }, 'created_date', 100)
    .catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

/**
 * Record the update: the initial snapshot if this career has none yet, then the
 * update itself, then the career's current status. No prior row is touched.
 */
export async function recordHypothesisUpdate({ path, synthesis, decision, decisionNote, reflection, experiment, dimensions = [], measurement = null, approvedSynthesis = true, crossCareerCount = 1 }) {
  if (!path?.id || !synthesis) throw new Error('A career hypothesis and a synthesis are required.');
  const existing = await loadHypothesisHistory(path.id);

  if (!existing.some(r => r.stage === 'initial')) {
    const earliest = await base44.entities.HypothesisRecalculation
      .filter({ path_id: path.id }, 'created_date', 1)
      .catch(() => []);
    await base44.entities.HypothesisUpdate.create(strip(buildInitialSnapshot({
      path,
      originalScores: Array.isArray(earliest) && earliest[0]?.before ? earliest[0].before : null,
      dimensions,
    }))).catch(() => null);
  }

  const sequence = existing.filter(r => r.stage === 'update').length + 1;
  // The version this one follows: the newest update if there is one, otherwise
  // the initial snapshot. Never modified, only pointed at.
  const sorted = [...existing].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const previous = sorted.filter(r => r.stage === 'update').slice(-1)[0] || sorted.find(r => r.stage === 'initial') || null;
  const saved = await base44.entities.HypothesisUpdate.create(strip(buildUpdateRow({
    synthesis, decision, decisionNote, reflection, experiment, sequence,
    previous, measurement, approvedSynthesis, crossCareerCount,
  })));

  const meta = decisionMeta(decision);
  if (meta) {
    const today = new Date().toISOString().split('T')[0];
    await base44.entities.PathRecommendations.update(path.id, {
      hypothesis_status: meta.hypothesis_status,
      hypothesis_status_changed_at: new Date().toISOString(),
      hypothesis_modification_note: decision === 'modify_hypothesis'
        ? (String(decisionNote || '').trim() || undefined)
        : undefined,
      ...(decision === 'eliminate_hypothesis'
        ? { status: 'deprioritized', is_primary_focus: false, paused_at: today }
        : { status: 'active', is_primary_focus: true, last_active_at: today }),
    }).catch(() => null);
  }

  return { update: saved, sequence };
}

/** The chain, for display: initial → each update → current position. */
export function timelineFrom(rows = []) {
  const sorted = [...rows].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  return {
    initial: sorted.find(r => r.stage === 'initial') || null,
    updates: sorted.filter(r => r.stage === 'update'),
    current: sorted.filter(r => r.stage === 'update').slice(-1)[0] || null,
  };
}

export default recordHypothesisUpdate;