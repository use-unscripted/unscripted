/**
 * Turning scenario answers into dimension signals.
 *
 * A workstyle scenario has no right answer, so nothing in here reads a "correct"
 * flag or scores the student. Each chosen option carries a mapping onto the
 * existing decision dimensions, and the mapping is deliberately cautious: one
 * answer is an Initial Signal and nothing more, however emphatic the option.
 */
import { DIMENSION_BY_ID } from '@/lib/career-dimensions';
import {
  SCORING_VERSION,
  SCENARIO_LEVEL_LABELS,
  scenarioPhrasing,
  resolveLevel,
  thresholds,
} from '@/lib/scenarios/evidence-hierarchy';

const WORKSTYLE_TYPES = ['workstyle', 'decision_style'];

export const isWorkstyle = (scenario) => WORKSTYLE_TYPES.includes(scenario?.scenario_type);
export const isPerformance = (scenario) =>
  ['performance_objective', 'performance_rubric'].includes(scenario?.scenario_type);

/**
 * The dimension signals one selected option produces. Strength is clamped to
 * weak or moderate — a hypothetical answer cannot produce a strong signal.
 */
export function signalsForOption(option, scenario) {
  if (!option || !isWorkstyle(scenario)) return [];
  return (option.dimension_signal_mapping || [])
    .filter(m => m?.dimension && DIMENSION_BY_ID.has(m.dimension))
    .map(m => ({
      dimension: m.dimension,
      dimension_label: DIMENSION_BY_ID.get(m.dimension).label,
      signal_direction: m.signal_direction === 'draws_away' ? 'draws_away'
        : m.signal_direction === 'unclear' ? 'unclear' : 'draws_toward',
      signal_strength: m.signal_strength === 'moderate' ? 'moderate' : 'weak',
    }));
}

/** The row to store for one answered workstyle scenario. */
export function buildResponse({ scenario, option, context = {} }) {
  return {
    scenario_id: scenario.id,
    scenario_key: scenario.scenario_key || null,
    scenario_version: scenario.version || 1,
    scenario_type: scenario.scenario_type,
    selected_option_id: option?.id || null,
    response_context: context.response_context || 'standalone',
    career_cycle_id: context.career_cycle_id || null,
    path_id: context.path_id || null,
    path_name: context.path_name || null,
    experiment_id: context.experiment_id || scenario.experiment_id || null,
    dimension_signals_generated: signalsForOption(option, scenario),
    response_time_ms: Number.isFinite(context.response_time_ms) ? context.response_time_ms : undefined,
    scoring_version: SCORING_VERSION,
    completed_at: new Date().toISOString(),
  };
}

/**
 * The scenario-evidence level for one dimension.
 *  - answers pointing opposite ways  → conflicting, never averaged
 *  - one answer                      → initial_signal
 *  - two or three consistent answers → some
 *  - four or more, or a consistent run of moderate-strength answers across at
 *    least three distinct scenarios → stronger
 * Nothing here can exceed "stronger", which maps to moderate on the shared scale.
 */
export function scenarioLevelFor(signals = []) {
  const T = thresholds();
  const usable = signals.filter(s => s.signal_direction !== 'unclear');
  if (!usable.length) return 'none';
  const toward = usable.filter(s => s.signal_direction === 'draws_toward').length;
  const away = usable.filter(s => s.signal_direction === 'draws_away').length;
  const total = usable.length;
  // A disagreement needs at least the configured number of answers behind it,
  // otherwise one stray tap reads as a conflict.
  if (toward && away && total >= T.contradiction_min_responses) return 'conflicting';
  if (total < T.some_responses) return 'initial_signal';
  const scenarios = new Set(usable.map(s => s.scenario_id).filter(Boolean)).size;
  const moderates = usable.filter(s => s.signal_strength === 'moderate').length;
  if (total >= T.stronger_responses
    || (scenarios >= T.stronger_distinct_scenarios && moderates >= T.stronger_moderate_signals)) return 'stronger';
  return 'some';
}

/**
 * Every dimension this student has answered a scenario about, as its own record.
 * Kept separate from behavioural dimension evidence on purpose — the two are
 * merged for display by `mergeWithDimensions`, never written over each other.
 */
export function scenarioEvidence(responses = []) {
  const byDimension = new Map();

  responses
    .filter(r => Array.isArray(r.dimension_signals_generated) && r.dimension_signals_generated.length)
    .forEach(r => {
      r.dimension_signals_generated.forEach(s => {
        if (!DIMENSION_BY_ID.has(s.dimension)) return;
        const list = byDimension.get(s.dimension) || [];
        list.push({
          ...s,
          scenario_id: r.scenario_id,
          scenario_key: r.scenario_key || null,
          scenario_version: r.scenario_version || null,
          response_context: r.response_context || null,
          answered_at: r.completed_at || r.created_date || null,
          scoring_version: r.scoring_version || null,
        });
        byDimension.set(s.dimension, list);
      });
    });

  return [...byDimension.entries()].map(([dimension, signals]) => {
    const dim = DIMENSION_BY_ID.get(dimension);
    const level = scenarioLevelFor(signals);
    const toward = signals.filter(s => s.signal_direction === 'draws_toward').length;
    const away = signals.filter(s => s.signal_direction === 'draws_away').length;
    return {
      dimension,
      dimension_label: dim.label,
      noun: dim.noun,
      scenario_level: level,
      scenario_level_label: SCENARIO_LEVEL_LABELS[level],
      direction: level === 'conflicting' ? 'unclear'
        : toward && !away ? 'draws_toward'
        : away && !toward ? 'draws_away' : 'unclear',
      response_count: signals.length,
      scenarios_answered: new Set(signals.map(s => s.scenario_id).filter(Boolean)).size,
      signals,
      statement: scenarioPhrasing(level, dim.noun),
    };
  });
}

/**
 * Scenario evidence laid alongside the behavioural picture. The returned level is
 * what a screen should show; `level_source` says which kind of evidence decided
 * it, so a student is never told a hypothetical answer settled anything.
 */
export function mergeWithDimensions(dimensions = [], responses = []) {
  const scenarios = new Map(scenarioEvidence(responses).map(s => [s.dimension, s]));
  return dimensions.map(d => {
    const scenario = scenarios.get(d.dimension);
    const resolved = resolveLevel({
      behaviouralLevel: d.current_evidence_level,
      scenarioLevel: scenario?.scenario_level || 'none',
    });
    return {
      ...d,
      scenario_evidence: scenario || null,
      resolved_evidence_level: resolved.level,
      level_source: resolved.source,
      scenario_note: scenario && resolved.source !== 'scenario' ? scenario.statement : null,
    };
  });
}