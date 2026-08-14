/**
 * How useful was this experiment at helping the student learn something real?
 *
 * The trap this module exists to avoid: scoring an experiment by whether it
 * CHANGED the student's mind. An experiment that confirms what a student
 * expected, with real evidence behind it, can be the most valuable thing they
 * have done — it turns a belief into something they can act on. So confirmation
 * scores, and only an experiment that produced no usable reading at all scores
 * near zero.
 *
 * Every input is read from records the student already produced. Nothing here
 * infers a missing value: an absent input contributes nothing rather than a
 * guessed middle, and `inputs_missing` says which ones were absent, so a score
 * built on thin data is visible as such rather than quietly averaged in.
 */

/** The weights, in one place. Interpretable on purpose: no learned model here. */
export const INFORMATION_VALUE_WEIGHTS = {
  resolved_uncertainty: 26,      // an unknown moved off the open list
  revealed_uncertainty: 12,      // a new unknown surfaced, which is real learning
  confidence_movement: 18,       // moved either way; direction is not the point
  confirmed_expectation: 12,     // expectation held up, with evidence behind it
  expectation_gap: 16,           // reality diverged from the prediction
  student_usefulness: 18,        // the student said it taught them something
  transferable: 10,              // the dimension informs more than one hypothesis
  completed: 8,                  // finished, so the reading is of real work
  evidence_submitted: 6,         // they produced something we can point at
  time_penalty_per_hour: 1.5,    // long tests must earn their length
};

export const VALUE_BANDS = [
  { min: 70, key: 'high', label: 'High information value' },
  { min: 45, key: 'moderate', label: 'Moderate information value' },
  { min: 20, key: 'low', label: 'Low information value' },
  { min: 0, key: 'minimal', label: 'Little usable information' },
];

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * The outcome of one experiment, as a category rather than a verdict.
 * Deliberately not two-valued: an experiment is allowed to resolve one thing and
 * open another, or to teach nothing usable.
 */
export function evidenceOutcome({ strengthened = [], weakened = [], resolved = [], added = [], decision } = {}) {
  if (decision === 'modify_hypothesis') return 'modified';
  const s = strengthened.length, w = weakened.length;
  if (!s && !w && !resolved.length) return 'insufficient_information';
  if (resolved.length && added.length) return 'resolved_and_revealed';
  if (s && w) return 'mixed';
  if (w && !s) return 'weakened';
  if (s && !w) return 'strengthened';
  return 'mixed';
}

/**
 * The information value of one completed experiment.
 *
 * `measurement` is the ExperimentMeasurement row (pre and post readings),
 * `synthesis` the reviewed evidence synthesis, `reflection` the student's own
 * write-up. Pure — pass what you loaded.
 */
export function informationValue({
  synthesis = {},
  measurement = null,
  reflection = null,
  experiment = null,
  resolved = [],
  added = [],
  crossCareerCount = 1,
} = {}) {
  const W = INFORMATION_VALUE_WEIGHTS;
  const reasons = [];
  const missing = [];
  let total = 0;

  if (resolved.length) {
    total += W.resolved_uncertainty * Math.min(1, resolved.length / 2);
    reasons.push(`Resolved ${resolved.length} open question${resolved.length === 1 ? '' : 's'}.`);
  }
  if (added.length) {
    total += W.revealed_uncertainty;
    reasons.push('Revealed a new unknown that was not visible before.');
  }

  const before = num(synthesis?.before?.confidence);
  const after = num(synthesis?.after?.confidence);
  if (before === null || after === null) {
    missing.push('confidence movement');
  } else {
    const move = Math.abs(after - before);
    if (move >= 3) {
      total += W.confidence_movement * Math.min(1, move / 20);
      reasons.push('Materially moved how confident we can be about this direction.');
    }
  }

  // Expectation vs reality. A prediction that held up is evidence, not a null
  // result, so it scores — just less than a genuine surprise.
  const predicted = num(measurement?.expected_enjoyment);
  const actual = num(measurement?.actual_enjoyment);
  if (predicted === null || actual === null) {
    missing.push('expectation vs reality');
  } else {
    const gap = Math.abs(actual - predicted);
    if (gap >= 2) {
      total += W.expectation_gap * Math.min(1, gap / 4);
      reasons.push('What actually happened differed from what the student predicted.');
    } else {
      total += W.confirmed_expectation;
      reasons.push('The student\u2019s expectation held up under real work, which is itself usable evidence.');
    }
  }

  // The student's own verdict. Read from what they wrote rather than a rating we
  // never asked for: a filled-in "what changed" is the strongest signal we have.
  const said = [reflection?.misconception_changed, reflection?.assumptions_changed, reflection?.surprises, reflection?.lessons]
    .map(s => String(s || '').trim()).filter(Boolean);
  if (!reflection) missing.push('student reflection');
  else if (said.length) {
    total += W.student_usefulness * Math.min(1, said.length / 2);
    reasons.push('The student described something they now understand differently.');
  }

  if (crossCareerCount >= 2) {
    total += W.transferable;
    reasons.push(`The dimension tested informs ${crossCareerCount} directions, not one.`);
  }
  if (experiment?.status === 'completed') total += W.completed;
  else missing.push('completion');

  const hours = num(experiment?.estimated_hours);
  if (hours && hours > 1) total -= W.time_penalty_per_hour * Math.min(hours, 8);

  const score = clamp(total);
  const band = VALUE_BANDS.find(b => score >= b.min) || VALUE_BANDS[VALUE_BANDS.length - 1];
  return {
    score,
    band: band.key,
    band_label: band.label,
    reasons,
    // Named, never filled in. A score computed without the post-experiment
    // reading is a different number from one computed with it, and the dashboard
    // has to be able to tell them apart.
    inputs_missing: missing,
    confident: missing.length === 0,
  };
}

/** Which unknowns closed and which appeared, comparing two update rows. */
export function unknownsDelta(previousUnknowns = [], currentUnknowns = []) {
  const norm = (s) => String(s || '').trim().toLowerCase();
  const before = new Map(previousUnknowns.filter(Boolean).map(u => [norm(u), u]));
  const now = new Map(currentUnknowns.filter(Boolean).map(u => [norm(u), u]));
  return {
    resolved: [...before.entries()].filter(([k]) => !now.has(k)).map(([, v]) => v),
    added: [...now.entries()].filter(([k]) => !before.has(k)).map(([, v]) => v),
  };
}

export default informationValue;