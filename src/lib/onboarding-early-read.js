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
/** What is left after an ending comes off has to still be a word, not a stub. */
const MIN_STEM = 4;

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = (v) => clean(v).toLowerCase().replace(/[.,;:!?]+$/, '');
const listOf = (v) => (Array.isArray(v) ? v.map(clean).filter(Boolean) : []);

/** The words in what a student typed, punctuation and spacing thrown away. */
const words = (v) => norm(v).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Endings that turn one career word into another name for the same career:
 * nurse and nursing, teacher and teaching, accountant and accounting. Longest
 * first, so "engineering" loses "ing" rather than "g".
 *
 * One ending comes off and no letter is ever rewritten, which is well short of
 * a real stemmer and is meant to be. MIN_STEM is what keeps it off short words,
 * so "acting" does not become "act" and take Accounting with it.
 */
const ENDINGS = ['ings', 'ing', 'ists', 'ist', 'ants', 'ant', 'ents', 'ent', 'ers', 'er', 'ors', 'or', 'es', 's', 'y', 'e'];

const stem = (word) => {
  for (const end of ENDINGS) {
    if (word.endsWith(end) && word.length - end.length >= MIN_STEM) return word.slice(0, -end.length);
  }
  return word;
};

/** Is the shorter of these two the front of the longer one? */
const prefixOf = (a, b) => {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= MIN_OVERLAP && long.startsWith(short);
};

/**
 * Do two words name the same thing?
 *
 * An exact word counts however short it is, because "HR" is a career and not an
 * accident. A prefix has to reach MIN_OVERLAP first, or a two-letter fragment
 * matches half of everything. Off the front is not enough on its own though:
 * "nursing" does not start with "nurse", so the endings come off both and the
 * stumps get the same treatment.
 */
const sameWord = (a, b) => a === b || prefixOf(a, b) || prefixOf(stem(a), stem(b));

/**
 * Has the student already ruled this out?
 *
 * Generous in one direction on purpose, because the two failures are not equal.
 * Dropping a direction we could have shown costs one line on one screen.
 * Showing a student the thing they just told us they do not want reads as not
 * having listened, on the screen whose whole job is proving we did. The
 * question that collects this says "we will not suggest it back to you" in
 * writing.
 *
 * The generosity is in how much of an answer has to match, not how little.
 * Every word of the shorter answer has to land somewhere in the longer one, so
 * "HR" takes HR generalist with it and "Nursing" takes Nursing school, while
 * Law school and Business school are two different answers that happen to share
 * a word. Any-one-word matching is what made a student who ruled out Law school
 * lose Business school, Med school and Grad school as well, and two answers
 * ending up as no directions at all is not a rough edge on this screen. It is
 * the screen with nothing on it.
 */
export function isRuledOut(name, ruledOut) {
  const mine = words(name);
  if (!mine.length) return false;
  return listOf(ruledOut).some((entry) => {
    const theirs = words(entry);
    // An entry with no words in it, "???" or ".*", would otherwise match
    // everything, since every word of nothing lands anywhere.
    if (!theirs.length) return false;
    const [fewer, more] = mine.length <= theirs.length ? [mine, theirs] : [theirs, mine];
    return fewer.every((word) => more.some((other) => sameWord(word, other)));
  });
}

const SOURCE_LABELS = {
  curious: 'The one you said you are curious about',
  considered: 'On your list',
};

/**
 * Every direction the answers support, in source order. Curious first because
 * it is the one the student said they had not told anyone, not because it is
 * better. Nothing here is cut, so the screen can say how many it left out.
 */
function allDirections(data = {}) {
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

  return out;
}

/** What the screen shows: source order, capped. */
export function directionsFrom(data = {}) {
  return allDirections(data).slice(0, MAX_DIRECTIONS);
}

