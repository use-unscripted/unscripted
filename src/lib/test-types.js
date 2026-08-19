/**
 * Experiment TYPES, not separate systems.
 *
 * Every type below runs on the existing machinery: the same Experiments record,
 * the same Role Blueprint behind it, the same evidence and measurement gates,
 * the same validation and the same reflection. A type only changes WHAT a test
 * is aimed at, and how it is described to the student.
 *
 * A type is only ever used when it meaningfully helps close the current
 * Conviction Gap, which is why the picker reads the gap and the candidate
 * question rather than offering a menu of nine things.
 */

export const TEST_TYPES = {
  core_work_test: {
    id: 'core_work_test',
    label: 'Core Work Test',
    purpose: 'Do one real task this kind of role is actually made of, start to finish.',
    produces: 'A first reading on how the central work of this path feels to you.',
  },
  performance_test: {
    id: 'performance_test',
    label: 'Performance Test',
    purpose: 'Produce something you hand over, so how well it went can be judged as well as how it felt.',
    produces: 'A deliverable and a reviewed reading of the work, not only your reaction to it.',
  },
  career_stress_test: {
    id: 'career_stress_test',
    label: 'Career Stress Test',
    purpose: 'Work under this field\u2019s real pressure: the pace, the volume, or the consequences of a call.',
    produces: 'Evidence on whether what you liked in easy conditions still holds in hard ones.',
  },
  environment_test: {
    id: 'environment_test',
    label: 'Environment Test',
    purpose: 'Test the conditions rather than the tasks: structure, autonomy, and time spent with other people.',
    produces: 'A reading on the parts of a job people actually leave over.',
  },
  reality_test: {
    id: 'reality_test',
    label: 'Reality Test',
    purpose: 'Record what you expect first, then do the work, so the gap between the two can be seen.',
    produces: 'The difference between what you assumed about this path and what happened.',
  },
  tradeoff_test: {
    id: 'tradeoff_test',
    label: 'Tradeoff Test',
    purpose: 'Aim straight at the part of this work you would least enjoy, rather than the part you already like.',
    produces: 'Evidence about the cost of this path, which is usually what is missing.',
  },
  contradiction_test: {
    id: 'contradiction_test',
    label: 'Contradiction Test',
    purpose: 'Retest something your readings have gone both ways on, in a different realistic context.',
    produces: 'A decider on evidence that currently points in two directions.',
  },
  comparative_test: {
    id: 'comparative_test',
    label: 'Comparative Test',
    purpose: 'Run the comparable test on a competing direction, so this one has something to be better than.',
    produces: 'Two paths measured on the same question rather than one in isolation.',
  },
  human_reality: {
    id: 'human_reality',
    label: 'Human Reality',
    purpose: 'Ask somebody who does this work the part no task can honestly simulate.',
    produces: 'Evidence about what the field expects, kept separate from readings of how you work.',
  },
};

/** Conditions rather than tasks. */
const ENVIRONMENT = new Set([
  'structure', 'autonomy', 'independent_work', 'teamwork', 'interpersonal', 'stakeholder_conflict',
]);

/** Pressure, volume and consequence. */
const STRESS = new Set(['pace', 'risk_tolerance', 'repetitive_tolerance']);

/** Work that ends in something judgeable. */
const PERFORMANCE = new Set([
  'quantitative_work', 'analytical_intensity', 'writing', 'attention_to_detail', 'creativity', 'research',
]);

/**
 * Which type of test is worth putting forward, given the recommended question,
 * the Conviction Gap it came from, and whether the question is one simulated
 * work can answer at all.
 *
 * Returns a TEST_TYPES entry. Never null: every recommendation is of some type,
 * and Core Work Test is the honest default.
 */
export function pickTestType({ candidate = null, human = null, gapId = null, depth = 'quick_test' } = {}) {
  const v = candidate?.variable;

  if (human) return TEST_TYPES.human_reality;
  if (candidate?.contradicted) return TEST_TYPES.contradiction_test;
  if (candidate?.path_tradeoff || gapId === 'tradeoffs') return TEST_TYPES.tradeoff_test;
  if (gapId === 'comparison' || candidate?.contested_choice || candidate?.differentiates) return TEST_TYPES.comparative_test;
  if (gapId === 'reality_vs_expectations' || candidate?.scenario_unsettled) return TEST_TYPES.reality_test;
  if (gapId === 'work_environment' || ENVIRONMENT.has(v)) return TEST_TYPES.environment_test;
  if (gapId === 'stability' || STRESS.has(v)) return TEST_TYPES.career_stress_test;
  if (gapId === 'capability' || depth === 'deep_dive' || PERFORMANCE.has(v)) return TEST_TYPES.performance_test;
  return TEST_TYPES.core_work_test;
}

export default TEST_TYPES;