/**
 * Two levels of Career Experiment, and how much each one is worth as evidence.
 *
 * Quick Test is the default: one uncertainty, one decision, a few minutes. Deep
 * Dive is an optional upgrade in depth: multi-stage work, a real deliverable,
 * richer evaluation. Nothing about the evidence architecture forks — both write
 * the same Experiments and ExperimentMeasurement rows and both flow into the
 * same evidence graph. This module only decides which level a record belongs to
 * and how strongly a set of records should be read.
 *
 * The numbers below are CONFIGURATION, not laws. A single Quick Test is worth
 * less than a Deep Dive, but several consistent Quick Tests can out-weigh one
 * isolated deeper result, and every knob that decides that is in one object so
 * it can be tuned without touching the screens.
 */

export const DEPTHS = {
  quick_test: {
    id: 'quick_test',
    label: 'Quick Test',
    duration_label: '3-5 min',
    minutes: [2, 7],
    typical_minutes: [3, 5],
    blurb: 'One realistic decision, immediate feedback.',
    default_route: '/moment',
    // What one observation of this depth contributes before consistency,
    // diversity and recency are taken into account.
    observation_weight: 1,
    // Quick Tests leave lightweight evidence; they do not need to produce a
    // portfolio artifact every time.
    expects_proof: false,
  },
  deep_dive: {
    id: 'deep_dive',
    label: 'Deep Dive',
    duration_label: '15-30 min',
    minutes: [15, 30],
    typical_minutes: [20, 30],
    blurb: 'Multi-stage work with a deliverable you can keep.',
    default_route: '/experiments/new',
    observation_weight: 3,
    expects_proof: true,
  },
};

export const DEPTH_ORDER = ['quick_test', 'deep_dive'];
export const depthMeta = (id) => DEPTHS[id] || DEPTHS.quick_test;

/** Every knob that turns records into an evidence strength. Tunable. */
export const EVIDENCE_STRENGTH_CONFIG = {
  // Contribution per observation, by where it came from.
  source_weight: {
    quick_test: 1,
    deep_dive: 3,
    proof: 3,
    system_evaluation: 1.5,
    reflection: 0.8,
    onboarding: 0.4,
  },
  // Several observations that agree are worth more than the same count that
  // disagree. Consistency is a multiplier, never a gate.
  consistency_multiplier: { high: 1.25, mixed: 0.85, unknown: 1 },
  // Evidence from more than one kind of source is harder to explain away.
  diversity_bonus_per_kind: 0.5,
  // Recent work describes the student better than work from months ago.
  recency_bonus_recent_days: 30,
  recency_bonus: 0.5,
  // Where the bands sit on the weighted total.
  bands: [
    { id: 'low', label: 'Early evidence', min: 0 },
    { id: 'low_medium', label: 'Some evidence', min: 1.2 },
    { id: 'medium', label: 'Moderate evidence', min: 2.4 },
    { id: 'high', label: 'Strong evidence', min: 4.5 },
    { id: 'very_high', label: 'Very strong evidence', min: 8 },
  ],
};

const QUICK_HOURS = 0.25; // 15 minutes: anything at or under this is a Quick Test

/**
 * Which level an existing Experiments row belongs to.
 *
 * Historical experiments are classified, never rewritten: a long simulation from
 * before this split reads as a Deep Dive because that is what it was.
 */
export function depthOf(experiment) {
  if (!experiment) return 'quick_test';
  if (DEPTHS[experiment.experiment_depth]) return experiment.experiment_depth;
  if (/career moment|quick test/i.test(experiment.experiment_type || '')) return 'quick_test';
  const hours = Number(experiment.estimated_hours);
  if (Number.isFinite(hours) && hours > 0) return hours <= QUICK_HOURS ? 'quick_test' : 'deep_dive';
  // No duration recorded: treat a designed simulation as the deeper thing it
  // was built to be, since Quick Tests always carry their minutes.
  return 'deep_dive';
}

export const isQuickTest = (e) => depthOf(e) === 'quick_test';
export const isDeepDive = (e) => depthOf(e) === 'deep_dive';

/** Counts by level, for "Based on 4 Quick Tests and 1 Deep Dive". */
export function countByDepth(experiments = [], proof = []) {
  const counts = { quick_test: 0, deep_dive: 0, proof: (proof || []).length };
  (experiments || []).forEach(e => { counts[depthOf(e)] += 1; });
  return counts;
}

