/**
 * The evidence hierarchy, in one configurable and versioned place.
 *
 * The rule the whole scenario system exists to protect: behaviour outweighs
 * hypothetical preference. A student can answer twenty scenarios in a row and
 * still not out-rank one completed experiment, because a scenario asks what they
 * imagine they would do and an experiment records what they actually did.
 *
 * Weights are config, not law. Change them here and bump SCORING_VERSION — every
 * ScenarioResponse row stores the version it was scored under, so a later change
 * never silently rewrites history.
 */

export const SCORING_VERSION = 'scenario-scoring-v1';

/**
 * Source tiers, weakest first. `weight` is only used for comparing sources
 * against each other; `max_level` is the ceiling a source can ever reach on its
 * own, which is what stops a hypothetical answer from looking settled.
 */
export const EVIDENCE_TIERS = [
  { id: 'self_report', label: 'What you told us', weight: 10, max_level: 'weak' },
  { id: 'single_scenario', label: 'One scenario answer', weight: 20, max_level: 'weak' },
  { id: 'scenario_pattern', label: 'A pattern across scenarios', weight: 35, max_level: 'moderate' },
  { id: 'experiment', label: 'A completed experiment', weight: 60, max_level: 'strong' },
  { id: 'repeated_behaviour', label: 'Repeated real work', weight: 80, max_level: 'strong' },
  { id: 'reviewed', label: 'Professionally reviewed work', weight: 95, max_level: 'strong' },
];

export const TIER_BY_ID = new Map(EVIDENCE_TIERS.map(t => [t.id, t]));

/**
 * The five kinds of evidence a dimension can be read from. They stay separately
 * inspectable everywhere: a screen may summarise them, but nothing collapses
 * them into one unexplained number.
 */
export const EVIDENCE_SOURCE_TYPES = [
  { id: 'self_report', label: 'Self-report', blurb: 'What you told us directly.', tier: 'self_report' },
  { id: 'scenario', label: 'Scenario pattern', blurb: 'Patterns across hypothetical decisions.', tier: 'scenario_pattern' },
  { id: 'behavioural', label: 'Behavioural', blurb: 'What you actually did in real experiments.', tier: 'experiment' },
  { id: 'performance', label: 'Performance', blurb: 'How well you completed validated tasks.', tier: 'experiment' },
  { id: 'human', label: 'Human / verified', blurb: 'Professionally or institutionally reviewed work.', tier: 'reviewed' },
];

/**
 * When scenario answers are allowed to read as more than a first flicker.
 * Initial configuration values, not scientific claims — see EvidenceWeightConfig
 * for the admin path that changes them.
 */
export const PATTERN_THRESHOLDS = {
  initial_signal_responses: 1,
  some_responses: 3,
  stronger_responses: 6,
  stronger_distinct_scenarios: 3,
  stronger_moderate_signals: 2,
  contradiction_min_responses: 2,
};

/* The active configuration. Defaults live above; an admin row may replace them
   at runtime through configureEvidence(). Every scored row stores the version it
   was scored under, so changing this never rewrites history. */
let active = {
  config_version: SCORING_VERSION,
  source_weights: Object.fromEntries(EVIDENCE_TIERS.map(t => [t.id, t.weight])),
  pattern_thresholds: { ...PATTERN_THRESHOLDS },
};

export function evidenceConfig() {
  return active;
}

export function thresholds() {
  return active.pattern_thresholds;
}

export function sourceWeight(tierId) {
  return active.source_weights[tierId] ?? TIER_BY_ID.get(tierId)?.weight ?? 0;
}

/** Apply an admin configuration row. Unknown keys are ignored. */
export function configureEvidence(config = {}) {
  active = {
    config_version: config.config_version || SCORING_VERSION,
    source_weights: { ...active.source_weights, ...(config.source_weights || {}) },
    pattern_thresholds: { ...active.pattern_thresholds, ...(config.pattern_thresholds || {}) },
  };
  return active;
}

/** Scenario evidence has its own, deliberately softer, vocabulary. */
export const SCENARIO_LEVELS = ['none', 'initial_signal', 'some', 'stronger', 'conflicting'];

export const SCENARIO_LEVEL_LABELS = {
  none: 'No scenario signal',
  initial_signal: 'Initial Signal',
  some: 'Some Scenario Evidence',
  stronger: 'Stronger Scenario Evidence',
  conflicting: 'Conflicting Scenario Evidence',
};

/** How a scenario level maps onto the shared dimension levels. Capped at moderate. */
export const SCENARIO_TO_DIMENSION_LEVEL = {
  none: 'unknown',
  initial_signal: 'weak',
  some: 'weak',
  stronger: 'moderate',
  conflicting: 'conflicting',
};

const DIMENSION_RANK = { unknown: 0, weak: 1, conflicting: 2, moderate: 3, strong: 4 };

/** Is this dimension already settled by things the student actually did? */
export function behaviourWins(behaviouralLevel) {
  return ['moderate', 'strong'].includes(behaviouralLevel);
}

/**
 * The level a dimension should read at once scenario answers are taken into
 * account. Behavioural evidence at moderate or above is never displaced; below
 * that, scenario evidence may only raise the reading to its own ceiling.
 */
export function resolveLevel({ behaviouralLevel = 'unknown', scenarioLevel = 'none' } = {}) {
  const fromScenario = SCENARIO_TO_DIMENSION_LEVEL[scenarioLevel] || 'unknown';
  if (behaviourWins(behaviouralLevel)) {
    return { level: behaviouralLevel, source: 'behaviour', scenario_noted: scenarioLevel !== 'none' };
  }
  if (DIMENSION_RANK[fromScenario] > DIMENSION_RANK[behaviouralLevel]) {
    return { level: fromScenario, source: 'scenario', scenario_noted: true };
  }
  return {
    level: behaviouralLevel,
    source: behaviouralLevel === 'unknown' ? 'none' : 'behaviour',
    scenario_noted: scenarioLevel !== 'none',
  };
}

/** Student-facing wording. Never "this proves you are". */
export function scenarioPhrasing(level, noun = 'this kind of situation') {
  if (level === 'none') return `We have no scenario signal about ${noun} yet.`;
  if (level === 'conflicting') return `Your scenario answers about ${noun} have pointed different ways.`;
  const lead = level === 'initial_signal'
    ? 'This gives us another signal about'
    : level === 'some'
      ? 'Your answers so far give us a repeated signal about'
      : 'Your answers consistently signal';
  return `${lead} how you may prefer to approach ${noun}. It is a preference, not a result.`;
}