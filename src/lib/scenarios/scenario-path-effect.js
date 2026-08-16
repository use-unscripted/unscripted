/**
 * How scenario evidence affected one path, and where it is doing too much work.
 *
 * Scenario answers attach to DIMENSIONS, never to a path, so one answer can inform
 * every path that turns on that dimension without a duplicate response being
 * stored per path. This module reads the path's own dimensions and reports the
 * scenario contribution in words, with a bounded, deliberately small effect:
 *
 *  - it may nudge a path slightly either way,
 *  - it may name a new uncertainty,
 *  - it can never eliminate a path, produce high confidence, or outrank
 *    conflicting behavioural evidence.
 */
import { scenarioEvidence } from '@/lib/scenarios/scenario-signals';
import { behaviourWins } from '@/lib/scenarios/evidence-hierarchy';
import { CAREER_DIMENSIONS } from '@/lib/career-dimensions';

/** The largest amount scenario evidence may move a path's reading, in points. */
export const MAX_SCENARIO_PATH_EFFECT = 3;

const dimensionsForVariables = (variables = []) => {
  const ids = new Set(variables.map(v => String(v).toLowerCase()));
  return CAREER_DIMENSIONS.filter(d => ids.has(d.id) || d.signals.some(s => ids.has(s))).map(d => d.id);
};

/**
 * @param path        the PathRecommendations row
 * @param variables   the uncertainty variable ids this path turns on
 * @param responses   this student's ScenarioResponse rows
 * @param dimensions  behavioural dimension rows (for the disproportion check)
 */
export function scenarioPathEffect({ path, variables = [], responses = [], dimensions = [] }) {
  const wanted = new Set(dimensionsForVariables(variables));
  const relevant = scenarioEvidence(responses).filter(s => wanted.has(s.dimension));
  if (!relevant.length) return null;

  const levelOf = (id) => dimensions.find(d => d.dimension === id)?.current_evidence_level || 'unknown';
  const behaviouralCount = [...wanted].filter(id => levelOf(id) !== 'unknown').length;

  const contributions = relevant.map(s => ({
    dimension: s.dimension,
    dimension_label: s.dimension_label,
    // Never phrased as a result about the student.
    note: s.direction === 'draws_toward'
      ? `Several choices favoured ${s.noun}.`
      : s.direction === 'draws_away'
        ? `Several choices leaned away from ${s.noun}.`
        : `Your answers about ${s.noun} pointed both ways.`,
    direction: s.direction,
    level: s.scenario_level,
    // Behaviour on this dimension already settled it, so the scenario reading is
    // reported but contributes nothing.
    overridden_by_behaviour: behaviourWins(levelOf(s.dimension)),
  }));

  const counted = contributions.filter(c => !c.overridden_by_behaviour);
  const toward = counted.filter(c => c.direction === 'draws_toward').length;
  const away = counted.filter(c => c.direction === 'draws_away').length;
  const net = toward - away;
  const effect = Math.max(-MAX_SCENARIO_PATH_EFFECT, Math.min(MAX_SCENARIO_PATH_EFFECT, net));

  return {
    path_id: path?.id || null,
    path_name: path?.path_name || null,
    contributions,
    effect,
    effect_label: effect > 0 ? 'contributed slightly' : effect < 0 ? 'weakened slightly' : 'made no difference',
    // Kept visible whenever hypothetical answers outnumber real readings.
    scenario_heavy: counted.length > behaviouralCount,
    behavioural_note: counted.length > behaviouralCount
      ? `Real ${path?.path_name ? `${path.path_name.toLowerCase()} ` : ''}work evidence remains limited.`
      : null,
    new_uncertainties: contributions.filter(c => c.direction === 'unclear' && !c.overridden_by_behaviour).map(c => c.dimension),
    caveat: 'Scenario evidence currently suggests a direction. It cannot rule this path in or out.',
  };
}

export default scenarioPathEffect;