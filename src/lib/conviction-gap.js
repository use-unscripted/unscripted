/**
 * The biggest Conviction Gap on one path.
 *
 * The single most important thing this student still needs to learn before they
 * could be more confident about this path. It is READ off records they already
 * produced — the Conviction Record's eight areas, the dimension readings behind
 * the Decision Matrix, and the path's own hypothesis — so nobody is asked to sit
 * another survey to find out what they are missing.
 *
 * One gap at a time, on purpose. A list of eight things to fix is not a next
 * step, and the whole point of this is to hand the student one.
 */

/* Importance order, not ease order. Doing the work comes before comparing it,
   and comparing it comes before declaring yourself ready. */
const PRIORITY = [
  'core_work',
  'capability',
  'reality_vs_expectations',
  'work_environment',
  'stability',
  'tradeoffs',
  'comparison',
  'action_readiness',
];

/** Why each area matters, and the kind of test that actually closes it. */
const GUIDE = {
  core_work: {
    matters: 'Everything else you conclude about this path rests on having done the work it is actually made of. Until then you are judging a description of the job, not the job.',
    test: 'A short test where you do one real task from this kind of role, start to finish.',
    dimension_led: true,
  },
  capability: {
    matters: 'How the work felt and how it went are different questions. Without something you produced, there is nothing to tell you whether you can do it well.',
    test: 'A test that ends in something you hand over: a document, a model, a design, a plan.',
    dimension_led: false,
  },
  reality_vs_expectations: {
    matters: 'The useful part of a test is the gap between what you expected and what happened. Without a before reading, that gap cannot be seen.',
    test: 'Any test where you record what you expect first, then complete it and answer the check-in after.',
    dimension_led: true,
  },
  work_environment: {
    matters: 'People rarely leave a career because of the tasks. They leave because of the pace, the structure, the autonomy or the amount of time with other people.',
    test: 'A test run under this field\u2019s real conditions, or a conversation with somebody doing it about how those conditions feel day to day.',
    dimension_led: true,
  },
  stability: {
    matters: 'One reading can be a good day or a bad one. A finding only becomes something to decide on once it has held up more than once.',
    test: 'A second test on the same thing, in a different realistic context.',
    dimension_led: true,
  },
  tradeoffs: {
    matters: 'A path with nothing recorded against it has usually not been examined, rather than being genuinely free of costs.',
    test: 'A test or conversation aimed at the part of this work you would least enjoy.',
    dimension_led: true,
  },
  comparison: {
    matters: 'Confidence in one path means little on its own. It needs something to be better than, tested on comparable terms.',
    test: 'One short test on a different path, so this one has a real comparison.',
    dimension_led: false,
  },
  action_readiness: {
    matters: 'A decision made while key parts of the work are still untested is a guess wearing a decision\u2019s clothes.',
    test: 'A short test on whichever dimension here still has no reading at all.',
    dimension_led: true,
  },
};

const RANK = { none: 0, early: 1, some: 2, strong: 3 };

/**
 * @param {object} args
 * @param {object} args.record   buildConvictionRecord() result
 * @param {object|null} args.progress dimensionProgress() result
 * @param {object|null} args.nextTest nextTestForPath() result, for the link
 * @returns {object|null} the gap, or null when every area has real evidence
 */
export function pickConvictionGap({ record, progress, nextTest }) {
  if (!record) return null;
  const byId = new Map(record.areas.map(a => [a.id, a]));
  const ordered = PRIORITY.map(id => byId.get(id)).filter(Boolean);

  // Weakest first, importance breaking the tie. Anything already strong is not
  // a gap.
  const gapArea = ordered
    .filter(a => a.state !== 'strong')
    .sort((a, b) => RANK[a.state] - RANK[b.state])[0];
  if (!gapArea) return null;

  const guide = GUIDE[gapArea.id] || {};
  /* The specific dimension behind the gap, where there is one. This is the same
     target the path's next test already points at, so the gap and the
     recommendation below it never disagree. */
  const target = guide.dimension_led ? dimensionFor(gapArea.id, progress) : null;

  return {
    id: gapArea.id,
    area: gapArea.label,
    // What they still do not know.
    unknown: target?.question || gapArea.question,
    dimension: target?.label || null,
    variable: target?.id || null,
    // Why it matters.
    matters: guide.matters,
    // What evidence already exists.
    evidence: gapArea.detail,
    basis: record.basis,
    // What kind of test would help.
    test: guide.test,
    to: (target && nextTest?.to) || null,
  };
}

/** The dimension a gap is really about: untested, then unsettled, then partial. */
function dimensionFor(areaId, progress) {
  if (!progress) return null;
  const rows = progress.rows || [];
  if (areaId === 'work_environment') {
    const environment = rows.filter(r => ENVIRONMENT.has(r.id));
    return environment.find(r => r.status === 'untested') || environment.find(r => r.contradicted) || environment[0] || null;
  }
  if (areaId === 'stability') {
    return (progress.tested || []).find(t => t.contradicted) || (progress.partial || [])[0] || (progress.untested || [])[0] || null;
  }
  if (areaId === 'tradeoffs') {
    return (progress.tested || []).find(t => t.contradicted) || (progress.untested || [])[0] || null;
  }
  return (progress.untested || [])[0] || (progress.partial || [])[0] || (progress.tested || []).find(t => t.contradicted) || null;
}

const ENVIRONMENT = new Set([
  'pace', 'structure', 'autonomy', 'independent_work', 'teamwork',
  'interpersonal', 'repetitive_tolerance', 'stakeholder_conflict',
]);

export default pickConvictionGap;