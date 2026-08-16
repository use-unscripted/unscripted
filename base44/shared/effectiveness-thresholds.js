/**
 * Minimum samples before an effectiveness number may be read as a conclusion.
 *
 * The audit this exists to answer: rows were being published with
 * students_completed = 0 and survey_responses = 0 while suppressed = false. The
 * cause was that suppression counted students who STARTED an experiment, while
 * every rate below it (completion, evidence, reflection, changed view) is about
 * students who FINISHED. Five starts and no finishes therefore produced "0%
 * evidence submitted" and read as a finding about the experiment rather than as
 * an absence of data. Two rules close that:
 *
 *  1. A conclusion is gated on the denominator it actually uses — completions
 *     for completion-derived rates, survey responses for survey-derived ones.
 *  2. A zero denominator returns null, never 0%. `part / (whole || 1)` invents
 *     a denominator and turns "nobody finished" into "nobody submitted
 *     evidence", which is a different claim.
 *
 * Two audiences, two thresholds. Student-facing numbers must be a real field
 * result. Admins may always inspect raw counts, but below the admin threshold
 * the row is labelled Insufficient Sample and carries no conclusion.
 *
 * A mirror of this file exists at src/lib/effectiveness-thresholds.js for the
 * frontend, which cannot import backend modules. The numbers in the two files
 * are asserted equal by src/lib/effectiveness-thresholds.test.js — change both
 * together.
 *
 * Pure configuration plus arithmetic. Nothing here writes, and nothing here
 * downgrades an experiment: the gate withholds a claim, it never makes one.
 */

export const EFFECTIVENESS_THRESHOLDS = {
  /** What a student may be shown as a field result. */
  student_facing: {
    min_students_completed: 25,
    min_survey_responses: 5,
  },
  /** What the team may read as a conclusion. Raw counts stay visible below it. */
  admin: {
    min_students_completed: 5,
    min_survey_responses: 4,
  },
};

/** Wording used everywhere a suppressed conclusion would otherwise appear. */
export const NOT_ENOUGH_DATA = 'Not enough data yet.';
export const INSUFFICIENT_SAMPLE = 'Insufficient Sample';

/** Claims that may never be made below the required sample. */
export const GATED_CLAIMS = ['effective', 'high-performing', 'high-realism', 'field-calibrated'];

const int = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * A percentage, or null when the denominator is zero. Never `whole || 1`.
 */
export function safeRate(part, whole) {
  const w = int(whole);
  if (!w) return null;
  return Math.round((int(part) / w) * 100);
}

/**
 * May this row's effectiveness numbers be read as a conclusion?
 *
 * Returns reasons rather than a bare boolean, so the console can say exactly
 * what is missing instead of showing an empty cell.
 */
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
  // A zero denominator is its own failure: without completions there is no rate
  // to compute at all, whatever the thresholds say.
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