/**
 * Reading the scenario library and recording answers.
 *
 * Only published, active scenarios are ever served to a student, and only at the
 * version they are published at, so an answer always points at content that
 * existed when it was given.
 */
import { base44 } from '@/api/base44Client';
import { buildResponse, isPerformance } from '@/lib/scenarios/scenario-signals';
import { scorePerformanceResponse } from '@/lib/scenarios/scenario-performance';

/** Published scenarios with their current options attached. */
export async function loadScenarios({ scenarioType, careerId, experimentId, limit = 40 } = {}) {
  const query = { validation_status: 'published', active_status: 'active' };
  if (scenarioType) query.scenario_type = scenarioType;
  if (careerId) query.career_id = careerId;
  if (experimentId) query.experiment_id = experimentId;

  const scenarios = await base44.entities.DecisionScenario.filter(query, '-updated_date', limit).catch(() => []);
  const list = Array.isArray(scenarios) ? scenarios : [];
  if (!list.length) return [];

  const options = await base44.entities.ScenarioOption.list('display_order', 500).catch(() => []);
  const byScenario = new Map();
  (Array.isArray(options) ? options : [])
    .filter(o => o.active_status !== 'superseded')
    .forEach(o => {
      const arr = byScenario.get(o.scenario_id) || [];
      arr.push(o);
      byScenario.set(o.scenario_id, arr);
    });

  return list.map(s => ({
    ...s,
    options: (byScenario.get(s.id) || [])
      .filter(o => (o.scenario_version || 1) === (s.version || 1))
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
  }));
}

/** This student's own answers. RLS keeps them to their own rows. */
export async function loadMyResponses(limit = 300) {
  const rows = await base44.entities.ScenarioResponse.list('-completed_at', limit).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

/**
 * Record one answer. A workstyle answer stores its dimension signals; a
 * performance answer stores a score and no signals at all.
 */
export async function submitResponse({ scenario, option, context = {}, numericAnswer, criterionScores }) {
  const row = buildResponse({ scenario, option, context });

  if (isPerformance(scenario)) {
    row.dimension_signals_generated = [];
    row.numeric_answer = Number.isFinite(numericAnswer) ? numericAnswer : undefined;
    const result = scorePerformanceResponse({
      scenario,
      options: scenario.options || [],
      selectedOptionId: option?.id,
      numericAnswer,
      criterionScores,
    });
    if (result) row.performance_result = result;
  }

  Object.keys(row).forEach(k => { if (row[k] === undefined) delete row[k]; });
  return base44.entities.ScenarioResponse.create(row);
}