/**
 * Rotating micro-measurements.
 *
 * The measurement row still holds every field it always held. What changes is
 * how those fields get filled: a short Career Moment asks at most one question
 * before and one or two after, and the pair rotates from one Moment to the next.
 * Over five or six Moments the profile ends up with evidence across every
 * dimension, without a student ever facing a survey.
 *
 * Nothing here invents a value. A field that has not been asked yet stays absent
 * on the row, which is what "unknown" means in this schema.
 */
import { PRE_FIELDS, POST_FIELDS } from '@/lib/experiment-measurement';

/** Short, conversational wording. The long check-in keeps its own labels. */
const MOMENT_LABELS = {
  actual_enjoyment: { label: 'How much did you enjoy that?', low: 'Not at all', high: 'A lot' },
  actual_difficulty: { label: 'How difficult was that?', low: 'Easy', high: 'Very hard' },
  actual_energy: { label: 'How did that leave you feeling?', low: 'Drained', high: 'Energised' },
  frustration_level: { label: 'How frustrating was that?', low: 'Not at all', high: 'Very' },
  desire_to_repeat: { label: 'Would you want to do another task like this?', low: 'No', high: 'Definitely' },
  self_rated_performance: { label: 'How well do you think you did?', low: 'Poorly', high: 'Very well' },
  post_career_fit_confidence: { label: 'How strongly does this career fit you?', low: 'Not sure', high: 'Very sure' },
  expected_enjoyment: { label: 'How much do you think you will enjoy this?', low: 'Not at all', high: 'A lot' },
  expected_difficulty: { label: 'How difficult do you expect this to be?', low: 'Easy', high: 'Very hard' },
  expected_energy: { label: 'How energising do you expect this to be?', low: 'Flat', high: 'Energised' },
  pre_career_fit_confidence: { label: 'Right now, how strongly do you think this career fits you?', low: 'Not sure', high: 'Very sure' },
};

/** Which pre field a post field can be compared against, for belief correction. */
const PAIRS = {
  actual_enjoyment: 'expected_enjoyment',
  actual_difficulty: 'expected_difficulty',
  actual_energy: 'expected_energy',
  post_career_fit_confidence: 'pre_career_fit_confidence',
};

// Two questions a Moment, rotating. Every post field appears within six Moments.
const ROTATION = [
  ['actual_enjoyment', 'desire_to_repeat'],
  ['actual_difficulty', 'actual_energy'],
  ['actual_enjoyment', 'post_career_fit_confidence'],
  ['frustration_level', 'desire_to_repeat'],
  ['actual_energy', 'self_rated_performance'],
  ['actual_difficulty', 'post_career_fit_confidence'],
];

// An expectation question is only worth interrupting a Moment for occasionally.
const PRE_EVERY = 3;

const field = (key) => {
  const base = [...PRE_FIELDS, ...POST_FIELDS].find(f => f.key === key);
  return base ? { ...base, ...(MOMENT_LABELS[key] || {}) } : null;
};

/** How many times a field already carries an answer across past measurements. */
export function coverage(rows = []) {
  const counts = {};
  POST_FIELDS.forEach(f => { counts[f.key] = 0; });
  rows.forEach(r => POST_FIELDS.forEach(f => {
    if (typeof r?.[f.key] === 'number') counts[f.key] += 1;
  }));
  return counts;
}

/**
 * The questions this Moment should ask.
 *
 * `rows` is the student's past measurement rows. The slot rotates on how many
 * Moments they have completed; a field that has never been answered displaces a
 * well-covered one, so gaps close before anything gets asked a third time.
 */
export function planMeasurements(rows = []) {
  const completed = rows.filter(r => r?.post_completed_at).length;
  const slot = ROTATION[completed % ROTATION.length];
  const counts = coverage(rows);

  const post = [...slot];
  const neverAsked = POST_FIELDS.map(f => f.key).filter(k => !counts[k] && !post.includes(k));
  if (neverAsked.length && counts[post[1]] >= 2) post[1] = neverAsked[0];

  // Pair an expectation with one of this Moment's own questions, so the two
  // halves can actually be compared. No pairable question means no pre question.
  const pairable = completed % PRE_EVERY === 0 ? post.find(k => PAIRS[k]) : null;

  return {
    pre: pairable ? field(PAIRS[pairable]) : null,
    post: post.map(field).filter(Boolean),
  };
}

export { MOMENT_LABELS };