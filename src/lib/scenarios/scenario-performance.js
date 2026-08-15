/**
 * Performance questions: the other half of the system, kept deliberately apart.
 *
 * These have a correct answer or a reviewed rubric, so they CAN be scored. What
 * they must never do is decide career fit. A result here feeds task performance
 * only; whether the career suits the student is worked out elsewhere, from the
 * evidence together.
 */
import { isPerformance } from '@/lib/scenarios/scenario-signals';

/** A performance scenario is only scorable when its scoring was actually recorded. */
export function hasValidatedScoring(scenario, options = []) {
  if (!isPerformance(scenario)) return false;
  if (scenario.scenario_type === 'performance_objective') {
    const keyed = scenario.answer_key_option_id
      && options.some(o => o.id === scenario.answer_key_option_id);
    const ranged = Number.isFinite(scenario.accepted_answer_range?.low)
      && Number.isFinite(scenario.accepted_answer_range?.high);
    return Boolean((keyed || ranged) && scenario.answer_explanation);
  }
  const criteria = scenario.rubric_criteria || [];
  return criteria.length > 0
    && criteria.every(c => c?.criterion && (c.levels || []).length > 0)
    && Boolean(scenario.evaluation_version);
}

/**
 * Score one performance answer. Returns null when the scenario has no validated
 * scoring — an unscored question records the answer and claims nothing.
 */
export function scorePerformanceResponse({ scenario, options = [], selectedOptionId, numericAnswer, criterionScores = [] }) {
  if (!hasValidatedScoring(scenario, options)) return null;

  if (scenario.scenario_type === 'performance_objective') {
    const range = scenario.accepted_answer_range;
    let correct = null;
    if (scenario.answer_key_option_id && selectedOptionId) {
      correct = selectedOptionId === scenario.answer_key_option_id;
    } else if (Number.isFinite(range?.low) && Number.isFinite(numericAnswer)) {
      correct = numericAnswer >= range.low && numericAnswer <= range.high;
    }
    if (correct === null) return null;
    return {
      is_correct: correct,
      score: correct ? 1 : 0,
      max_score: 1,
      evaluation_version: scenario.evaluation_version || 'objective-v1',
    };
  }

  const criteria = scenario.rubric_criteria || [];
  const scored = criteria
    .map(c => {
      const given = criterionScores.find(s => s.criterion === c.criterion);
      return Number.isFinite(given?.score) ? { criterion: c.criterion, score: given.score } : null;
    })
    .filter(Boolean);
  if (!scored.length) return null;

  const maxPer = criteria.map(c => Math.max(...(c.levels || []).map(l => Number(l.score) || 0)));
  return {
    score: scored.reduce((sum, s) => sum + s.score, 0),
    max_score: maxPer.reduce((a, b) => a + b, 0),
    criterion_scores: scored,
    evaluation_version: scenario.evaluation_version,
  };
}

/**
 * Task performance across answered performance questions. Returns nothing that
 * mentions a career, and no dimension signals — by design.
 */
export function taskPerformance(responses = []) {
  const scored = responses.filter(r => r.performance_result && Number.isFinite(r.performance_result.score));
  if (!scored.length) return { answered: 0, accuracy: null, score: null, max_score: null };
  const objective = scored.filter(r => Number.isFinite(r.performance_result.max_score) && r.performance_result.max_score === 1);
  const score = scored.reduce((s, r) => s + r.performance_result.score, 0);
  const max = scored.reduce((s, r) => s + (r.performance_result.max_score || 0), 0);
  return {
    answered: scored.length,
    accuracy: objective.length
      ? Math.round((objective.filter(r => r.performance_result.is_correct).length / objective.length) * 100)
      : null,
    score,
    max_score: max || null,
    note: 'Task performance only. This does not say whether a career fits you.',
  };
}