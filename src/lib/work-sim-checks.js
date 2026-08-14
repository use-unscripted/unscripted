/**
 * The three rubric criteria a work simulation can score without a model.
 *
 * Pure functions over a WorkSimulationRun row plus the static simulation
 * content. No network, no clock, no student identity. That is the point: when
 * the integration limit is in force and the two model-scored criteria come back
 * missing, these three still run, and the read-out can say honestly that three
 * of five were counted.
 *
 * Each check returns a row in the shape `WorkSimulationRun.check_results` holds:
 * `{ criterion, passed, detail, scored_by }`. `criterion` carries the rubric id
 * from the content module, not the sentence, because the id is stable and the
 * sentence is copy. The read-out looks the sentence up. `work-sim-review.js`
 * writes rows in the same shape with `scored_by: 'model'`.
 *
 * `detail` is student-facing. It states the numbers or quotes the student's own
 * words, and it never describes the student.
 */
import { NORTHGATE_PM } from '@/lib/work-sims/northgate-pm';

/**
 * How much of a spec has to change between version 1 and version 2 before the
 * revision counts as a changed plan rather than a reworded one. Measured on
 * content words only, so swapping "we are going to" for "we will" moves nothing.
 */
export const REVISION_CHANGE_THRESHOLD = 0.15;

/**
 * Function words, stripped before the two spec versions are compared. Deliberately
 * short: it covers the words a rewrite shuffles, not the words a plan is made of.
 * Nouns, verbs of action and every number stay in.
 */
const STOPWORDS = new Set([
  'a', 'about', 'after', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'been', 'before', 'being', 'but', 'by', 'can', 'could', 'did', 'do', 'does',
  'doing', 'for', 'from', 'go', 'going', 'had', 'has', 'have', 'he', 'her', 'here',
  'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'may',
  'might', 'more', 'most', 'much', 'must', 'my', 'no', 'not', 'of', 'on', 'once',
  'one', 'only', 'or', 'other', 'our', 'out', 'over', 'own', 'same', 'shall', 'she',
  'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'up', 'us',
  'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who',
  'why', 'will', 'with', 'would', 'you', 'your',
]);

const text = (v) => (typeof v === 'string' ? v : '');
const list = (v) => (Array.isArray(v) ? v : []);

