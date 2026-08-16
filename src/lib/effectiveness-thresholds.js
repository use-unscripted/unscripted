/**
 * The frontend's copy of the effectiveness sample-size gate.
 *
 * The frontend cannot import backend modules, so the numbers live in two
 * places: base44/shared/effectiveness-thresholds.js for the dashboard function,
 * and this file for anything rendered. src/lib/effectiveness-thresholds.test.js
 * imports both and fails if they drift, so treat them as one setting.
 *
 * Why a gate at all: a completion-derived rate computed from zero completions
 * is not a low score, it is an absence of data. Below the threshold the number
 * is withheld and the surface says so.
 */

export const EFFECTIVENESS_THRESHOLDS = {
  student_facing: {
    min_students_completed: 25,
    min_survey_responses: 5,
  },
  admin: {
    min_students_completed: 5,
    min_survey_responses: 4,
  },
};

export const NOT_ENOUGH_DATA = 'Not enough data yet.';
export const INSUFFICIENT_SAMPLE = 'Insufficient Sample';

const int = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** A percentage, or null when the denominator is zero. */
export function safeRate(part, whole) {
  const w = int(whole);
  if (!w) return null;
  return Math.round((int(part) / w) * 100);
}

/** The same gate the backend applies, for surfaces that render a reading. */
export function effectivenessGate({
  students_completed = 0,
  survey_responses = 0,
  audience = 'admin',
  thresholds = EFFECTIVENESS_THRESHOLDS,
} = {}) {
  const rules = thresholds[audience] || thresholds.admin;
  const completed = int(students_completed);
  const responses = int(survey_responses);
  const reasons = [];

  if (completed < rules.min_students_completed) {
    reasons.push(`Needs ${rules.min_students_completed} students who completed it; has ${completed}.`);
  }
  if (responses < rules.min_survey_responses) {
    reasons.push(`Needs ${rules.min_survey_responses} survey responses; has ${responses}.`);
  }
  if (!completed) reasons.push('No student has completed this experiment, so every completion rate has a zero denominator.');

  return {
    audience,
    suppressed: reasons.length > 0,
    insufficient_sample: reasons.length > 0,
    students_completed: completed,
    survey_responses: responses,
    required: { ...rules },
    reasons,
    label: reasons.length ? INSUFFICIENT_SAMPLE : null,
    message: reasons.length ? NOT_ENOUGH_DATA : null,
  };
}

export default effectivenessGate;