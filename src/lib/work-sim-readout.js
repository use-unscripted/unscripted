/**
 * The work simulation read-out, assembled as data.
 *
 * Pure. One function, `buildWorkSimReadout(run, measurement, options)`, takes a
 * WorkSimulationRun row plus an ExperimentMeasurement row and returns the four
 * blocks in docs/simulation-mvp-plan.md section 4. It renders nothing, calls no
 * model, touches no network and reads no clock, so the anti-horoscope rules are
 * testable rather than aspirational.
 *
 * THE SHAPE THIS RETURNS, which the UI can rely on:
 *
 *   {
 *     version: 1,
 *     simulation: { key, version, title, career_name },
 *     status: 'completed' | 'abandoned' | 'in_progress',
 *     complete: boolean,
 *     note: string | null,          // present only when the run did not finish
 *     falsifier_label: string,      // the label above every `falsifier` string
 *     blocks: {
 *       predictions: {              // Block A. Always four rows, always in order.
 *         id: 'A', heading, rows: [PredictionRow, PredictionRow, PredictionRow, PredictionRow]
 *       },
 *       checks: {                   // Block B
 *         id: 'B', heading, note, degraded, scored_count, total_count,
 *         rows: [CheckRow],         // the three that need no model
 *         model_notes: [CheckRow],  // the two model-scored ones, when they exist
 *         not_scored: [{ id, criterion }]  // the ones with no result, named not hidden
 *       },
 *       comparison: {               // Block C
 *         id: 'C', heading, available, intro,
 *         student_spec: { source: 'student', label, text } | null,
 *         reference: { label, author, role, text } | null,
 *         missing: { reason, body } | null
 *       },
 *       limits: { id: 'D', heading, body }   // fixed text, always present
 *     }
 *   }
 *
 *   PredictionRow = {
 *     id: 'enjoyment' | 'energy' | 'performance' | 'want_more',
 *     label,
 *     status: 'gap' | 'no_gap' | 'no_prediction' | 'no_outcome' | 'not_comparable',
 *     predicted: number | null, predicted_text: string | null,
 *     actual: number | null, actual_text: string | null,
 *     gap: number | null,          // actual minus predicted, signed
 *     gap_size: number | null,     // the same, unsigned
 *     scale: 'points' | null,      // what `gap` is counted in
 *     threshold_applies: boolean,  // false on the want-more row, which is not numeric
 *     clears_threshold: boolean | null,
 *     lines: [string],             // our copy, in reading order
 *     falsifier: string,
 *     facts: object                // the raw numbers behind the row, for the UI
 *   }
 *
 *   CheckRow = {
 *     id, criterion, passed: boolean | null, scored_by: 'checks' | 'model',
 *     evidence: { source: 'checks' | 'model', text } | null,
 *     falsifier: string | null
 *   }
 *
 * The five rules from the plan are enforced here, in code, so that the UI cannot
 * quietly break them:
 *
 * 1. No adjective about the student without a number or a quote under it. Every
 *    row that makes a claim is built from numbers that exist, and `assertRules`
 *    throws if a claim row ships with nothing in `facts`.
 * 2. A gap under PREDICTION_GAP_THRESHOLD points is reported as no gap and takes
 *    the "you called this one" branch. One constant, one edit. Enjoyment uses
 *    the same threshold but measures the gap to the near edge of the range the
 *    four buttons stand for, because subtracting a 1 to 10 prediction from a
 *    four button reading invents a gap out of the spacing of the buttons. The
 *    reasoning, and what a no gap can still be hiding, is written out at
 *    REACTION_BANDS. Read it before changing either half of that comparison.
 * 3. Every claim carries what would overturn it. `falsifier` is not optional on a
 *    claim row.
 * 4. No trait nouns, no fit score, no percentage, no verdict, and the word "fit"
 *    never appears. `findBannedLanguage` walks every string this module authored
 *    and `assertRules` throws on a hit. Student text and check details are exempt,
 *    because a student may write whatever they like and we quote it verbatim.
 *    A sentence a model wrote is not exempt: `scoreChecks` runs it through
 *    `bannedLanguageIn` and drops the whole row into the not-scored list if it
 *    fails, which is the same hole a missing review leaves. The first guard is
 *    in work-sim-review.js, where such an answer is rejected before it is
 *    stored at all.
 * 5. It can say we do not know. When the two model-scored criteria are absent the
 *    performance row says so, keeps its place, and carries no number. It never
 *    fabricates one and never passes three checks off as five.
 */
import { NORTHGATE_PM } from '@/lib/work-sims/northgate-pm';
import { entityDate } from '@/lib/dates';

/**
 * How far a prediction has to miss, on the 10 point scale, before the read-out
 * calls it a gap. Under this it says "you called this one" and moves on.
 *
 * Product call 6 in docs/simulation-mvp-plan.md: a working default, not agreed.
 * It is one constant on purpose, so changing it is one edit and not a hunt.
 *
 * It applies to energy, to performance and to enjoyment. Enjoyment measures the
 * distance differently, for the reason written out at REACTION_BANDS, but the
 * number it compares against this threshold is points on the same 1 to 10
 * scale.
 */
export const PREDICTION_GAP_THRESHOLD = 2;

/** The scale every prediction in Block A is made on. */
const SCALE_MIN = 1;
const SCALE_MAX = 10;

/**
 * The four answers the during-task check-in offers, ordered, with the score
 * each one writes.
 *
 * A copy of REACTIONS from career-moment.js, deliberately. That module pulls in
 * the SDK, the hypothesis engine and half the app, and this one is pure by
 * design and tested without a browser. The copy is held to the original by a
 * test in SimReadout.test.jsx, which runs where importing both is free, so the
 * two cannot drift without something going red.
 */
