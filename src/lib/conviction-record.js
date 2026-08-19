/**
 * The Conviction Record for one Path.
 *
 * It answers one question in eight parts: how much real evidence stands behind
 * this path right now, before a decision gets made about it.
 *
 * Everything below is COUNTED from records the student already produced —
 * completed experiments, proof of work, reflections, pre/post check-ins, the
 * rated work characteristics behind the Decision Matrix, and the path's own
 * hypothesis. Nothing is scored, weighted or converted into a career-match
 * percentage, and no number is invented to fill a bar: each area reports how
 * many pieces of evidence exist and says plainly what is still missing.
 *
 * Four states, deliberately coarse, because that is the honest resolution of a
 * handful of observations:
 *   none    nothing yet
 *   early   one piece
 *   some    two or three
 *   strong  four or more
 */

/** Characteristics that describe the CONDITIONS of the work rather than the task. */
const ENVIRONMENT_DIMENSIONS = new Set([
  'pace', 'structure', 'autonomy', 'independent_work', 'teamwork',
  'interpersonal', 'repetitive_tolerance', 'stakeholder_conflict',
]);

export const STATES = {
  none: { label: 'No evidence yet', tone: 'muted' },
  early: { label: 'Early signal', tone: 'warning' },
  some: { label: 'Some evidence', tone: 'info' },
  strong: { label: 'Strong evidence', tone: 'success' },
};

const levelFor = (n) => (n >= 4 ? 'strong' : n >= 2 ? 'some' : n >= 1 ? 'early' : 'none');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * @param {object} args
 * @param {object} args.path         the PathRecommendations row
 * @param {object} args.hypothesis   the derived Career Hypothesis for it
 * @param {object|null} args.progress dimensionProgress() result for it
 * @param {object} args.readiness    decideReadiness() result for it
 * @param {object} args.context      loadStudentContext() result
 * @param {Array}  args.alternatives [{ name, testedCount }] for the other paths
 */
