/**
 * Aggregating the post-experiment realism survey, and deciding what the team
 * should look at.
 *
 * Two rules hold the whole file together:
 *  - Nothing leaves here that describes one student. Every number is an average
 *    or a count over students, and a group under MIN_FEEDBACK_STUDENTS returns
 *    its own absence instead of numbers. Free text is never returned; it is only
 *    counted, as a repeated theme.
 *  - A flag is a request for review, never a decision. Nothing here retires an
 *    experiment, changes a validation level or moves a student's confidence.
 *
 * Pure: rows in, arithmetic out.
 */

/** Below this many distinct students, a survey group reports nothing. */
export const MIN_FEEDBACK_STUDENTS = 5;

/** Configurable review thresholds. Changing these changes only what is queued. */
export const FLAG_THRESHOLDS = {
  min_responses: 4,            // never flag on one bad response
  low_realism_value: 2,        // a 1 or a 2 counts as low realism
  low_realism_share: 0.4,      // ...and this share of responses trips the flag
  low_usefulness_avg: 2.5,     // career understanding + time value, averaged
  contradiction_share: 0.3,    // professionals mostly contradicting the experiment
  repeated_missing_theme: 3,   // the same missing component named this many times
};

/**
 * What must be true before an experiment may be called Field Calibrated.
 * Calibration is a claim that the experience has been checked against how the
 * work actually behaves in the field, so it needs a real sample AND human
 * validation — never a handful of survey responses.
 */
export const FIELD_CALIBRATION = {
  min_students: MIN_FEEDBACK_STUDENTS,   // enough distinct students to average
  min_realism_ratings: 5,                // "not enough information" answers do not count
  min_realism_average: 3.5,
  min_validation_level: 2,               // professionally reviewed, not merely drafted
};

/** Answers that MISALIGN with the professional's account, at either strength. */
const MISALIGNED = new Set(['mostly_contradicted', 'strongly_contradicted']);

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const avg = (xs) => {
  const vals = xs.map(num).filter((v) => v !== null);
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
};
const owner = (r) => r?.created_by_id || r?.user_id || null;
const share = (part, whole) => (whole ? Math.round((part / whole) * 100) / 100 : 0);

const STOP = new Set(['the', 'and', 'that', 'with', 'this', 'was', 'were', 'for', 'you', 'your', 'they',
  'their', 'have', 'had', 'not', 'but', 'about', 'from', 'what', 'work', 'more', 'much', 'really',
  'felt', 'feel', 'like', 'just', 'would', 'could', 'there', 'when', 'than', 'then', 'into', 'been',
  'experiment', 'career', 'thing', 'things', 'part', 'parts', 'because', 'people']);