export const REACTION_SCALE = [
  { score: 2, label: 'Not for me' },
  { score: 5, label: 'Neutral' },
  { score: 8, label: 'Enjoyed it' },
  { score: 10, label: 'Loved it' },
];

/**
 * ENJOYMENT IS COMPARED AGAINST A RANGE, NOT A POINT, AND HERE IS WHY.
 *
 * The prediction is a 1 to 10 tap. The outcome is not: it is a tap on the four
 * button reaction row, which writes 2, 5, 8 or 10 and nothing in between.
 * Subtracting one from the other manufactures a gap out of the spacing of the
 * buttons, because the smallest move those buttons can express is already 2 or
 * 3 points. Predict 7, tap "Enjoyed it" twice, and a subtraction calls that a
 * 1 point miss for having enjoyed it exactly as much as you said you would.
 *
 * So the outcome is read as what it is, a range. "Enjoyed it" means somewhere
 * between 6.5 and 9 on the same 1 to 10 scale, the edges sitting halfway
 * between neighbouring buttons. Two taps give the average of the two ranges,
 * which is the set of averages those two answers are consistent with. The gap
 * is the distance from the prediction to the near edge of that range, so it is
 * the smallest miss the data can support:
 *
 *   prediction inside the range        no gap, and it is honest to say so
 *   outside it by under 2 points       under the threshold, "you called this one"
 *   outside it by 2 points or more     a gap, in points, on the predicted scale
 *
 * BOTH DIRECTIONS MATTER, AND AN EARLIER VERSION OF THIS ONLY GOT ONE OF THEM.
 * It put the prediction on the nearest of the four answers and counted how many
 * answers apart the two were. That never invented a gap and it buried real
 * ones: predicted 9 against two taps of "Neutral" is one answer apart, so it
 * printed "you called this one" at a 4 point miss, and predicted 1 against
 * readings averaging 6.5 printed the same at 5.5. Burying that is worse than
 * the artefact it was solving. The drop between the two readings is the number
 * this whole slice exists to produce, and a student who predicted 9 and hated
 * it has to be told so.
 *
 * THE SENSITIVITY, so nobody has to rediscover it.
 *
 * A no gap here means every value the buttons could have meant is within
 * PREDICTION_GAP_THRESHOLD of the prediction. Measured against the button's own
 * number the miss can be larger, by at most the half width of the range it sits
 * in, which is 1.5 points on the widest of the four. So the arithmetic ceiling
 * on what "you called this one" can hide is just under 3.5 points, and since
 * predictions are whole numbers the worst real case is 3: predict 8, tap
 * "Neutral" twice, a range that stops at 6.5. Nothing wider than that is ever
 * buried, against 5.5 under the comparison this replaced.
 *
 * The other direction is bounded too. The gap printed is the smallest one the
 * taps are consistent with and never the largest, so 2.5 points reported means
 * at least 2.5. It is never the button spacing on its own: predict 7, tap
 * "Loved it" twice, and the gap is 2 points, because the lowest reading that
 * button can mean is 9.
 *
 * If a finer reading is wanted the fix is to ask for enjoyment on the same 1 to
 * 10 scale during the task. It is not to go back to subtracting two different
 * scales, and it is not to widen the ranges until nothing reports.
 *
 * The raw numbers are all still on the row: `facts.average`, `facts.band` and
 * every sample. The offline analysis in section 7 of the plan reads those and
 * inherits this same caveat.
 */
export const REACTION_BANDS = REACTION_SCALE.map((option, i) => ({
  score: option.score,
  label: option.label,
  low: i === 0 ? SCALE_MIN : (REACTION_SCALE[i - 1].score + option.score) / 2,
  high: i === REACTION_SCALE.length - 1 ? SCALE_MAX : (option.score + REACTION_SCALE[i + 1].score) / 2,
}));

/**
 * Which of the four answers a 1 to 10 number sits on, by whichever score it is
 * closest to. Ties go to the lower answer, which is the conservative direction:
 * it never reports a student as having enjoyed something more than they said.
 *
 * The sampling screen only ever writes one of the four scores. This handles
 * anything else because old rows exist and because a stored number is not a
 * promise.
 */
function answerIndex(score) {
  const n = num(score);
  if (n === null) return null;
  let best = 0;
  REACTION_SCALE.forEach((option, i) => {
    if (Math.abs(n - option.score) < Math.abs(n - REACTION_SCALE[best].score)) best = i;
  });
  return best;
}

/**
 * The range on the 1 to 10 scale that the readings are consistent with.
 *
 * One tap is the range of the button that was tapped. Two taps is the average
 * of the two ranges, which is exactly the set of averages those two answers
 * could have produced. A number read off the measurement row rather than off
 * the buttons is already on the 1 to 10 scale, so its range is the point
 * itself and the comparison collapses to plain subtraction.
 */
function outcomeBand(taken, actual) {
  if (taken.length) {
    const bands = taken.map(s => REACTION_BANDS[answerIndex(s.score)]);
    return {
      low: round2(bands.reduce((t, b) => t + b.low, 0) / bands.length),
      high: round2(bands.reduce((t, b) => t + b.high, 0) / bands.length),
      answers: bands.map(b => b.label),
    };
  }
  if (actual === null) return null;
  return { low: actual, high: actual, answers: [] };
}

/**
 * How far the prediction sits outside the range, signed the way every other row
 * signs a gap: the outcome minus the prediction, so negative means they enjoyed
 * it less than they said. Inside the range is zero, because inside the range
 * there is nothing the buttons can tell apart.
 */
function pointsOutside(predicted, band) {
  if (predicted < band.low) return round2(band.low - predicted);
  if (predicted > band.high) return round2(band.high - predicted);
  return 0;
}

/** The label the UI puts above every `falsifier` string. */
export const FALSIFIER_LABEL = 'What would change this';