function clarityLine(clarity, confidence) {
  const lines = [];
  if (clarity) {
    const tail =
      clarity < CLARITY_LOW ? 'so almost all of this is still open'
        : clarity >= CLARITY_SURE ? 'so the open question is whether that holds up, not what to pick'
          : 'so some of this is settled and a lot of it is not';
    // The question asked how certain they are. "Clarity" is the field name, and
    // handing someone back a word they never saw reads as a form talking to
    // itself.
    lines.push(`You put ${clarity} out of 10 on how certain you are, ${tail}.`);
  }
  if (clarity && confidence) {
    if (clarity - confidence >= NUMBER_GAP) {
      lines.push('You are clearer on the direction than you are sure of it.');
    } else if (confidence - clarity >= NUMBER_GAP && clarity < CLARITY_LOW) {
      // Only worth saying while the first number is genuinely low. At a 4 the
      // line above already said some of it is settled, and "you are sure you do
      // not know" one line later contradicts it.
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
  const deciding = listOf(data.current_decision_pressure);
  const decidingNote = clean(data.current_decision_pressure_note);

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
  // The note is a sentence the student wrote, not another item. Comma-joined
  // onto the fixed choices, one that opens with a conjunction reads as a broken
  // list: "Summer internship, and a transfer". Their words are not edited, so
  // the note gets its own line instead.
  if (deciding.length) {
    lines.push(`In front of you this term: ${deciding.join(', ')}.`);
    if (decidingNote) lines.push(`Also on your mind: ${decidingNote}.`);
  } else if (decidingNote) {
    lines.push(`In front of you this term: ${decidingNote}.`);
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
  // A pressured path the student has also ruled out is settled, by them, one
  // screen ago. Asking whose it is re-opens the thing the last screen promised
  // to leave shut, so it falls through to the next honest unknown.
  if (pressured && !isRuledOut(pressured, listOf(data.careers_ruled_out))) {
    return `Whether ${pressured} is yours or someone else's. Nothing you have typed can settle that, and neither can we.`;
  }
  if (directions.length > 1) {
    // One sentence, because the second one used to claim the careers read about
    // the same from the outside, which is the only thing this screen ever said
    // about the careers rather than about the student. For Writing and
    // Investment banking it was simply untrue.
    return 'Which of these you would actually like doing on a Tuesday.';
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
    return { sparse: true, reflection, directions: [], directionsTotal: 0, directionsNote: '', unknown: '' };
  }

  const all = allDirections(data);
  const directions = all.slice(0, MAX_DIRECTIONS);

  return {
    sparse: false,
    reflection,
    directions,
    directionsTotal: all.length,
    directionsNote: directions.length ? '' : emptyNote({ considered, curious, ruledOut, pressured }),
    unknown: unknownFrom(data, directions),
  };
}

/**
 * Why the list is empty, said truthfully.
 *
 * The screen prints the ruled-out list and the pressured path two lines above
 * this note, so it cannot answer "you have not named a career yet" for a
 * student who named two. Which careers are on the screen is what decides the
 * wording, not which question they arrived through.
 */
function emptyNote({ considered, curious, ruledOut, pressured }) {
  const named = [curious, ...considered].filter(Boolean);
  if (named.length) {
    // A sentence about what the student did needs the student's own words for
    // it: the same career typed into both questions. isRuledOut is loose by
    // design, so letting it decide this line is how the screen ends up telling
    // someone a career is on a list they never put it on.
    const theirOwnWords = named.every((name) => ruledOut.some((entry) => norm(entry) === norm(name)));
    return theirOwnWords
      ? 'Everything you named is also on your ruled-out list, so there is nothing left to show you.'
      : 'We took everything you named as already ruled out, so there is nothing left to show you.';
  }
  if (ruledOut.length && pressured) {
    return 'The only careers you have named are the ones you ruled out and the one being pushed at you, so there is nothing left to put here.';
  }
  if (ruledOut.length) {
    return 'So far you have named what you do not want rather than what you are considering, so there is nothing here to show you.';
  }
  if (pressured) {
    return 'The only career here is the one being pushed at you, and that is not the same as one you want.';
  }
  return 'You have not named a career yet, so there is nothing to show you here.';
}

/**
 * What the funnel is allowed to know about this screen: counts and booleans.
 * No career, no note, no certainty number, nothing a student typed. Same rule
 * as every other event in src/lib/funnel.js.
 *
 * Read defensively on purpose. This is built as an argument to the tracking
 * call, which means it sits outside that call's try/catch, so "measurement
 * never breaks the student's path" only holds if this cannot throw.
 */
export function earlyReadEventProps(read) {
  return {
    sparse: !!read?.sparse,
    directions_count: read?.directions?.length ?? 0,
    reflection_count: read?.reflection?.length ?? 0,
  };
}
