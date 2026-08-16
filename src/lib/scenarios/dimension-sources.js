/**
 * One dimension, read from all five kinds of evidence, kept separate.
 *
 * Nothing here scores anything new. Behavioural evidence comes from
 * career-dimensions, scenario evidence from scenario-signals, the reconciliation
 * rule from evidence-hierarchy. This module only lays them side by side and keeps
 * the provenance of each scenario-derived reading, so "why does Unscripted think
 * this?" is answered with records rather than with a number.
 */
import { DIMENSION_BY_ID } from '@/lib/career-dimensions';
import { scenarioEvidence } from '@/lib/scenarios/scenario-signals';
import {
  EVIDENCE_SOURCE_TYPES,
  SCENARIO_LEVEL_LABELS,
  resolveLevel,
  behaviourWins,
  sourceWeight,
  evidenceConfig,
} from '@/lib/scenarios/evidence-hierarchy';

const DIRECTION_WORD = {
  draws_toward: 'Positive',
  draws_away: 'Negative',
  unclear: 'Mixed',
  none: 'Not yet read',
};

const BEHAVIOURAL_STATE = {
  unknown: 'Not tested yet',
  weak: 'One reading so far',
  moderate: 'Consistent readings',
  strong: 'Repeated across contexts',
  conflicting: 'Readings point both ways',
};

/** Confidence, capped, and explicitly lower when only hypothetical answers exist. */
function confidenceFor({ behaviouralConfidence = 0, scenario, human = 0 }) {
  const scenarioAdd = !scenario ? 0
    : scenario.scenario_level === 'stronger' ? 12
    : scenario.scenario_level === 'some' ? 8
    : scenario.scenario_level === 'conflicting' ? 4 : 3;
  const ceiling = behaviouralConfidence > 0 ? 85 : 35;
  return Math.min(ceiling, Math.round(behaviouralConfidence + scenarioAdd + human * 5));
}

/**
 * The five source rows for one dimension.
 *
 * @param dimension   a row from deriveDimensions / CareerDimensionEvidence
 * @param responses    this student's ScenarioResponse rows
 * @param performance  { answered, accuracy } from scenario-performance, task level
 * @param humanReviews number of reviewed / verified items touching this dimension
 */
export function dimensionSources({ dimension, responses = [], performance = null, humanReviews = 0 }) {
  const dim = DIMENSION_BY_ID.get(dimension?.dimension);
  const scenario = scenarioEvidence(responses).find(s => s.dimension === dimension?.dimension) || null;
  const behaviouralLevel = dimension?.current_evidence_level || 'unknown';
  const resolved = resolveLevel({ behaviouralLevel, scenarioLevel: scenario?.scenario_level || 'none' });

  const rows = [
    {
      ...EVIDENCE_SOURCE_TYPES[0],
      state: dimension?.self_reported_preference ? 'Recorded' : 'Not stated',
      reading: dimension?.self_reported_preference || 'You have not told us where you stand on this.',
      applicable: Boolean(dimension?.self_reported_preference),
      weight: sourceWeight('self_report'),
    },
    {
      ...EVIDENCE_SOURCE_TYPES[1],
      state: scenario ? SCENARIO_LEVEL_LABELS[scenario.scenario_level] : 'No scenarios answered',
      reading: scenario
        ? `${DIRECTION_WORD[scenario.direction]} lean across ${scenario.scenarios_answered} scenario${scenario.scenarios_answered === 1 ? '' : 's'} (${scenario.response_count} answer${scenario.response_count === 1 ? '' : 's'} touching this).`
        : 'No scenario answers touch this yet.',
      applicable: Boolean(scenario),
      direction: scenario?.direction || 'none',
      weight: sourceWeight(scenario && scenario.response_count > 1 ? 'scenario_pattern' : 'single_scenario'),
    },
    {
      ...EVIDENCE_SOURCE_TYPES[2],
      state: BEHAVIOURAL_STATE[behaviouralLevel],
      reading: (dimension?.behavioral_evidence || [])[0]?.text
        || (behaviouralLevel === 'unknown' ? 'No real experiment has produced a reading on this yet.' : dimension?.statement || ''),
      applicable: behaviouralLevel !== 'unknown',
      direction: dimension?.direction || 'none',
      weight: sourceWeight((dimension?.behavioral_evidence_count || 0) >= 2 ? 'repeated_behaviour' : 'experiment'),
    },
    {
      ...EVIDENCE_SOURCE_TYPES[3],
      // Task performance is measured per task, never per preference dimension, so
      // it is honestly "not applicable" here unless a scored task exists.
      state: performance?.answered ? `${performance.answered} scored task${performance.answered === 1 ? '' : 's'}` : 'Not applicable',
      reading: performance?.answered
        ? `Task accuracy is tracked separately and says nothing about whether you enjoy this work.`
        : 'No validated task has been scored against this.',
      applicable: Boolean(performance?.answered),
      weight: sourceWeight('experiment'),
    },
    {
      ...EVIDENCE_SOURCE_TYPES[4],
      state: humanReviews ? `${humanReviews} reviewed item${humanReviews === 1 ? '' : 's'}` : 'None yet',
      reading: humanReviews
        ? 'Reviewed by someone who does this work, which carries the most contextual trust.'
        : 'Nothing here has been professionally reviewed yet.',
      applicable: humanReviews > 0,
      weight: sourceWeight('reviewed'),
    },
  ];

  return {
    dimension: dimension?.dimension,
    dimension_label: dimension?.dimension_label || dim?.label || '',
    noun: dim?.noun || '',
    sources: rows,
    scenario,
    resolved_level: resolved.level,
    level_source: resolved.source,
    behaviour_settled: behaviourWins(behaviouralLevel),
    confidence: confidenceFor({
      behaviouralConfidence: dimension?.confidence || 0,
      scenario,
      human: humanReviews,
    }),
    interpretation: dimension?.current_interpretation
      || (scenario ? scenario.statement : 'We have limited evidence about this so far.'),
    scenario_heavy: Boolean(scenario) && behaviouralLevel === 'unknown',
    config_version: evidenceConfig().config_version,
  };
}