/**
 * Words that describe a person rather than something they did. None of them can
 * appear in copy this module writes, whatever the numbers say, because "you are
 * decisive" is a horoscope and "you cut four items and did not go back to them"
 * is not.
 */
export const BANNED_TRAIT_WORDS = [
  'admirable', 'analytical', 'aptitude', 'born', 'brilliant', 'calibre',
  'caliber', 'creative', 'decisive', 'detail-oriented', 'detail oriented',
  'diligent', 'driven', 'empathetic', 'exceptional', 'exemplary', 'flair',
  'genius', 'gifted', 'impressive', 'instinct', 'instincts', 'intuitive',
  'knack', 'leader', 'maturity', 'methodical', 'meticulous', 'mindset',
  'natural', 'naturally', 'organised', 'organized', 'outstanding',
  'personality', 'phenomenal', 'pragmatic', 'prodigy', 'remarkable',
  'resilient', 'stellar', 'strategic', 'strength', 'strengths', 'suited',
  'superb', 'talented', 'temperament', 'thinker', 'thoughtful', 'visionary',
  'weakness', 'weaknesses', 'well-suited', 'well suited',
];

/**
 * The rest of rule 4, as patterns, matched on the normalised text.
 *
 * The word "fit" is matched on its own only: a sprint that fits its capacity is
 * arithmetic, and a person who fits a career is the claim this product exists
 * to not make.
 */
