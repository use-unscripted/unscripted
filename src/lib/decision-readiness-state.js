/**
 * Decision Readiness for ONE path.
 *
 * Deliberately NOT a percentage and not one threshold. A path moves toward
 * Decision Ready only when the evidence behind it is DIVERSE: the core work has
 * actually been done, the conditions of the work have been read, reality has
 * been checked against expectations, the costs have been looked at, something
 * has held up more than once, and there is at least one alternative to compare
 * against. A path with four tests all pointing at the same dimension is still
 * Building Evidence, and a path with an unresolved contradiction is held at
 * Important Questions Remain however much evidence sits behind it.
 *
 * Everything is read off the Conviction Record, the dimension rows and the
 * tension signals that already exist. Nothing is stored and nothing is scored.
 *
 * Decision Ready means: you have enough evidence to make an informed decision.
 * It never means the career is the right one.
 */

/** The areas that have to carry evidence before a decision rests on more than a guess. */
const REQUIRED = ['core_work', 'reality_vs_expectations', 'work_environment', 'tradeoffs', 'stability'];
/** Diversity, rather than depth in one place. */
const SUPPORTING = ['capability', 'comparison'];

const RANK = { none: 0, early: 1, some: 2, strong: 3 };

export const READINESS_STATES = {
  exploring: {
    key: 'exploring',
    label: 'Exploring',
    tone: 'muted',
    meaning: 'You are still reading about this path rather than experiencing it.',
  },
  building: {
    key: 'building',
    label: 'Building Evidence',
    tone: 'info',
    meaning: 'Real evidence exists, and it still comes from too few kinds of experience to decide on.',
  },
  questions: {
    key: 'questions',
    label: 'Important Questions Remain',
    tone: 'warning',
    meaning: 'Something here disagrees with itself, or an area that matters has nothing behind it.',
  },
  approaching: {
    key: 'approaching',
    label: 'Approaching Decision Readiness',
    tone: 'info',
    meaning: 'Most of what matters has evidence behind it. One or two areas are still thin.',
  },
  ready: {
    key: 'ready',
    label: 'Decision Ready',
    tone: 'success',
    meaning: 'You have enough evidence across enough areas to make an informed decision. That is not a guarantee this career is the right one.',
  },
};

/**
 * @param {object} args
 * @param {object|null} args.record   buildConvictionRecord() result
 * @param {object|null} args.progress dimensionProgress() result
 * @param {Array}  args.tensions      buildTensions() result
 * @param {Array}  args.tradeoffs     buildTradeoffs() result
 */
export function decisionReadinessState({ record, progress, tensions = [], tradeoffs = [] }) {
  const areas = record?.areas || [];
  if (!areas.length) return { ...READINESS_STATES.exploring, gaps: [], reasons: [] };

  const byId = new Map(areas.map(a => [a.id, a]));
  const at = (id) => RANK[byId.get(id)?.state || 'none'] || 0;
  const labelOf = (id) => byId.get(id)?.label || id;

  const missing = REQUIRED.filter(id => at(id) === 0);
  const thin = REQUIRED.filter(id => at(id) === 1);
  const supportingMissing = SUPPORTING.filter(id => at(id) === 0);
  const untestedDimensions = (progress?.untested || []).length;
  const openTensions = (tensions || []).length;
  const unresolvedTradeoffs = (tradeoffs || []).filter(
    t => t.importance === 'high' && (t.status === 'unknown' || t.status === 'untested'),
  ).length;

  const gaps = [
    ...missing.map(id => ({ id, label: labelOf(id), why: 'Nothing recorded here yet.' })),
    ...thin.map(id => ({ id, label: labelOf(id), why: 'One piece of evidence so far.' })),
    ...supportingMissing.map(id => ({ id, label: labelOf(id), why: 'Nothing recorded here yet.' })),
  ];

  const reasons = [];
  if (untestedDimensions) reasons.push(`${untestedDimensions} key ${untestedDimensions === 1 ? 'dimension has' : 'dimensions have'} never been tested.`);
  if (openTensions) reasons.push(`${openTensions} ${openTensions === 1 ? 'piece' : 'pieces'} of your evidence disagree with each other.`);
  if (unresolvedTradeoffs) reasons.push(`${unresolvedTradeoffs} important ${unresolvedTradeoffs === 1 ? 'tradeoff is' : 'tradeoffs are'} still untested.`);

  const state = pick({ missing, thin, supportingMissing, untestedDimensions, openTensions, unresolvedTradeoffs, at });
  return { ...READINESS_STATES[state], gaps: gaps.slice(0, 4), reasons };
}

/** Ordered rules, read top to bottom. The first one that holds wins. */
function pick({ missing, thin, supportingMissing, untestedDimensions, openTensions, unresolvedTradeoffs, at }) {
  // Nothing done yet. The path is still a description.
  if (at('core_work') === 0) return 'exploring';

  // Evidence that disagrees with itself, or a required area with nothing at all
  // once the core work is under way, is a question rather than a shortfall.
  if (openTensions || (missing.length && at('core_work') >= 2)) return 'questions';

  // More than one required area empty, or the work only done once, is depth in
  // too few places to decide on.
  if (missing.length > 1 || at('core_work') === 1) return 'building';

  // Everything required carries evidence, nothing is unread, nothing important
  // is left hanging, and something has held up more than once.
  if (
    !missing.length &&
    !thin.length &&
    !supportingMissing.length &&
    !untestedDimensions &&
    !unresolvedTradeoffs &&
    at('stability') >= 2
  ) return 'ready';

  // One required area empty, or several thin ones, is still building.
  if (missing.length || thin.length > 2) return 'building';

  return 'approaching';
}

export default decisionReadinessState;