export function buildConvictionRecord({ path, hypothesis, progress, readiness, context, alternatives = [] }) {
  const pathName = path?.path_name;
  const experiments = (context.experiments || []).filter(e => e.path_name === pathName);
  const completed = experiments.filter(e => e.status === 'completed');
  const expIds = new Set(experiments.map(e => e.id));
  const proof = (context.proof || []).filter(x => x.path_tested === pathName || expIds.has(x.experiment_id));
  const reflections = (context.reflections || []).filter(r => r.path_name === pathName || expIds.has(r.experiment_id));
  const measurements = experiments.map(e => context.measurements?.[e.id]).filter(Boolean);
  const bothEnds = measurements.filter(m => m.pre_completed_at && m.post_completed_at);
  const rows = progress?.rows || [];
  const withReading = rows.filter(r => r.status !== 'untested');
  const environment = rows.filter(r => ENVIRONMENT_DIMENSIONS.has(r.id));
  const environmentRead = environment.filter(r => r.status !== 'untested');
  const contradicted = rows.filter(r => r.contradicted);
  const tradeoffPieces = [
    ...(hypothesis?.contradicting_evidence || []),
    ...contradicted,
  ];
  const testedAlternatives = alternatives.filter(a => a.testedCount > 0);
  const repeated = rows.filter(r => r.status === 'tested');

  const areas = [
    {
      id: 'core_work',
      label: 'The core work itself',
      question: 'Have you actually done the work this career is made of?',
      state: levelFor(completed.length + proof.length),
      detail: completed.length || proof.length
        ? `${plural(completed.length, 'test', 'tests')} finished on this path and ${plural(proof.length, 'piece', 'pieces')} of proof of work.`
        : 'You have not yet finished a test on this path, so the work itself is still described rather than experienced.',
    },
    {
      id: 'capability',
      label: 'Your capability at it',
      question: 'Is there evidence of how you performed, not just how it felt?',
      state: levelFor(proof.length + measurements.filter(m => m.post_completed_at).length),
      detail: proof.length
        ? `${plural(proof.length, 'deliverable', 'deliverables')} you produced, with ${plural(measurements.filter(m => m.post_completed_at).length, 'check-in', 'check-ins')} recorded after the work.`
        : 'Nothing you produced is recorded here yet, so capability rests on how the work felt rather than what it produced.',
    },
    {
      id: 'work_environment',
      label: 'The work environment',
      question: 'Do you know how the conditions of this work suit you: pace, structure, autonomy, people?',
      state: levelFor(environmentRead.length),
      detail: environment.length
        ? `${environmentRead.length} of ${environment.length} environment dimensions on this path have a reading behind them.`
        : 'No environment dimensions have come up as key on this path yet.',
    },
    {
      id: 'reality_vs_expectations',
      label: 'Reality against your expectations',
      question: 'Did you record what you expected before the work, and compare it after?',
      state: levelFor(bothEnds.length),
      detail: bothEnds.length
        ? `${plural(bothEnds.length, 'test', 'tests')} where you recorded expectations first and then what actually happened.`
        : 'You have not yet completed a test with both a before and an after reading, so nothing has been checked against what you expected.',
    },
    {
      id: 'tradeoffs',
      label: 'The tradeoffs',
      question: 'Have you looked at what this path would cost you, not only what it offers?',
      state: levelFor(tradeoffPieces.length),
      detail: tradeoffPieces.length
        ? `${plural(tradeoffPieces.length, 'thing', 'things')} recorded that count against this path, including ${plural(contradicted.length, 'dimension', 'dimensions')} where your readings went both ways.`
        : 'Nothing recorded yet works against this path, which usually means the tradeoffs have not been tested rather than that there are none.',
    },
    {
      id: 'comparison',
      label: 'Compared against your alternatives',
      question: 'Have you tested anything else, so this path has something to be better than?',
      state: levelFor(testedAlternatives.length),
      detail: testedAlternatives.length
        ? `${plural(testedAlternatives.length, 'other path', 'other paths')} of yours also has evidence behind it: ${testedAlternatives.slice(0, 3).map(a => a.name).join(', ')}.`
        : 'No other path of yours has evidence behind it yet, so there is nothing to compare this one against.',
    },
    {
      id: 'stability',
      label: 'Stability across experiences',
      question: 'Has what you found held up more than once?',
      state: contradicted.length && repeated.length < 2 ? 'early' : levelFor(repeated.length),
      detail: repeated.length
        ? `${plural(repeated.length, 'dimension', 'dimensions')} have held across more than one reading.${contradicted.length ? ` ${plural(contradicted.length, 'reading', 'readings')} went both ways and is not settled.` : ''}`
        : 'Nothing on this path has been read twice yet, so anything you found could still have been a one-off.',
    },
    {
      id: 'action_readiness',
      label: 'Action readiness',
      question: 'Is there enough here for a decision to rest on evidence rather than a guess?',
      state: readiness?.ready && completed.length
        ? 'strong'
        : readiness?.ready
          ? 'some'
          : levelFor(withReading.length ? Math.min(withReading.length, 2) : 0),
      detail: readiness?.ready
        ? `Every key dimension on this path has at least one reading, and ${plural(reflections.length, 'reflection', 'reflections')} is recorded against it.`
        : `${readiness?.remaining?.length || 0} key ${(readiness?.remaining?.length || 0) === 1 ? 'dimension has' : 'dimensions have'} never been tested, so a decision now would still rest on a guess about ${(readiness?.remaining?.length || 0) === 1 ? 'it' : 'them'}.`,
    },
  ];

  return {
    areas,
    /* How many areas have real evidence behind them. A count, never a score, and
       never framed as a percentage of conviction. */
    withEvidence: areas.filter(a => a.state !== 'none').length,
    total: areas.length,
    basis: {
      experiments: completed.length,
      proof: proof.length,
      reflections: reflections.length,
      checkIns: bothEnds.length,
      dimensions: withReading.length,
    },
  };
}