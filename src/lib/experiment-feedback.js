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
    label: 'How realistic did this experience feel for the type of work it was meant to represent?',
    low: 'Not realistic',
    high: 'Very realistic',
    /* A student with no way to judge realism must be able to say so. Answering
       this way records the response and stores NO rating, so an honest "I can't
       tell" never lands in the realism average as a middling 3. */
    allowNoBasis: true,
  },
  {
    key: 'career_understanding_rating',
    label: 'Did this experience help you understand this Path better?',
    low: 'Not at all',
    high: 'A great deal',
  },
  {
    key: 'self_learning_rating',
    label: 'Did you learn something useful about yourself?',
    low: 'Nothing new',
    high: 'A lot',
  },
  {
    key: 'time_value_rating',
    label: 'Was the time worthwhile for what you learned?',
    low: 'Not worthwhile',
    high: 'Very worthwhile',
  },
];

/**
 * How closely the professional's account of the real work matched the
 * experiment. Only asked when Human Reality was actually completed: a student
 * who never spoke to anyone has nothing to compare.
 *
 * The stored values are unchanged from the original enum so existing responses
 * keep counting; only the wording students read is aligned/misaligned.
 */
export const ALIGNMENT_OPTIONS = [
  { value: 'supported', label: 'Strongly aligned' },
  { value: 'mostly_supported', label: 'Mostly aligned' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'mostly_contradicted', label: 'Mostly misaligned' },
  { value: 'strongly_contradicted', label: 'Strongly misaligned' },
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

/**
 * Did this student actually speak to a professional about this experiment?
 * Read from the outreach they recorded, never assumed: the alignment question
 * only appears when there is a real conversation behind it.
 */
export async function loadHumanReality(experiment) {
  if (!experiment?.id) return false;
  const rows = await base44.entities.OutreachContacts
    .filter({ experiment_id: experiment.id }, '-created_date', 20)
    .catch(() => []);
  const DONE = new Set(['responded', 'call_scheduled', 'completed']);
  return (Array.isArray(rows) ? rows : []).some(r =>
    r.deletion_status !== 'deleted' && (DONE.has(r.response_status) || Boolean(r.call_date)));
}

/**
 * Everything the response is pinned to, so a feedback row can be read later
 * against the exact experiment version, path, cycle and unknown it describes.
 * Read at submission time, which is why the validation level is the level AT
 * COMPLETION rather than whatever the experiment is scored at months later.
 */
export function feedbackContext({ experiment, validation, cycle, humanReality }) {
  return {
    path_id: experiment?.path_id || experiment?.career_hypothesis_id || cycle?.selected_path_id || undefined,
    path_name: experiment?.path_name || cycle?.selected_path_name || undefined,
    cycle_id: experiment?.career_cycle_id || experiment?.cycle_id || cycle?.id || undefined,
    unknown_id: experiment?.unresolved_question_id
      || (experiment?.uncertainty_ids || [])[0]
      || (experiment?.decision_dimension_ids || [])[0]
      || undefined,
    unknown_label: experiment?.uncertainty_label || experiment?.unresolved_question || experiment?.test_question || undefined,
    validation_level_at_completion: typeof validation?.validation_level === 'number' ? validation.validation_level : undefined,
    validation_status_at_completion: validation?.validation_status || undefined,
    human_reality_completed: Boolean(humanReality),
  };
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
export async function saveFeedback({ experiment, validation, answers, existing, context = {} }) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const text = (v) => String(v || '').trim() || undefined;
  const payload = {
    ...context,
    experiment_id: experiment.id,
    experiment_title: experiment.title || undefined,
    blueprint_key: experiment.blueprint_key || effectivenessKey(experiment),
    experiment_version: num(validation?.experiment_version) ?? 1,
    role_blueprint_version: num(validation?.role_blueprint_version),
    /* "Not enough information to judge" is recorded as its own answer and
       clears the rating, so it is never averaged as a score. */
    realism_rating: answers.realism_not_enough_information ? undefined : num(answers.realism_rating),
    realism_not_enough_information: Boolean(answers.realism_not_enough_information),
    career_understanding_rating: num(answers.career_understanding_rating),
    self_learning_rating: num(answers.self_learning_rating),
    time_value_rating: num(answers.time_value_rating),
    realism_notes: text(answers.realism_notes),
    missing_elements_notes: text(answers.missing_elements_notes),
    professional_alignment_rating: answers.professional_alignment_rating || undefined,
    submitted_at: new Date().toISOString(),
  };
  const saved = existing?.id
    ? await base44.entities.ExperimentFeedback.update(existing.id, payload)
    : await base44.entities.ExperimentFeedback.create(payload);

  /* An optional step, so it needs its own event: skipping it is not drop-off in
     the cycle, and until now nothing recorded that anyone answered it. */
  await import('@/lib/analytics/decision-funnel-events')
    .then(m => m.feedbackSubmitted({
      experimentId: experiment.id,
      pathId: payload.path_id,
      cycleId: payload.cycle_id,
    }))
    .catch(() => {});

  return saved;
}