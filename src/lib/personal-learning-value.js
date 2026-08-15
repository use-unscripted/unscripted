/**
 * Personal Learning Value.
 *
 * Experiment Strength asks "is this a well-validated experiment?".
 * This asks a completely different question: "how useful would it be for YOU,
 * right now?" — and the two are deliberately allowed to disagree, because a
 * flawlessly validated experiment that re-tests something a student has already
 * answered teaches them nothing.
 *
 * Everything here is read from the student's own records: the dimensions an
 * experiment claims to test, matched against what their evidence already says
 * about those dimensions, and how many live career hypotheses turn on them.
 */
import { CAREER_DIMENSIONS, DIMENSION_BY_ID } from '@/lib/career-dimensions';

export const PLV_LEVELS = [
  { id: 'low', label: 'Low', min: 0 },
  { id: 'moderate', label: 'Moderate', min: 34 },
  { id: 'high', label: 'High', min: 58 },
  { id: 'very_high', label: 'Very High', min: 78 },
];

export const PLV_WEIGHTS = {
  untested_dimension: 26,   // per dimension with no evidence at all
  conflicting_dimension: 22, // per dimension whose evidence points both ways
  initial_signal: 10,        // per dimension with a single reading
  cross_hypothesis: 12,      // the answer informs more than one live direction
  redundancy_penalty: 18,    // per dimension already settled
  time_penalty: 8,           // long experiments must earn their length
};

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/** The dimension ids an experiment claims to test, from its validation mapping. */
export function claimedDimensions({ validation, experiment }) {
  const tags = new Set([
    ...(validation?.decision_dimension_ids || []),
    ...(validation?.work_characteristics_tested || []),
    ...(experiment?.decision_dimension_ids || []),
    ...(experiment?.work_characteristic_ids || []),
    ...(experiment?.work_characteristics_tested || []),
  ].map(t => String(t).toLowerCase().replace(/\s+/g, '_')));

  return CAREER_DIMENSIONS
    .filter(d => tags.has(d.id) || d.signals.some(s => tags.has(s)))
    .map(d => d.id);
}

/**
 * @param dimensions the student's derived CareerDimensionEvidence rows
 * @param hypotheses live paths, each with the dimension ids it turns on
 */
export function personalLearningValue({ validation, experiment, dimensions = [], hypothesisDimensionIds = [], estimatedMinutes = null } = {}) {
  const ids = claimedDimensions({ validation, experiment });
  if (!ids.length) {
    return {
      score: null,
      level_id: 'moderate',
      level_label: 'Moderate',
      known: false,
      tested: [],
      untested: [],
      reasons: ['We do not yet know which career dimensions this experiment tests, so we cannot say how much it would teach you.'],
      headline: 'Usefulness for you is unclear',
    };
  }

  const rowFor = (id) => dimensions.find(d => d.dimension === id) || null;
  const relevant = new Set(hypothesisDimensionIds);

  const buckets = { untested: [], conflicting: [], initial: [], settled: [] };
  ids.forEach(id => {
    const row = rowFor(id);
    const level = row?.current_evidence_level || 'unknown';
    const label = row?.dimension_label || DIMENSION_BY_ID.get(id)?.label || id;
    const item = { dimension: id, label, level };
    if (level === 'conflicting') buckets.conflicting.push(item);
    else if (level === 'unknown') buckets.untested.push(item);
    else if (level === 'weak') buckets.initial.push(item);
    else buckets.settled.push(item);
  });

  const W = PLV_WEIGHTS;
  const crossCount = ids.filter(id => relevant.has(id)).length;
  let total =
    Math.min(3, buckets.untested.length) * W.untested_dimension
    + Math.min(2, buckets.conflicting.length) * W.conflicting_dimension
    + Math.min(3, buckets.initial.length) * W.initial_signal
    + (crossCount >= 2 ? W.cross_hypothesis : 0)
    - Math.min(3, buckets.settled.length) * W.redundancy_penalty;

  const minutes = Number(estimatedMinutes) || null;
  if (minutes && minutes > 45 && buckets.untested.length < 2) total -= W.time_penalty;

  const score = clamp(total);
  const level = [...PLV_LEVELS].reverse().find(l => score >= l.min) || PLV_LEVELS[0];

  const reasons = [];
  if (buckets.untested.length) {
    reasons.push(`This tests ${buckets.untested.length} area${buckets.untested.length === 1 ? '' : 's'} you have not tested at all: ${buckets.untested.map(b => b.label.toLowerCase()).join(', ')}.`);
  }
  if (buckets.conflicting.length) {
    reasons.push(`Your evidence on ${buckets.conflicting.map(b => b.label.toLowerCase()).join(' and ')} currently points both ways, so this could settle it.`);
  }
  if (buckets.initial.length) {
    reasons.push(`You have one reading on ${buckets.initial.map(b => b.label.toLowerCase()).join(' and ')}, so a second would firm it up.`);
  }
  if (buckets.settled.length) {
    reasons.push(`You already have substantial evidence about ${buckets.settled.map(b => b.label.toLowerCase()).join(', ')}, so that part would mostly repeat what you know.`);
  }
  if (crossCount >= 2) {
    reasons.push('The answer would apply across more than one direction you are still weighing.');
  }

  const headline = buckets.untested.length || buckets.conflicting.length
    ? `Tests ${buckets.untested.length + buckets.conflicting.length} of your open questions`
    : 'Mostly covers ground you have already tested';

  return {
    score,
    level_id: level.id,
    level_label: level.label,
    known: true,
    tested: [...buckets.settled, ...buckets.initial],
    untested: [...buckets.untested, ...buckets.conflicting],
    new_unknowns: buckets.untested.length + buckets.conflicting.length,
    redundant_count: buckets.settled.length,
    cross_hypothesis_count: crossCount,
    reasons,
    headline,
  };
}

/**
 * The best next test for THIS student, which is deliberately not the same
 * question as which experiment is best validated.
 */
export function bestNextTest(rows = []) {
  const scored = rows.filter(r => r.value?.score !== null);
  if (!scored.length) return null;
  const best = [...scored].sort((a, b) =>
    (b.value.score - a.value.score) || ((b.strength.raw_score || 0) - (a.strength.raw_score || 0)))[0];
  const bestValidated = [...rows].sort((a, b) => (b.strength.raw_score || 0) - (a.strength.raw_score || 0))[0];
  // Only recommend when the leader would actually teach this student something.
  // Naming a "best next test" that mostly repeats settled ground is worse than
  // saying none of these stands out.
  const confident = (best.value.score ?? 0) >= PLV_LEVELS[1].min;
  if (!confident) {
    return {
      best_next_test_id: null,
      best_validated_id: bestValidated?.experiment?.id || bestValidated?.id,
      confident: false,
      differ: false,
      explanation: 'None of these stands out as your best next test: they mostly cover ground your evidence has already settled. Consider testing an area you have not looked at yet.',
    };
  }

  return {
    confident: true,
    best_next_test_id: best.experiment?.id || best.id,
    best_validated_id: bestValidated?.experiment?.id || bestValidated?.id,
    differ: (best.experiment?.id || best.id) !== (bestValidated?.experiment?.id || bestValidated?.id),
    explanation: (best.experiment?.id || best.id) === (bestValidated?.experiment?.id || bestValidated?.id)
      ? 'This one is both the best validated option and the one most likely to teach you something new.'
      : `Although ${bestValidated?.experiment?.title || 'the other option'} has stronger overall validation, this one is more likely to teach you something new based on your current evidence.`,
  };
}

export default personalLearningValue;