/**
 * The provenance of every scenario-derived reading on one dimension. Human
 * readable on the surface, with the record ids kept in the row so the trail can
 * still be followed by the team.
 */
export function scenarioProvenance({ dimension, responses = [], scenarios = [] }) {
  const titleFor = (id, key) => scenarios.find(s => s.id === id || s.scenario_key === key)?.title || 'A decision scenario';
  const optionFor = (id, key, optionId) => {
    const s = scenarios.find(x => x.id === id || x.scenario_key === key);
    return (s?.options || []).find(o => o.id === optionId)?.option_text || null;
  };

  return responses
    .filter(r => (r.dimension_signals_generated || []).some(s => s.dimension === dimension))
    .map(r => {
      const signal = (r.dimension_signals_generated || []).find(s => s.dimension === dimension);
      return {
        title: titleFor(r.scenario_id, r.scenario_key),
        option_text: optionFor(r.scenario_id, r.scenario_key, r.selected_option_id),
        direction: signal?.signal_direction,
        strength: signal?.signal_strength,
        context: r.response_context,
        answered_at: r.completed_at || r.created_date || null,
        revised: Boolean(r.previous_option_id),
        // Retained for the team, not shown to the student.
        scenario_id: r.scenario_id,
        scenario_version: r.scenario_version,
        response_id: r.id,
        selected_option_id: r.selected_option_id,
        scoring_version: r.scoring_version,
      };
    })
    .sort((a, b) => new Date(b.answered_at || 0) - new Date(a.answered_at || 0));
}

/**
 * Task performance against experienced fit. Aptitude and preference are different
 * things and this is the one place that says so out loud.
 */
export function performanceVsFit({ performanceScore = null, experiencedFit = null } = {}) {
  if (performanceScore === null && experiencedFit === null) return null;
  const strongPerf = performanceScore !== null && performanceScore >= 70;
  const weakPerf = performanceScore !== null && performanceScore < 50;
  const highFit = experiencedFit !== null && experiencedFit >= 65;
  const lowFit = experiencedFit !== null && experiencedFit < 45;

  let interpretation = 'Performance and experienced fit are tracked separately, and neither one implies the other.';
  if (strongPerf && lowFit) interpretation = 'You performed this type of work effectively, but reported low enjoyment and energy while doing it.';
  else if (weakPerf && highFit) interpretation = 'You enjoyed this work even though your current performance is still developing.';
  else if (strongPerf && highFit) interpretation = 'You performed well and reported enjoying the work. Both readings still come from a small number of experiences.';
  else if (weakPerf && lowFit) interpretation = 'Neither your performance nor your enjoyment was strong here. Performance can develop; enjoyment is the harder one to change.';

  return {
    performance_label: performanceScore === null ? 'Not yet tested' : strongPerf ? 'Strong' : weakPerf ? 'Developing' : 'Mixed',
    fit_label: experiencedFit === null ? 'Not yet tested' : highFit ? 'High' : lowFit ? 'Low' : 'Mixed',
    interpretation,
    caution: 'High performance does not mean high career fit.',
  };
}