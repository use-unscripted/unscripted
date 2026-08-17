/**
 * The early read: what we can honestly say back to a student five questions
 * into the intake, before they answer another eleven and wait on a model.
 *
 * Two rules govern everything in this file, and both of them are the point:
 *
 *   1. NOTHING IS INVENTED. Every career named on the screen is a string the
 *      student typed on the last few screens, returned verbatim. There is no
 *      lookup table, no inference, no model call, and no career that came from
 *      anywhere but them.
 *
 *   2. NOTHING IS SCORED. No percentage, no match, no fit, no ranking, no
 *      ordering that claims to mean anything. The product is sold on not being
 *      a career quiz, so a number here would be a positioning problem, not a
 *      copy nit. The order below is source order, and the copy says so.
 *
 * What it reads, all of it from the first section of the intake:
 *   baseline_career_clarity, baseline_confidence   question 1 (clarity required)
 *   current_careers_considered                     question 2
 *   careers_ruled_out                              question 3
 *   pressured_path, curious_path                   question 4
 *   current_decision_pressure + note               question 5
 *
 * Degrading honestly is most of the work here. Only the clarity number is
 * required, so the common case is a student who skipped some of it and the
 * worst case is a student who skipped all of it. `sparse` is that worst case,
 * and the screen it drives says there is not enough yet rather than padding.
 */

/** Below this the screen reads as almost everything still being open. */
const CLARITY_LOW = 4;
/** At or above this, the open question is whether the answer holds up. */
const CLARITY_SURE = 8;
/** Two numbers this far apart is the student saying something on its own. */
const NUMBER_GAP = 3;
/** Two or three directions reads; a list of eight is a menu. */
const MAX_DIRECTIONS = 3;
/** Under three characters a fragment matches half of everything by accident. */
const MIN_OVERLAP = 3;

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = (v) => clean(v).toLowerCase().replace(/[.,;:!?]+$/, '');
const listOf = (v) => (Array.isArray(v) ? v.map(clean).filter(Boolean) : []);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Does the shorter string start a word inside the longer one?
 *
 * Plain substring matching is wrong in the direction that matters: "law" sits
 * inside "flawless", so a student who ruled out law school would have lost an
 * unrelated answer. Anchoring to a word boundary keeps "law" against "lawyer"
 * and "law school" while leaving "flawless" alone.
 */
const startsAtWord = (haystack, needle) =>
  new RegExp(`\\b${escapeRe(needle)}`).test(haystack);

/**
 * Has the student already ruled this out?
 *
 * Deliberately generous, because the two failures are not equal. Dropping a
 * direction we could have shown costs one line on one screen. Showing a
 * student the thing they just told us they do not want reads as not having
 * listened, on the screen whose whole job is proving we did.
 */
export function isRuledOut(name, ruledOut) {
  const a = norm(name);
  if (!a) return false;
  return listOf(ruledOut).some((entry) => {
    const b = norm(entry);
    if (!b) return false;
    if (a === b) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.length >= MIN_OVERLAP && startsAtWord(long, short);
  });
}

const SOURCE_LABELS = {
  curious: 'The one you said you are curious about',
  considered: 'On your list',
};

/**
 * The directions, in source order, capped. Curious first because it is the one
 * the student said they had not told anyone, not because it is better.
 */
export function directionsFrom(data = {}) {
  const ruledOut = listOf(data.careers_ruled_out);
  const out = [];
  const seen = new Set();

  const add = (name, source) => {
    const value = clean(name);
    const key = norm(value);
    if (!value || seen.has(key)) return;
    if (isRuledOut(value, ruledOut)) return;
    seen.add(key);
    out.push({ name: value, source, label: SOURCE_LABELS[source] });
  };

  add(data.curious_path, 'curious');
  listOf(data.current_careers_considered).forEach((c) => add(c, 'considered'));

  return out.slice(0, MAX_DIRECTIONS);
}

