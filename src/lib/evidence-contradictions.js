/**
 * Contradictions, and confidence in a career estimate.
 *
 * Two rules this file holds, both of them deliberately independent of whether a
 * career currently looks good:
 *
 *  1. Confidence measures HOW MUCH we know, never how favourable it is. A career
 *     whose fit falls because a student disliked the actual work has MORE
 *     evidence behind it than before, so its confidence rises even as its fit
 *     drops. Nothing here reads the fit score.
 *  2. Conflicting evidence is kept, not resolved. When the same characteristic
 *     has been rated high once and low once, both readings stay, the
 *     characteristic is marked mixed, and confidence comes down until further
 *     testing settles it.
 *
 * Pure module, no writes, no imports from the layers that consume it.
 */

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

const HIGH = 7;
const LOW = 4.5;

/**
 * Characteristics the student has rated both ways.
 * Reads the raw per-observation arrays rather than the averages, because an
 * average of 5.75 hides a 9 and a 2.5 — which is exactly the case we care about.
 */
export function detectContradictions(signals = []) {
  const out = [];
  signals.forEach(s => {
    const readings = [...(s.enjoyment || []), ...(s.energy || []), ...(s.desire || [])].filter(n => typeof n === 'number');
    if (readings.length < 2) return;
    const high = readings.filter(n => n >= HIGH);
    const low = readings.filter(n => n <= LOW);
    if (!high.length || !low.length) return;
    out.push({
      id: s.id,
      label: s.label,
      high_count: high.length,
      low_count: low.length,
      occurrences: readings.length,
      note: `You have rated ${s.label.toLowerCase()} positively ${high.length} time${high.length === 1 ? '' : 's'} and negatively ${low.length} time${low.length === 1 ? '' : 's'}. Both readings are kept, and context may explain the difference.`,
      sources: s.sources || [],
    });
  });
  return out;
}

/** Characteristics measured more than once — repeated evidence, worth more. */
export function repeatedCharacteristics(signals = []) {
  return signals.filter(s => (s.ratedCount || 0) >= 2);
}

/**
 * Confidence in the fit estimate, 0-100.
 *
 * Earned by producing evidence, weighted so that direct behavioural evidence
 * (a measured experiment) counts for more than completing something unmeasured,
 * which counts for more than a written reflection, which counts for more than an
 * onboarding answer. Repetition adds on top. Contradictions subtract.
 *
 * The weights live in one object so this can be tuned without touching logic.
 */
export const CONFIDENCE_WEIGHTS = {
  stated: { low: 16, medium: 20, high: 24 },
  measured_experiment: 14,
  completed_experiment: 6,
  proof: 7,
  reflection: 5,
  repeated_characteristic: 3,
  contradiction_penalty: 7,
  max_contradiction_penalty: 21,
  ceiling: 88,
  floor: 12,
};

export function evidenceConfidence({ path = {}, act = {}, signals = [], contradictions = null, weights = CONFIDENCE_WEIGHTS }) {
  const w = { ...CONFIDENCE_WEIGHTS, ...weights };
  const conflicts = contradictions || detectContradictions(signals);

  const measured = act.measured?.length ?? 0;
  const completed = act.completedExps?.length ?? act.completed?.length ?? 0;
  const unmeasured = Math.max(0, completed - measured);

  const base = w.stated[path.confidence_level] ?? w.stated.medium;
  const earned =
    measured * w.measured_experiment +
    unmeasured * w.completed_experiment +
    (act.proof?.length || 0) * w.proof +
    (act.reflections?.length || 0) * w.reflection +
    repeatedCharacteristics(signals).length * w.repeated_characteristic;

  const penalty = Math.min(conflicts.length * w.contradiction_penalty, w.max_contradiction_penalty);
  return clamp(Math.min(base + earned, w.ceiling) - penalty, w.floor, w.ceiling);
}

export default evidenceConfidence;