/** Repeated themes in the free text, as words and counts. No student's text is returned. */
export function missingThemes(rows, field = 'missing_elements_notes') {
  const counts = new Map();
  rows.forEach((r) => {
    const words = new Set(String(r?.[field] || '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3 && !STOP.has(w)));
    words.forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
  });
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([theme, mentions]) => ({ theme, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 6);
}

/** One experience's survey picture, plus the flags it raises. */
export function feedbackSummary(rows = [], thresholds = FLAG_THRESHOLDS) {
  const students = new Set(rows.map(owner).filter(Boolean)).size;
  const responses = rows.length;
  if (students < MIN_FEEDBACK_STUDENTS) {
    return {
      suppressed: true,
      students,
      survey_responses: responses,
      reason: `Fewer than ${MIN_FEEDBACK_STUDENTS} students have answered the survey.`,
      // Flags still compute: a review queue that waits for a publishable sample
      // would let a badly-drawn experiment run for weeks.
      review_flags: reviewFlags(rows, thresholds),
    };
  }

  const alignment = rows.map((r) => r.professional_alignment_rating).filter(Boolean);
  const withAlignment = alignment.filter((a) => a !== 'not_enough_information');
  return {
    suppressed: false,
    students,
    survey_responses: responses,
    survey_realism_rating: avg(rows.map((r) => r.realism_rating)),
    /* Counted, never averaged in: students who said they could not judge
       realism are visible as their own number so a thin realism average reads
       as thin. */
    survey_realism_no_basis: rows.filter((r) => r.realism_not_enough_information).length,
    survey_career_understanding_rating: avg(rows.map((r) => r.career_understanding_rating)),
    survey_self_learning_rating: avg(rows.map((r) => r.self_learning_rating)),
    survey_time_value_rating: avg(rows.map((r) => r.time_value_rating)),
    survey_professional_support_rate: withAlignment.length
      ? Math.round((withAlignment.filter((a) => a === 'supported' || a === 'mostly_supported').length / withAlignment.length) * 100)
      : null,
    survey_missing_themes: missingThemes(rows),
    review_flags: reviewFlags(rows, thresholds),
  };
}

/**
 * What the team is asked to look at. Each flag names its own evidence, so a
 * reviewer can disagree with it. No flag changes anything by itself.
 */
export function reviewFlags(rows = [], thresholds = FLAG_THRESHOLDS) {
  const flags = [];
  if (rows.length < thresholds.min_responses) return flags;

  const realism = rows.map((r) => num(r.realism_rating)).filter((v) => v !== null);
  const low = realism.filter((v) => v <= thresholds.low_realism_value).length;
  if (realism.length && share(low, realism.length) >= thresholds.low_realism_share) {
    flags.push({ code: 'low_realism', detail: `${low} of ${realism.length} responses rated realism ${thresholds.low_realism_value} or below.` });
  }

  const usefulness = avg([
    ...rows.map((r) => r.career_understanding_rating),
    ...rows.map((r) => r.time_value_rating),
  ]);
  if (usefulness !== null && usefulness <= thresholds.low_usefulness_avg) {
    flags.push({ code: 'low_usefulness', detail: `Understanding and time value average ${usefulness} out of 5.` });
  }

  const alignment = rows.map((r) => r.professional_alignment_rating).filter((a) => a && a !== 'not_enough_information');
  const contradicted = alignment.filter((a) => MISALIGNED.has(a)).length;
  if (alignment.length >= 3 && share(contradicted, alignment.length) >= thresholds.contradiction_share) {
    flags.push({ code: 'professional_contradiction', detail: `${contradicted} of ${alignment.length} students heard a professional description that misaligned with this experiment.` });
  }

  missingThemes(rows)
    .filter((t) => t.mentions >= thresholds.repeated_missing_theme)
    .slice(0, 3)
    .forEach((t) => flags.push({ code: 'repeated_missing_component', detail: `"${t.theme}" named as missing by ${t.mentions} students.` }));

  return flags;
}

/**
 * May this experiment be marked Field Calibrated?
 *
 * Answered as reasons, not a bare boolean, so the console can say exactly what
 * is missing. Deliberately strict in one direction only: this gate can block a
 * calibration claim, and it never removes one already made, downgrades a
 * validation level, or reacts to a single student's response.
 */
export function fieldCalibrationCheck({ survey = {}, validation_level = null, rules = FIELD_CALIBRATION } = {}) {
  const missing = [];
  const students = survey.students ?? 0;
  const realismRatings = (survey.survey_responses ?? 0) - (survey.survey_realism_no_basis ?? 0);
  const realism = num(survey.survey_realism_rating);

  if (students < rules.min_students) {
    missing.push(`Needs ${rules.min_students} students who rated it; has ${students}.`);
  }
  if (realismRatings < rules.min_realism_ratings) {
    missing.push(`Needs ${rules.min_realism_ratings} realism ratings; has ${Math.max(realismRatings, 0)}. Responses of "not enough information to judge" do not count.`);
  }
  if (realism === null || realism < rules.min_realism_average) {
    missing.push(`Needs an average realism of ${rules.min_realism_average}; ${realism === null ? 'none recorded' : `currently ${realism}`}.`);
  }
  if (num(validation_level) === null || validation_level < rules.min_validation_level) {
    missing.push(`Needs validation level ${rules.min_validation_level} or above; currently ${validation_level ?? 'unscored'}.`);
  }
  return { eligible: missing.length === 0, missing };
}

/** Survey rows grouped by experience, keyed the same way effectiveness is. */
export function groupFeedback(feedback = [], keyFor = (r) => r.blueprint_key) {
  const groups = new Map();
  feedback.forEach((r) => {
    const key = keyFor(r);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  return groups;
}

/**
 * The review queue: every experience with at least one flag, titles and counts
 * only. Ordered by how much is wrong, not by how many students ran it.
 */
export function flaggedExperiments(groups, titles = new Map()) {
  const out = [];
  groups.forEach((rows, key) => {
    const flags = reviewFlags(rows);
    if (!flags.length) return;
    out.push({
      blueprint_key: key,
      blueprint_title: titles.get(key) || rows.find((r) => r.experiment_title)?.experiment_title || key,
      survey_responses: rows.length,
      students: new Set(rows.map(owner).filter(Boolean)).size,
      experiment_versions: [...new Set(rows.map((r) => r.experiment_version).filter((v) => v != null))],
      flags,
      note: 'Queued for human review. No experiment is retired or downgraded automatically.',
    });
  });
  return out.sort((a, b) => b.flags.length - a.flags.length || b.survey_responses - a.survey_responses);
}

export default feedbackSummary;