function clarityLine(clarity, confidence) {
  const lines = [];
  if (clarity) {
    const tail =
      clarity < CLARITY_LOW ? 'so almost all of this is still open'
        : clarity >= CLARITY_SURE ? 'so the open question is whether that holds up, not what to pick'
          : 'so some of this is settled and a lot of it is not';
    lines.push(`You put your clarity at ${clarity} out of 10, ${tail}.`);
  }
  if (clarity && confidence) {
    if (clarity - confidence >= NUMBER_GAP) {
      lines.push('You are clearer on the direction than you are sure of it.');
    } else if (confidence - clarity >= NUMBER_GAP) {
      lines.push('You are confident that you do not know yet.');
    }
  }
  return lines;
}

/** Short factual lines, each one a restatement of an answer they gave. */
export function reflectionFrom(data = {}) {
  const clarity = Number(data.baseline_career_clarity) || null;
  const confidence = Number(data.baseline_confidence) || null;
  const considered = listOf(data.current_careers_considered);
  const ruledOut = listOf(data.careers_ruled_out);
  const pressured = clean(data.pressured_path);
  const deciding = [...listOf(data.current_decision_pressure), clean(data.current_decision_pressure_note)]
    .filter(Boolean);

  const lines = clarityLine(clarity, confidence);

  if (considered.length === 1) {
    lines.push(`One career on your list: ${considered[0]}.`);
  } else if (considered.length > 1) {
    lines.push(`${considered.length} careers on your list: ${considered.join(', ')}.`);
  }
  if (ruledOut.length) {
    lines.push(`Already off the table: ${ruledOut.join(', ')}. We will not put those back in front of you.`);
  }
  if (pressured) {
    lines.push(`Something is being pushed at you: ${pressured}.`);
  }
  if (deciding.length) {
    lines.push(`In front of you this term: ${deciding.join(', ')}.`);
  }
  return lines;
}

/**
 * The one thing we genuinely cannot know about this student yet, picked from
 * what they gave us. Testing is the only thing that settles any of them, which
 * is the argument the rest of the intake is asking them to accept.
 */
function unknownFrom(data, directions) {
  const pressured = clean(data.pressured_path);
  if (pressured) {
    return `Whether ${pressured} is yours or someone else's. Nothing you have typed can settle that, and neither can we.`;
  }
  if (directions.length > 1) {
    return 'Which of these you would actually like doing on a Tuesday. From the outside they read about the same.';
  }
  if (directions.length === 1) {
    return `Whether ${directions[0].name} holds up from the inside. Reading about a job and doing a piece of one are different things.`;
  }
  return 'What kind of work you actually like. Nothing on this screen can answer that.';
}

/**
 * Everything the early read screen renders, or `sparse: true` and almost
 * nothing, which is the honest output for a student who answered the one
 * required question and skipped the other four.
 */
export function earlyRead(data = {}) {
  const considered = listOf(data.current_careers_considered);
  const ruledOut = listOf(data.careers_ruled_out);
  const pressured = clean(data.pressured_path);
  const curious = clean(data.curious_path);
  const deciding = [...listOf(data.current_decision_pressure), clean(data.current_decision_pressure_note)]
    .filter(Boolean);

  const answeredAnything =
    considered.length > 0 || ruledOut.length > 0 || !!pressured || !!curious || deciding.length > 0;

  const reflection = reflectionFrom(data);

  if (!answeredAnything) {
    return { sparse: true, reflection, directions: [], directionsNote: '', unknown: '' };
  }

  const directions = directionsFrom(data);
  let directionsNote = '';
  if (!directions.length) {
    directionsNote = considered.length || curious
      ? 'Everything you named is also on your ruled-out list, so there is nothing left to show you.'
      : 'You have not named a career yet, so there is nothing to show you here.';
  }

  return {
    sparse: false,
    reflection,
    directions,
    directionsNote,
    unknown: unknownFrom(data, directions),
  };
}

/**
 * What the funnel is allowed to know about this screen: counts and booleans.
 * No career, no note, no clarity number, nothing a student typed. Same rule as
 * every other event in src/lib/funnel.js.
 */
export function earlyReadEventProps(read) {
  return {
    sparse: !!read.sparse,
    directions_count: read.directions.length,
    reflection_count: read.reflection.length,
  };
}