/** Lowercase, drop punctuation, collapse whitespace. */
const normalise = (s) =>
  text(s)
    .toLowerCase()
    .replace(/[^a-z0-9%.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Sentence periods are stripped off the ends of a token, but the one inside
// "3.9" is left alone, because a number changing is the change worth catching.
const contentWords = (s) =>
  normalise(s)
    .split(' ')
    .map(w => w.replace(/^\.+|\.+$/g, ''))
    .filter(w => w && !STOPWORDS.has(w));

/** A word list as counts, so "duplicate" twice is not the same as once. */
const counts = (words) => {
  const map = new Map();
  words.forEach(w => map.set(w, (map.get(w) || 0) + 1));
  return map;
};

/** How many entries of `a` have no partner in `b`, respecting repeats. */
const unmatched = (a, b) => {
  const other = counts(b);
  let n = 0;
  a.forEach(w => {
    const left = other.get(w) || 0;
    if (left > 0) other.set(w, left - 1);
    else n += 1;
  });
  return n;
};

/** A heading line, stripped of markdown and trailing colon, for comparison. */
const headingKey = (line) =>
  text(line)
    .replace(/^[\s#>*_-]+/, '')
    .replace(/[\s:*_]+$/, '')
    .trim()
    .toLowerCase();

const joinList = (parts) => {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};

/** Points for an item, with the revision's re-estimate applied if there is one. */
export function pointsFor(itemId, sim = NORTHGATE_PM) {
  const revised = sim?.revision?.revised_points || {};
  if (typeof revised[itemId] === 'number') return revised[itemId];
  const item = list(sim?.backlog?.items).find(i => i.id === itemId);
  return typeof item?.points === 'number' ? item.points : 0;
}

/**
 * Criterion 2. The final plan fits the revised capacity.
 *
 * Reads `selected_items_final`, the selection as it stood after the revision,
 * and falls back to the pre-revision selection only when the run never got that
 * far. Ids that are not in the backlog are ignored rather than counted as zero,
 * and they are named in the detail so a mismatch is visible instead of silent.
 *
 * Selecting nothing does not pass. The criterion is about a plan fitting, and
 * an empty sprint is not a plan.
 */
export function checkRevisedCapacity(run, sim = NORTHGATE_PM) {
  const capacity = Number(sim?.backlog?.capacity) || 0;
  const known = new Set(list(sim?.backlog?.items).map(i => i.id));

  const finalIds = Array.isArray(run?.selected_items_final)
    ? run.selected_items_final
    : list(run?.selected_items);

  const ids = finalIds.filter(id => known.has(id));
  const unknownIds = finalIds.filter(id => !known.has(id));
  const total = ids.reduce((sum, id) => sum + pointsFor(id, sim), 0);

  const titleOf = (id) => list(sim?.backlog?.items).find(i => i.id === id)?.title || id;
  const breakdown = ids.map(id => `${titleOf(id)} (${pointsFor(id, sim)})`);

  if (!ids.length) {
    return {
      criterion: 'plan_fits_capacity',
      passed: false,
      detail: `Nothing was selected for the sprint, so there is no plan to measure against the ${capacity} points of capacity.`,
      scored_by: 'checks',
    };
  }

  const passed = total <= capacity;
  const parts = [
    `Your final sprint is ${total} ${total === 1 ? 'point' : 'points'} against a capacity of ${capacity}: ${joinList(breakdown)}.`,
    passed
      ? 'It fits.'
      : `That is ${total - capacity} over. Priya said she would rather you cut it than carry it and miss.`,
  ];
  if (unknownIds.length) parts.push(`Ignored, because they are not on the list: ${unknownIds.join(', ')}.`);

  return {
    criterion: 'plan_fits_capacity',
    passed,
    detail: parts.join(' '),
    scored_by: 'checks',
  };
}

/**
 * Criterion 3. The spec says what is not being done.
 *
 * The spec is one block of free text written under a scaffold of headings, so
 * the check finds the non-goals heading by its label and takes everything up to
 * the next heading. Three outcomes, kept apart on purpose: no heading at all, a
 * heading with nothing under it, and a heading with something under it. The
 * middle one is the common case and it is the one worth showing back.
 */
export function checkNonGoals(run, sim = NORTHGATE_PM) {
  const headings = list(sim?.spec?.headings);
  const target = headings.find(h => h.id === 'not_doing') || headings[3];
  const label = text(target?.label) || 'What we are not doing';

  const spec = text(run?.spec_v2).trim() || text(run?.spec_v1).trim();
  const lines = spec.split('\n');
  const keys = new Set(headings.map(h => headingKey(h.label)));
  const wanted = headingKey(label);

  const start = lines.findIndex(l => headingKey(l) === wanted);

  if (start === -1) {
    return {
      criterion: 'non_goals_present',
      passed: false,
      detail: `There is no "${label}" section in the spec.`,
      scored_by: 'checks',
    };
  }

  const rest = lines.slice(start + 1);
  const end = rest.findIndex(l => keys.has(headingKey(l)));
  const body = (end === -1 ? rest : rest.slice(0, end))
    .map(l => text(l).replace(/^[\s*_-]+/, '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!body) {
    return {
      criterion: 'non_goals_present',
      passed: false,
      detail: `The "${label}" heading is in the spec with nothing written under it.`,
      scored_by: 'checks',
    };
  }

  return {
    criterion: 'non_goals_present',
    passed: true,
    detail: `Under "${label}" you wrote: "${body}"`,
    scored_by: 'checks',
  };
}

/**
 * Criterion 5. The revision changed the plan rather than restating it.
 *
 * Two things can carry the change and either one is enough. A different set of
 * items in the sprint is a changed plan by definition. Otherwise it comes down
 * to the two spec versions, compared on content words only so that rewording a
 * sentence does not read as reworking a sprint.
 */
export function checkRevisionChanged(run, sim = NORTHGATE_PM) {
  const v1 = text(run?.spec_v1).trim();
  const v2 = text(run?.spec_v2).trim();

  if (!v2) {
    return {
      criterion: 'revision_changed_plan',
      passed: false,
      detail: 'There is no second version of the spec to compare against.',
      scored_by: 'checks',
    };
  }

  const known = new Set(list(sim?.backlog?.items).map(i => i.id));
  const before = list(run?.selected_items).filter(id => known.has(id));
  const after = Array.isArray(run?.selected_items_final)
    ? run.selected_items_final.filter(id => known.has(id))
    : null;

  const selectionChanged =
    after !== null &&
    (after.length !== before.length || [...after].sort().join('|') !== [...before].sort().join('|'));

  const titleOf = (id) => list(sim?.backlog?.items).find(i => i.id === id)?.title || id;
  const dropped = after ? before.filter(id => !after.includes(id)) : [];
  const added = after ? after.filter(id => !before.includes(id)) : [];

  const w1 = contentWords(v1);
  const w2 = contentWords(v2);
  const changed = unmatched(w1, w2) + unmatched(w2, w1);
  const size = w1.length + w2.length;
  const ratio = size ? changed / size : 0;

  // The ratio decides. It never prints. The read-out bans percentages for the
  // same reason it bans a fit score: a number out of 100 beside a student's
  // writing reads as a mark, whatever sentence it sits in, and this one is a
  // count of words that did not pair up rather than a measure of how much the
  // plan moved. The word count underneath is the honest version of the same
  // fact, and the falsifier next to it already says this compares words and
  // not meaning.
  const wordsMoved = `${changed} ${changed === 1 ? 'word' : 'words'}`;

  const moves = [];
  if (dropped.length) moves.push(`took out ${joinList(dropped.map(titleOf))}`);
  if (added.length) moves.push(`put in ${joinList(added.map(titleOf))}`);

  if (selectionChanged && moves.length) {
    return {
      criterion: 'revision_changed_plan',
      passed: true,
      detail: `After Priya's message you ${joinList(moves)}, and ${wordsMoved} of the spec changed with it.`,
      scored_by: 'checks',
    };
  }

  if (normalise(v1) === normalise(v2)) {
    return {
      criterion: 'revision_changed_plan',
      passed: false,
      detail: 'The second version is word for word the first one. The sprint went back unchanged.',
      scored_by: 'checks',
    };
  }

  const passed = ratio >= REVISION_CHANGE_THRESHOLD;
  return {
    criterion: 'revision_changed_plan',
    passed,
    detail: passed
      ? `The sprint kept the same items, and ${wordsMoved} of the spec changed between the two versions.`
      : `The sprint kept the same items, and ${wordsMoved} of the spec changed between the two versions. The wording moved more than the plan did.`,
    scored_by: 'checks',
  };
}

/** The three criteria that run whether or not a model is reachable. */
export function runWorkSimChecks(run, sim = NORTHGATE_PM) {
  return [
    checkRevisedCapacity(run, sim),
    checkNonGoals(run, sim),
    checkRevisionChanged(run, sim),
  ];
}