const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** "4 Quick Tests · 1 Deep Dive · 1 Proof" — the source line under a conclusion. */
export function basedOnParts(counts = {}) {
  const parts = [];
  if (counts.quick_test) parts.push(plural(counts.quick_test, 'Quick Test'));
  if (counts.deep_dive) parts.push(plural(counts.deep_dive, 'Deep Dive'));
  if (counts.proof) parts.push(plural(counts.proof, 'Proof'));
  if (counts.system_evaluation) parts.push(plural(counts.system_evaluation, 'reviewed submission'));
  if (counts.reflection) parts.push(plural(counts.reflection, 'reflection'));
  if (counts.onboarding) parts.push('what you told us at the start');
  return parts;
}

/**
 * How strong a body of evidence is, given what it is made of.
 *
 * Takes a list of { kind, date } items, where kind is a key of
 * source_weight — so a Quick Test, a Deep Dive, a Proof and an onboarding
 * answer are never counted as the same thing.
 */
export function evidenceStrength(items = [], { consistency = 'unknown' } = {}) {
  const C = EVIDENCE_STRENGTH_CONFIG;
  const counts = {};
  let total = 0;

  (items || []).forEach(item => {
    const kind = item?.kind || 'quick_test';
    counts[kind] = (counts[kind] || 0) + 1;
    total += C.source_weight[kind] ?? 1;
  });

  const kinds = Object.keys(counts).filter(k => counts[k] > 0);
  total += Math.max(0, kinds.length - 1) * C.diversity_bonus_per_kind;
  total *= C.consistency_multiplier[consistency] ?? 1;

  const cutoff = Date.now() - C.recency_bonus_recent_days * 86400000;
  if ((items || []).some(i => i?.date && new Date(i.date).getTime() >= cutoff)) total += C.recency_bonus;

  const band = [...C.bands].reverse().find(b => total >= b.min) || C.bands[0];
  return {
    score: Math.round(total * 100) / 100,
    band: band.id,
    label: band.label,
    counts,
    observations: (items || []).length,
    diversity: kinds.length,
    consistency,
    based_on: basedOnParts(counts),
  };
}

/**
 * Should the next thing we offer be a Quick Test or a Deep Dive?
 *
 * Quick Test is the answer almost always. A Deep Dive is only put forward when
 * the student already has a body of short evidence on this career, or the open
 * question genuinely needs sustained work. It is a recommendation, never a gate:
 * both options are always offered.
 */
export function recommendDepth({ quickTests = 0, deepDives = 0, question = '', contradicted = false } = {}) {
  const needsSustainedWork = /build|model|deliverable|produce|write a|end to end|full/i.test(question || '');
  if (deepDives === 0 && (quickTests >= 4 || needsSustainedWork)) {
    return {
      depth: 'deep_dive',
      alternative: 'quick_test',
      reason: needsSustainedWork
        ? 'This question needs work you can actually hand over, so the longer version tells us more.'
        : 'You have a run of short results on this career. A longer one would give the strongest evidence yet.',
    };
  }
  return {
    depth: 'quick_test',
    alternative: 'deep_dive',
    reason: contradicted
      ? 'A short test in a different context is the fastest way to settle readings that point both ways.'
      : 'Short and specific is enough to move this, and you can always go deeper afterwards.',
  };
}

/**
 * The optional Deep Dive nudge, shown once enough short tests exist. Never a
 * requirement: a student can use Unscripted well without ever taking one.
 */
export function deepDiveUnlock({ careerName, testedDimensions = 0, totalDimensions = 0, quickTests = 0, deepDives = 0 } = {}) {
  if (quickTests < 3 || deepDives > 0) return null;
  return {
    headline: totalDimensions
      ? `You have tested ${Math.min(testedDimensions, totalDimensions)} of ${totalDimensions} key ${careerName} dimensions.`
      : `You have run ${plural(quickTests, 'Quick Test')} on ${careerName}.`,
    prompt: 'Want stronger evidence?',
    cta: `Try the ${depthMeta('deep_dive').typical_minutes[0]}-minute ${careerName} Deep Dive`,
  };
}

export default DEPTHS;