/**
 * The short post-experiment realism and usefulness survey.
 *
 * It exists to improve the EXPERIMENT, not to move the student's hypothesis.
 * Nothing written here touches Hypothesis Confidence, a fit score or a
 * validation level: those come from the student's own evidence and from human
 * review. This is field feedback, aggregated for the team behind suppression.
 *
 * Optional by design. It sits alongside the hypothesis update and never blocks
 * it, so a student who skips it still finishes their cycle.
 */
import { base44 } from '@/api/base44Client';

/** The four 1-5 questions, in order. */
export const RATING_QUESTIONS = [
  {
    key: 'realism_rating',
    label: 'How realistic did this experiment feel compared with what you now understand about the career?',
    low: 'Not realistic',
    high: 'Very realistic',
  },
  {
    key: 'career_understanding_rating',
    label: 'Did this experiment help you understand this career better?',
    low: 'Not at all',
    high: 'A great deal',
  },
  {
    key: 'self_learning_rating',
    label: 'Did you learn something new about yourself?',
    low: 'Nothing new',
    high: 'A lot',
  },
  {
    key: 'time_value_rating',
    label: 'Was the time you spent on this experiment worthwhile?',
    low: 'Not worthwhile',
    high: 'Very worthwhile',
  },
];

export const ALIGNMENT_OPTIONS = [
  { value: 'supported', label: 'Supported it' },
  { value: 'mostly_supported', label: 'Mostly supported it' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'mostly_contradicted', label: 'Mostly contradicted it' },
  { value: 'not_enough_information', label: 'Not enough information' },
];

/**
 * The grouping key the aggregate side uses. Deliberately the same rule as
 * blueprintKey in base44/shared/decision-intelligence.js, so one student's
 * wording cannot split an experience into two rows.
 */
export function effectivenessKey(experiment) {
  const base = experiment?.test_question || experiment?.title || 'untitled';
  return String(base).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
}

/**
 * The validation record behind this experiment, read only for its versions, so
 * the response is pinned to the experiment as it was actually run.
 */
export async function loadVersions(experiment) {
  if (!experiment?.id) return null;
  const byId = await base44.entities.ExperimentValidation.filter({ experiment_id: experiment.id }, '-created_date', 1).catch(() => []);
  const key = experiment.blueprint_key;
  const rows = (Array.isArray(byId) && byId.length) || !key
    ? byId
    : await base44.entities.ExperimentValidation.filter({ blueprint_key: key }, '-created_date', 1).catch(() => []);
  return (Array.isArray(rows) ? rows : [])[0] || null;
}

/** This student's own survey for one experiment, if they already sent one. */
export async function loadFeedback(experimentId) {
  if (!experimentId) return null;
  const rows = await base44.entities.ExperimentFeedback
    .filter({ experiment_id: experimentId }, '-submitted_at', 1)
    .catch(() => []);
  return (Array.isArray(rows) ? rows : [])[0] || null;
}

/**
 * Save the survey, pinned to the version of the experiment that was actually
 * run: a later rewrite of the same experiment must not inherit this feedback.
 */
export async function saveFeedback({ experiment, validation, answers, existing }) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const text = (v) => String(v || '').trim() || undefined;
  const payload = {
    experiment_id: experiment.id,
    experiment_title: experiment.title || undefined,
    blueprint_key: experiment.blueprint_key || effectivenessKey(experiment),
    experiment_version: num(validation?.experiment_version) ?? 1,
    role_blueprint_version: num(validation?.role_blueprint_version),
    realism_rating: num(answers.realism_rating),
    career_understanding_rating: num(answers.career_understanding_rating),
    self_learning_rating: num(answers.self_learning_rating),
    time_value_rating: num(answers.time_value_rating),
    realism_notes: text(answers.realism_notes),
    missing_elements_notes: text(answers.missing_elements_notes),
    professional_alignment_rating: answers.professional_alignment_rating || undefined,
    submitted_at: new Date().toISOString(),
  };
  return existing?.id
    ? base44.entities.ExperimentFeedback.update(existing.id, payload)
    : base44.entities.ExperimentFeedback.create(payload);
}