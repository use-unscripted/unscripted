/**
 * Recording an answer, including a changed one.
 *
 * One scenario is one signal. When a student goes Back and picks differently
 * before finishing, the existing row is UPDATED rather than a second one added,
 * so the same scenario can never be counted twice in their evidence. The answer
 * they moved away from is kept on the row as `previous_option_id` with
 * `revised_at`, which is the audit trail without being a second signal.
 */
import { base44 } from '@/api/base44Client';
import { buildResponse, isPerformance } from '@/lib/scenarios/scenario-signals';
import { scorePerformanceResponse } from '@/lib/scenarios/scenario-performance';
import { loadMyResponses, submitResponse } from '@/lib/scenarios/scenario-store';

/** This student's answers, newest first. RLS keeps them to their own rows. */
export const loadResponses = loadMyResponses;

/** Keyed by scenario, newest kept — the current answer for each scenario. */
export function byScenarioKey(responses = []) {
  const out = {};
  responses.forEach(r => {
    const key = r.scenario_key || r.scenario_id;
    if (key && !out[key]) out[key] = r;
  });
  return out;
}

const clean = (row) => {
  Object.keys(row).forEach(k => { if (row[k] === undefined) delete row[k]; });
  return row;
};

/**
 * Save one answer. Pass `existing` (the row from `byScenarioKey`) and a changed
 * answer revises that row instead of adding another.
 */
export async function saveAnswer({ scenario, option, context = {}, numericAnswer, existing }) {
  if (!existing) {
    return submitResponse({ scenario, option, context, numericAnswer });
  }

  const unchanged = (existing.selected_option_id || null) === (option?.id || null)
    && (existing.numeric_answer ?? null) === (Number.isFinite(numericAnswer) ? numericAnswer : null);
  if (unchanged) return existing;

  const next = buildResponse({ scenario, option, context });
  const patch = clean({
    ...next,
    // The answer they moved away from, kept once and not counted as a signal.
    previous_option_id: existing.selected_option_id || null,
    revised_at: new Date().toISOString(),
    numeric_answer: Number.isFinite(numericAnswer) ? numericAnswer : undefined,
  });

  if (isPerformance(scenario)) {
    patch.dimension_signals_generated = [];
    const result = scorePerformanceResponse({
      scenario,
      options: scenario.options || [],
      selectedOptionId: option?.id,
      numericAnswer,
    });
    if (result) patch.performance_result = result;
  }

  return base44.entities.ScenarioResponse.update(existing.id, patch);
}