const BANNED_PATTERNS = [
  { id: 'the word fit', re: /\bfit\b/i },
  { id: 'fits you', re: /\bfits\s+(you|your|me|my)\b/i },
  { id: 'you are', re: /\byou are\b/i },
  { id: "you're", re: /\byou're\b/i },
  { id: 'a percentage', re: /%/ },
  { id: 'a verdict', re: /\bverdict\b/i },
  // Written as escapes on purpose. The two long dashes this project bans live in
  // the rule in lib/llm.js that bans them, and the built bundle is grepped for a
  // count of exactly 2. A literal here would make it 3 the moment a page imports
  // this file, which is a confusing way to fail an acceptance criterion.
  { id: 'an em dash or en dash', re: new RegExp('[\\u2014\\u2013]') },
];

/**
 * FLATTERY THE WORD LIST CANNOT SEE, WHICH IS THE HOLE A MODEL WALKS THROUGH.
 *
 * "You would be great at this job" carries no banned word, no percentage and no
 * verdict, and it is the purest horoscope in the set. So does "this is the work
 * of a future leader" and "this shows real maturity for someone at your stage".
 * Every one of those was accepted before these patterns existed and would have
 * printed to a student verbatim.
 *
 * The test is the one the rest of the read-out already runs on itself: a
 * statement about the student needs a number or a quote attached to it. These
 * patterns catch the constructions that make a statement about the student with
 * neither, and they are deliberately shaped around the construction rather than
 * around the compliment, because the compliments are infinite and the sentence
 * shapes are not.
 *
 * They must not swallow specific feedback about what the student wrote. "You
 * named a problem rather than a feature" and "your reply gives a date you
 * cannot keep" are the whole point of the two model-scored criteria, and both
 * pass. That is why none of these match a bare verb about what somebody did.
 *
 * Matched on the normalised text with disclaimer clauses taken out first: Block
 * D says "it does not tell you whether you would be good at the job", which is
 * this module promising not to make the claim rather than making it.
 */
const BANNED_CLAIM_PATTERNS = [
  { id: 'what you would be', re: /\byou\s+(?:would|will|could|'d)\s+(?:be|make|become)\b/i },
  { id: 'how far you would go', re: /\byou\s+(?:would|will|could|'d)\s+(?:excel|thrive|flourish|go\s+far|do\s+well|do\s+great)\b/i },
  { id: 'the kind of person', re: /\bthe\s+(?:kind|sort|type)\s+of\s+(?:person|student|people|someone|one)\b/i },
  { id: 'the work of somebody', re: /\bthe\s+work\s+of\s+(?:a|an|someone|somebody)\b/i },
  { id: 'what this shows about you', re: /\b(?:shows|showed|demonstrates|demonstrated|reveals|revealed|reflects|speaks\s+to)\s+(?:real|genuine|true|serious|clear|strong|a\s+lot\s+of|how\s+much)\b/i },
  { id: 'good for somebody at your stage', re: /\bfor\s+(?:someone|somebody|a\s+student|anyone)\s+(?:at|of|in|with)\s+(?:your|this)\b/i },
  { id: 'what you have in you', re: /\byou\s+have\s+(?:real|genuine|natural|serious|great|rare|strong|clear)\b/i },
  { id: 'what you have an eye for', re: /\byou\s+have\s+(?:a|an)\s+(?:real|natural|genuine|rare|great|good|strong|clear|keen|sharp)\b/i },
];

/**
 * Clauses that say what is NOT being claimed, which is the opposite of a claim
 * and has to be readable without tripping the guard. Taken out before the claim
 * patterns run, and only before those: a trait word inside a disclaimer is
 * still a trait word on the screen.
 */
const HEDGE_CLAUSE = /\b(?:whether|if)\b[^.,;:!?]*/gi;

/**
 * Curly punctuation, normalised to its straight form before anything is matched.
 *
 * This project keeps curly apostrophes on purpose, so "you're" written properly
 * is what a model actually produces, and a guard that only knew the straight
 * form let the single most common horoscope opener through. The dashes are left
 * alone: they are banned rather than normalised, and the pattern above is what
 * catches them.
 */
const CURLY_APOSTROPHES = /[‘’‛ʼʹ′´`]/g;
const CURLY_QUOTES = /[“”„‟″«»]/g;

/** One spelling and one spacing, so the patterns only have to know one form. */
export function normaliseForMatching(value) {
  return text(value)
    .replace(CURLY_APOSTROPHES, "'")
    .replace(CURLY_QUOTES, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v) => (typeof v === 'string' ? v : '');
const list = (v) => (Array.isArray(v) ? v : []);
const round1 = (v) => Math.round(v * 10) / 10;
/** Band edges land on quarters once two ranges are averaged, so they get two places. */
const round2 = (v) => Math.round(v * 100) / 100;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Small numbers as words, so a sentence does not open on a numeral. */
const WORD_NUMBERS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const countWord = (n) => (num(n) !== null && WORD_NUMBERS[n] ? WORD_NUMBERS[n] : String(n));

/** Where the two during-task readings land, in the words of the step they follow. */
const SAMPLE_MOMENTS = {
  2: 'After you cut the list',
  4: 'After Priya changed the estimate',
};

const momentFor = (step) => SAMPLE_MOMENTS[step] || (num(step) !== null ? `At step ${step}` : 'During the task');

/** A 1 to 10 answer as the word the student tapped. Mirrors AGAIN_OPTIONS, 2 / 5 / 9. */
function wantWord(score) {
  const n = num(score);
  if (n === null) return null;
  if (n >= 7) return 'yes';
  if (n <= 3) return 'no';
  return 'not sure';
}

/** A timestamp as a plain date. Fixed locale and zone, so it reads the same everywhere. */
function dayText(value) {
  const d = entityDate(value);
  if (!d) return null;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** Whole minutes between two timestamps, or null if either one is missing. */
function minutesBetween(from, to) {
  const a = entityDate(from);
  const b = entityDate(to);
  if (!a || !b) return null;
  const mins = Math.round((b.getTime() - a.getTime()) / 60000);
  return Number.isFinite(mins) && mins >= 0 ? mins : null;
}

const gapWord = (gap, low, high) => (gap < 0 ? low : high);

// ---------------------------------------------------------------------------
// Block A. What you expected, and what happened.
// ---------------------------------------------------------------------------

/**
 * The shared skeleton of a prediction row, so that no row can be built without a
 * status, a falsifier and somewhere to put its numbers.
 */
function row(id, label, falsifier, extra) {
  return {
    id,
    label,
    status: 'no_prediction',
    predicted: null,
    predicted_text: null,
    actual: null,
    actual_text: null,
    gap: null,
    gap_size: null,
    // What `gap` is counted in. Points on the 1 to 10 scale for enjoyment,
    // energy and performance, though enjoyment measures the distance to a
    // range rather than to a number: see REACTION_BANDS. Wanting another is
    // neither, and says so with `scale: null`.
    scale: 'points',
    threshold_applies: true,
    clears_threshold: null,
    lines: [],
    falsifier,
    facts: {},
    ...extra,
  };
}

/** Rule 2, in one place. */
function grade(predicted, actual) {
  const gap = round1(actual - predicted);
  const size = Math.abs(gap);
  return {
    gap,
    gap_size: size,
    clears_threshold: size >= PREDICTION_GAP_THRESHOLD,
    status: size >= PREDICTION_GAP_THRESHOLD ? 'gap' : 'no_gap',
  };
}

const ENJOYMENT_FALSIFIER =
  'One run of one task on one day. Do a second simulation of work that is nothing like this. If it moves the same way there, what moved is the format and not product work.';

function enjoymentRow(run, measurement) {
  const r = row('enjoyment', 'Enjoyment', ENJOYMENT_FALSIFIER);
  const predicted = num(measurement?.expected_enjoyment);

  const samples = list(run?.experience_samples);
  const taken = samples
    .filter(s => s?.skipped !== true && num(s?.score) !== null)
    .map(s => ({
      at_step: num(s?.at_step),
      score: num(s.score),
      moment: momentFor(num(s?.at_step)),
      minutes_in: minutesBetween(run?.started_at, s?.sampled_at),
    }))
    .sort((a, b) => (a.at_step ?? 0) - (b.at_step ?? 0));
  const skippedCount = samples.filter(s => s?.skipped === true).length;

  let actual = null;
  let readingFrom = null;
  if (taken.length) {
    actual = round1(taken.reduce((sum, s) => sum + s.score, 0) / taken.length);
    readingFrom = 'samples';
  } else if (num(measurement?.actual_enjoyment) !== null) {
    actual = num(measurement.actual_enjoyment);
    readingFrom = 'measurement';
  }

  const drop = taken.length === 2 ? round1(taken[0].score - taken[1].score) : null;
  r.facts = {
    samples: taken,
    samples_taken: taken.length,
    samples_skipped: skippedCount,
    average: actual,
    drop_between_samples: drop,
    reading_from: readingFrom,
  };
  r.predicted = predicted;
  r.actual = actual;

  if (actual === null) {
    r.status = 'no_outcome';
    r.lines = skippedCount
      ? ['You skipped both check-ins during the task, so there is no enjoyment reading to put against your prediction. We are not going to guess at one.']
      : ['No enjoyment reading was recorded during the task, so there is nothing to put against your prediction. We are not going to guess at one.'];
    if (predicted !== null) r.lines.unshift(`You predicted ${predicted}.`);
    return r;
  }

  const readings = taken.length
    ? taken.map(s => `${s.moment} you said ${s.score}.`)
    : [`You rated it ${actual}.`];

  if (predicted === null) {
    r.status = 'no_prediction';
    r.lines = [
      ...readings,
      'You started without answering the four questions, so there is nothing to put this against.',
    ];
    return r;
  }

  // The prediction against the range the taps stand for, never against their
  // midpoint. The long comment on REACTION_BANDS is the reasoning, and it also
  // says what a "you called this one" here can still be hiding.
  const band = outcomeBand(taken, actual);
  const gap = pointsOutside(predicted, band);
  const size = Math.abs(gap);

  r.gap = gap;
  r.gap_size = size;
  r.clears_threshold = size >= PREDICTION_GAP_THRESHOLD;
  r.status = r.clears_threshold ? 'gap' : 'no_gap';
  r.facts.band = band;
  r.facts.points_outside_band = gap;

  r.lines = [`You predicted ${predicted}.`, ...readings];

  if (taken.length === 1) {
    r.lines.push('You skipped one of the two check-ins, so this is one reading and not an average.');
  }
  if (taken.length > 1) r.lines.push(`Across the two you averaged ${actual}.`);

  const answers = [...new Set(band.answers)];
  const range = `between ${band.low} and ${band.high} on the 1 to 10 scale you used`;
  if (answers.length === 1) {
    r.lines.push(`"${answers[0]}" means somewhere ${range}.`);
  } else if (answers.length > 1) {
    r.lines.push(`${band.answers.map(a => `"${a}"`).join(' and then ')} average out somewhere ${range}.`);
  }

  const where = gap > 0 ? 'below the bottom' : 'above the top';
  const points = `${size} ${size === 1 ? 'point' : 'points'}`;
  if (!band.answers.length) {
    // No taps, so the reading came off the measurement row as a plain number
    // and there is no range to talk about.
    if (r.status === 'gap') {
      r.lines.push(`That is ${points} ${gapWord(gap, 'lower', 'higher')} than you expected.`);
    }
  } else if (size === 0) {
    r.lines.push(`Your ${predicted} is inside that.`);
  } else if (r.status === 'gap') {
    r.lines.push(`Your ${predicted} is ${points} ${where} of that.`);
  } else {
    r.lines.push(
      `Your ${predicted} is ${points} ${where} of that, which is under the ${PREDICTION_GAP_THRESHOLD} points this read-out counts as a gap.`
    );
  }

  // The move between the two readings is its own fact. It is the number nobody
  // else collects, so it prints whether or not the prediction gap cleared.
  if (drop !== null && Math.abs(drop) >= 1) {
    r.lines.push(
      drop > 0
        ? `The reading fell ${drop} between the two check-ins. The revision sat between them.`
        : `The reading rose ${Math.abs(drop)} between the two check-ins. The revision sat between them.`
    );
  }

  if (r.status === 'no_gap') r.lines.push('You called this one.');
  return r;
}

const ENERGY_FALSIFIER =
  'The time of day and what you did before you sat down. One reading is not a pattern.';

function energyRow(run, measurement) {
  const r = row('energy', 'Energy', ENERGY_FALSIFIER);
  const predicted = num(measurement?.expected_energy);
  const actual = num(measurement?.actual_energy);
  r.predicted = predicted;
  r.actual = actual;
  r.facts = { predicted, actual };

  if (actual === null) {
    r.status = 'no_outcome';
    r.lines = predicted === null
      ? ['You did not answer the question about energy at the end, so there is nothing to report here.']
      : [`You predicted ${predicted}.`, 'You did not answer the question about energy at the end, so there is nothing to put it against.'];
    return r;
  }

  if (predicted === null) {
    r.status = 'no_prediction';
    r.lines = [
      `You finished at ${actual}.`,
      'You started without answering the four questions, so there is nothing to put this against.',
    ];
    return r;
  }

  Object.assign(r, grade(predicted, actual));
  r.lines = [`You predicted ${predicted}.`, `You finished at ${actual}.`];
  r.lines.push(
    r.status === 'no_gap'
      ? 'You called this one.'
      : `That is ${r.gap_size} ${r.gap_size === 1 ? 'point' : 'points'} ${gapWord(r.gap, 'lower', 'higher')} than you expected.`
  );
  return r;
}

const PERFORMANCE_FALSIFIER =
  'The checks read what you wrote, not what you meant. Your own text is above, so you can judge whether a check got it wrong.';

function performanceRow(measurement, scoring) {
  const r = row('performance', 'How well you would do', PERFORMANCE_FALSIFIER);
  const predicted = num(measurement?.expected_performance);
  const { passedCount, scoredCount, totalCount, missingCount, actual, derived } = scoring;

  r.predicted = predicted;
  r.actual = actual;
  r.facts = {
    predicted,
    passed: passedCount,
    scored: scoredCount,
    total: totalCount,
    not_scored: missingCount,
    actual,
    actual_is_derived: derived,
  };

  let passedLine;
  if (!missingCount) {
    passedLine = `${cap(countWord(passedCount))} of the ${countWord(totalCount)} checks passed.`;
  } else if (passedCount === scoredCount && scoredCount > 0) {
    passedLine = `All ${countWord(scoredCount)} of the checks we could run passed.`;
  } else {
    passedLine = `Of the ${countWord(scoredCount)} checks we could run, ${countWord(passedCount)} passed.`;
  }

  // Rule 5. Two of the five need a model. When they are missing this row keeps
  // its place, says which ones are missing, and carries no number.
  if (missingCount) {
    r.status = 'not_comparable';
    r.lines = predicted === null
      ? [passedLine, `The other ${countWord(missingCount)} need a review we could not run just now, so there is no number here.`]
      : [
          `You predicted ${predicted} out of 10.`,
          passedLine,
          `The other ${countWord(missingCount)} need a review we could not run just now, so there is no number to put next to your prediction.`,
        ];
    return r;
  }

  if (predicted === null) {
    r.status = 'no_prediction';
    r.lines = [passedLine, 'You started without answering the four questions, so there is nothing to put this against.'];
    return r;
  }

  if (actual === null) {
    r.status = 'not_comparable';
    r.lines = [`You predicted ${predicted} out of 10.`, passedLine, 'There is no number on the same scale to put next to your prediction.'];
    return r;
  }

  Object.assign(r, grade(predicted, actual));
  r.lines = [
    `You predicted ${predicted} out of 10.`,
    `${passedLine.replace(/\.$/, '')}, which is ${actual} on the same scale.`,
  ];
  r.lines.push(
    r.status === 'no_gap'
      ? 'You called this one.'
      : `That is ${r.gap_size} ${r.gap_size === 1 ? 'point' : 'points'} ${gapWord(r.gap, 'below', 'above')} what you predicted.`
  );
  return r;
}

const WANT_MORE_FALSIFIER =
  'Starting another one. This counts whether a second run exists, so it changes the moment you begin one.';

/**
 * How long "you have not started another one" has to hold before it counts as
 * an answer rather than as the clock not having run yet.
 *
 * This row is the only behavioural one in Block A, and it is the one the
 * research calls the hardest to game. That is exactly why it must not be
 * scored at the end of the run. At that moment starting another one was not
 * possible, so "you have not started another one" is not something the student
 * did. Printing it as an outcome is manufactured surprise for everybody who
 * said yes and unearned agreement for everybody who said no, on a row where
 * both readings are a foregone conclusion.
 *
 * So until a second run exists or this window has passed, the row says the
 * answer is not in yet and scores nothing. The read-out is reachable again
 * from its own address, which is what makes the later reading possible: see
 * WorkSimulationPage and the `now` option below.
 *
 * Seven days matches the follow up window the plan and the research already
 * use for whether a student did anything afterwards.
 */
export const WANT_MORE_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function wantMoreRow(run, measurement, now) {
  const r = row('want_more', 'Wanting another', WANT_MORE_FALSIFIER, {
    threshold_applies: false,
    scale: null,
  });
  const predicted = num(measurement?.expected_want_more);
  const predictedWord = wantWord(predicted);
  const statedWord = wantWord(measurement?.desire_to_repeat);
  const startedAnother = !!entityDate(run?.started_another_at);
  const startedOn = dayText(run?.started_another_at);

  // The clock is the caller's, never this module's. Absent means unknown, and
  // unknown is treated as "too early to say" rather than as "they did not".
  const viewedAt = entityDate(now);
  const finishedAt = entityDate(run?.completed_at);
  const waited = viewedAt && finishedAt
    ? viewedAt.getTime() - finishedAt.getTime() >= WANT_MORE_WINDOW_DAYS * DAY_MS
    : false;
  const outcomeKnown = startedAnother || waited;

  r.predicted = predicted;
  r.predicted_text = predictedWord;
  r.actual_text = outcomeKnown
    ? (startedAnother ? 'started another one' : 'has not started another one')
    : null;
  r.facts = {
    predicted,
    predicted_word: predictedWord,
    stated_afterwards: num(measurement?.desire_to_repeat),
    stated_afterwards_word: statedWord,
    started_another: startedAnother,
    started_another_at: text(run?.started_another_at) || null,
    outcome_known: outcomeKnown,
    window_days: WANT_MORE_WINDOW_DAYS,
  };

  const statedLine = statedWord ? [`Afterwards you said ${statedWord}.`] : [];

  if (predictedWord === null) {
    r.status = 'no_prediction';
    const outcomeLine = outcomeKnown
      ? [startedAnother ? `You started another one on ${startedOn}.` : 'You have not started another one since.']
      : [];
    r.lines = [
      ...statedLine,
      ...outcomeLine,
      'You started without answering the four questions, so there is nothing to put this against.',
    ];
    return r;
  }

  // Nothing has happened yet, and saying so is the whole point of the row.
  if (!outcomeKnown) {
    r.status = 'no_outcome';
    r.lines = [
      `You predicted ${predictedWord}.`,
      ...statedLine,
      'This row counts whether you start another one, and you have only just finished this one. There is nothing to count yet.',
      'Open this read-out again in a week and it will say what you did.',
    ];
    return r;
  }

  const meantYes = predictedWord === 'yes';
  const agrees = meantYes === startedAnother;
  r.status = agrees ? 'no_gap' : 'gap';
  r.clears_threshold = null;

  r.lines = [`You predicted ${predictedWord}.`, ...statedLine];

  if (startedAnother) {
    r.lines.push(`You started another one on ${startedOn}.`);
    r.lines.push(
      agrees
        ? 'You called this one.'
        : 'You did it anyway. What you did is the half we count.'
    );
    return r;
  }

  r.lines.push('You have not started another one since.');
  if (!agrees) {
    r.lines.push('That is not a criticism. It is why this counts what you did rather than what you said.');
  } else {
    r.lines.push('You called this one.');
  }
  return r;
}

// ---------------------------------------------------------------------------
// Block B. The three we counted, and an honest account of the two we could not.
// ---------------------------------------------------------------------------

const CHECK_FALSIFIERS = {
  plan_fits_capacity:
    'This counts the points on the list, and the points came from Priya. A different estimate gives a different answer.',
  non_goals_present:
    'This looks for the heading and for text under it. If you wrote what you were leaving out somewhere else in the spec, it did not see it.',
  revision_changed_plan:
    'This compares words, not meaning. The same plan in different words can pass it, and a small edit that changes everything can fail it.',
};

/**
 * Line the rubric up against whatever `check_results` holds. The rubric is the
 * authority on how many criteria there are, so a missing result is a named hole
 * rather than a shorter list.
 */
function scoreChecks(run, sim) {
  const rubric = list(sim?.rubric);
  const results = list(run?.check_results);
  const byId = new Map();
  results.forEach(res => {
    const key = text(res?.criterion);
    if (key && !byId.has(key)) byId.set(key, res);
  });

  const rows = [];
  const missing = [];
  rubric.forEach(entry => {
    const res = byId.get(entry.id);
    const scored = typeof res?.passed === 'boolean';
    if (!scored) {
      missing.push({ id: entry.id, criterion: entry.criterion });
      return;
    }

    // A sentence a model wrote is held to rule 4 like anything else. The
    // validator in work-sim-review.js rejects it before it is ever stored, and
    // this is the same check at the other end, for a row written before that
    // guard existed or by anything that bypassed it. A row that fails is
    // dropped whole into the not-scored list, which is the honest hole the
    // degraded copy already describes, rather than being edited into something
    // the model did not say.
    //
    // Only model text. A check's detail quotes the student's own writing back
    // at them verbatim, and a student may write whatever they like.
    const fromModel = text(res.scored_by) === 'model';
    if (fromModel && bannedLanguageIn(res.detail).length) {
      missing.push({ id: entry.id, criterion: entry.criterion });
      return;
    }

    rows.push({
      id: entry.id,
      criterion: entry.criterion,
      passed: res.passed,
      scored_by: text(res.scored_by) || entry.scored_by || 'checks',
      evidence: text(res.detail)
        ? { source: fromModel ? 'model' : 'checks', text: text(res.detail) }
        : null,
      falsifier: CHECK_FALSIFIERS[entry.id] || null,
    });
  });

  const computed = rows.filter(x => x.scored_by !== 'model');
  const modelRows = rows.filter(x => x.scored_by === 'model');
  const passedCount = rows.filter(x => x.passed).length;
  const totalCount = rubric.length;
  const scoredCount = rows.length;
  const missingCount = missing.length;

  return {
    rows: computed,
    modelRows,
    missing,
    passedCount,
    scoredCount,
    totalCount,
    missingCount,
  };
}

/**
 * The performance number, and where it came from.
 *
 * The stored `system_performance_score` wins when it exists. Otherwise, and only
 * when all five criteria have a result, the score is the pass count on the same
 * 10 point scale the prediction used. With anything unscored there is no number,
 * which is rule 5.
 */
function performanceScore(measurement, checks) {
  const stored = num(measurement?.system_performance_score);
  if (stored !== null) return { actual: stored, derived: false };
  if (checks.missingCount === 0 && checks.totalCount > 0) {
    return { actual: round1((checks.passedCount / checks.totalCount) * 10), derived: true };
  }
  return { actual: null, derived: false };
}

function checksBlock(checks) {
  const degraded = checks.missingCount > 0;
  return {
    id: 'B',
    heading: 'What we counted, without judging you',
    degraded,
    note: degraded
      ? `${cap(countWord(checks.missingCount))} of the ${countWord(checks.totalCount)} checks need a review we could not run just now. The ones below are counted from what you wrote and are not affected by it.`
      : 'These are counted from what you wrote. A model did not score them.',
    scored_count: checks.scoredCount,
    total_count: checks.totalCount,
    passed_count: checks.passedCount,
    falsifier_label: FALSIFIER_LABEL,
    rows: checks.rows,
    model_notes_label: "A reader's note, not a score",
    model_notes: checks.modelRows,
    not_scored_label: 'Not scored',
    not_scored: checks.missing,
  };
}

// ---------------------------------------------------------------------------
// Block C. The practitioner comparison, which does not exist yet.
// ---------------------------------------------------------------------------

/**
 * Nobody has been assigned to write the reference spec (product call 5 in the
 * plan), so the block is built to take one and says plainly that it is missing.
 * It is never filled with ours and it is never dropped: a read-out that quietly
 * loses this block is a read-out nobody notices is weaker than the thesis needs.
 */
function comparisonBlock(run, sim, reference) {
  const spec = text(run?.spec_v2).trim() || text(run?.spec_v1).trim();
  const studentSpec = spec
    ? { source: 'student', label: 'What you wrote', text: spec }
    : null;

  const ref = reference || sim?.reference_spec || null;
  const available = !!text(ref?.text).trim();

  const items = list(sim?.backlog?.items).length;
  const capacity = num(sim?.backlog?.capacity);

  return {
    id: 'C',
    heading: 'Your spec, next to one somebody else wrote',
    available,
    intro: available
      ? `This is not a right answer. It is what one person did with the same ${countWord(items)} items and the same ${countWord(capacity)} points. Read them next to each other and see what you left out.`
      : null,
    student_spec: studentSpec,
    reference: available
      ? {
          label: 'What they wrote',
          author: text(ref.author) || null,
          role: text(ref.role) || null,
          text: text(ref.text),
          source: 'practitioner',
        }
      : null,
    missing: available
      ? null
      : {
          reason: 'not_written',
          body: 'The other spec is not here yet. It has to come from somebody who does this work for a living, and nobody has written it, so this part is empty rather than filled in with ours.',
        },
  };
}

// ---------------------------------------------------------------------------
// Block D. Fixed text. Always present, never conditional.
// ---------------------------------------------------------------------------

export const LIMITS_BLOCK = Object.freeze({
  id: 'D',
  heading: 'What this does not tell you',
  body: 'This was 30 minutes of one kind of product work at one made up company. It tells you how you reacted to that. It does not tell you whether you would be good at the job, whether you would like the job, or whether you should do the job. The fastest way to find out whether this was the task or you is to do another one that is nothing like it.',
});

// ---------------------------------------------------------------------------
// Rule enforcement.
// ---------------------------------------------------------------------------

/**
 * Rule 4 against one string, whoever wrote it.
 *
 * Exported because the model's two `detail` sentences have to pass the same
 * check before they are stored, and a second list of banned words in
 * work-sim-review.js would be a second list to keep in step. Returns every hit,
 * so a rejection can say which words to avoid.
 */
export function bannedLanguageIn(value) {
  const raw = text(value);
  const found = [];
  if (!raw) return found;
  const s = normaliseForMatching(raw);
  const claims = s.replace(HEDGE_CLAUSE, ' ');
  BANNED_TRAIT_WORDS.forEach(word => {
    const re = new RegExp(`\\b${word.replace(/[-\s]/g, '[-\\s]')}\\b`, 'i');
    if (re.test(s)) found.push({ term: word, string: raw });
  });
  BANNED_PATTERNS.forEach(p => {
    if (p.re.test(s)) found.push({ term: p.id, string: raw });
  });
  BANNED_CLAIM_PATTERNS.forEach(p => {
    if (p.re.test(claims)) found.push({ term: p.id, string: raw });
  });
  return found;
}

/** Keys whose strings came from somebody other than us, so they are quoted, not written. */
const QUOTED_KEYS = new Set(['text', 'quote', 'author', 'role']);

/** Every string this module authored, with the quoted ones left out. */
export function copyStrings(node, out = [], quoted = false) {
  if (typeof node === 'string') {
    if (!quoted) out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach(n => copyStrings(n, out, quoted));
    return out;
  }
  if (node && typeof node === 'object') {
    const fromElsewhere = typeof node.source === 'string';
    Object.entries(node).forEach(([k, v]) => {
      copyStrings(v, out, quoted || (fromElsewhere && QUOTED_KEYS.has(k)));
    });
  }
  return out;
}

/**
 * Rule 4, checkable. Returns every violation it finds, so a test can print them
 * rather than just failing.
 */
export function findBannedLanguage(readout) {
  const found = [];
  copyStrings(readout).forEach(s => found.push(...bannedLanguageIn(s)));
  return found;
}

/** Statuses where the row is making a claim about the student rather than reporting a hole. */
const CLAIM_STATUSES = new Set(['gap', 'no_gap']);

/**
 * Rules 1, 3 and 4 at the door. This throws rather than warns: every string it
 * checks is written in this file, so a failure here is an edit somebody made and
 * not anything a student typed.
 */
export function assertRules(readout) {
  const problems = [];

  readout.blocks.predictions.rows.forEach(r => {
    if (!r.falsifier) problems.push(`${r.id}: no falsifier`);
    if (!Object.keys(r.facts || {}).length) problems.push(`${r.id}: no facts under the copy`);
    if (CLAIM_STATUSES.has(r.status)) {
      const hasNumber = r.predicted !== null || r.actual !== null;
      const hasWord = !!(r.predicted_text || r.actual_text);
      if (!hasNumber && !hasWord) problems.push(`${r.id}: a claim with no number and no quote`);
      if (!r.lines.length) problems.push(`${r.id}: a claim with no copy`);
    }
  });

  readout.blocks.checks.rows.forEach(c => {
    if (!c.evidence || !text(c.evidence.text).trim()) problems.push(`${c.id}: a check with no fact under it`);
  });

  findBannedLanguage(readout).forEach(hit => {
    problems.push(`banned language "${hit.term}" in: ${hit.string}`);
  });

  if (problems.length) {
    throw new Error(`work-sim read-out broke its own rules: ${problems.join('; ')}`);
  }
  return readout;
}

// ---------------------------------------------------------------------------

/**
 * Build the read-out.
 *
 * @param {object} run WorkSimulationRun row. A missing one degrades, it does not throw.
 * @param {object} measurement ExperimentMeasurement row, pre half, post half, or neither.
 * @param {object} [options]
 * @param {object} [options.sim] The simulation content. Defaults to the Northgate sprint.
 * @param {object} [options.reference] The practitioner reference spec, when one exists.
 * @param {string|Date|number} [options.now] When this read-out is being looked
 *   at. Supplied by the caller, never read from a clock in here, so this stays
 *   pure. Only the want-more row uses it, to tell "they have not started
 *   another one" apart from "they finished ten seconds ago". Leave it out and
 *   that row says the answer is not in yet.
 */
export function buildWorkSimReadout(run, measurement, options = {}) {
  const sim = options.sim || NORTHGATE_PM;
  const checks = scoreChecks(run, sim);
  const score = performanceScore(measurement, checks);

  const status = ['completed', 'abandoned', 'in_progress'].includes(run?.status)
    ? run.status
    : 'in_progress';
  const complete = status === 'completed';
  const stoppedAt = num(run?.abandoned_at_step) ?? num(run?.current_step);

  let note = null;
  if (status === 'abandoned') {
    note = stoppedAt
      ? `You stopped at step ${stoppedAt} of ${countWord(list(sim?.steps).length || 5)}, so most of this is empty. What you did answer is below.`
      : 'You stopped before the end, so most of this is empty. What you did answer is below.';
  } else if (status === 'in_progress') {
    note = 'This run is not finished, so the read-out only holds what has been answered so far.';
  }

  const readout = {
    version: 1,
    simulation: {
      key: text(run?.simulation_key) || text(sim?.key) || null,
      version: num(run?.simulation_version) ?? num(sim?.version) ?? null,
      title: text(sim?.title) || null,
      career_name: text(sim?.career_name) || text(run?.career_name) || null,
    },
    status,
    complete,
    note,
    falsifier_label: FALSIFIER_LABEL,
    blocks: {
      predictions: {
        id: 'A',
        heading: 'What you expected, and what happened',
        threshold: PREDICTION_GAP_THRESHOLD,
        answer_bands: REACTION_BANDS,
        falsifier_label: FALSIFIER_LABEL,
        rows: [
          enjoymentRow(run, measurement),
          energyRow(run, measurement),
          performanceRow(measurement, { ...checks, ...score }),
          wantMoreRow(run, measurement, options.now),
        ],
      },
      checks: checksBlock(checks),
      comparison: comparisonBlock(run, sim, options.reference),
      limits: { ...LIMITS_BLOCK },
    },
  };

  return assertRules(readout);
}

export default buildWorkSimReadout;
