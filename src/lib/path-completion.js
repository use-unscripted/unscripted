/**
 * Path Complete for ONE path: five checks, each individually visible.
 *
 * Pure and derived. Nothing is stored for it, nothing is scored, and it is
 * deliberately NOT read off Decision Readiness — Decision Readiness answers
 * whether there is enough here to decide, and this answers whether the path has
 * actually been worked through. Neither one touches the other.
 *
 * Sources, all of which already exist:
 *   - buildGapRoster(): which of the eight gaps have something behind them
 *   - ConvictionGapOutcome rows: the method each completed test ran at
 *   - ExperimentMeasurement rows: whether the before and after check-ins were done
 *   - CareerConvictionPassport rows: the written answer for this path
 */

const HIGH_METHODS = ['applied', 'lived'];
const MIN_WRITTEN = 40;

/** The four states, in the order they are earned. */
export const COMPLETION_STATES = [
  { key: 'gaps_tested', label: 'Gaps Tested' },
  { key: 'all_gaps_tested', label: 'All Gaps Tested' },
  { key: 'all_gaps_complete', label: 'All Gaps Complete' },
  { key: 'path_complete', label: 'Path Complete' },
];

/** The one sentence Path Complete must always carry. */
export const PATH_COMPLETE_CAVEAT =
  'Path Complete means every gap has been tested and you can defend your conclusion, not that this career is decided, correct, or finished with.';

/** Testing a complete path is normal, not pointless. */
export const KEEP_TESTING_NOTE =
  'You can keep testing a complete path, and anything you add from here makes the conclusion sturdier.';

const written = (s) => String(s || '').trim();

/**
 * @param {object} args
 * @param {object|null} args.roster   buildGapRoster() result for the path
 * @param {Array} args.outcomes       ConvictionGapOutcome rows for the path
 * @param {object} args.context       loadStudentContext() result
 * @param {string} args.pathName      the path's name, to match its experiments
 * @param {object|null} args.passport CareerConvictionPassport row for the path
 */
export function pathCompletion({ roster = null, outcomes = [], context = {}, pathName = '', passport = null } = {}) {
  const gaps = roster?.gaps || [];
  const total = roster?.total || gaps.length || 0;
  const done = (Array.isArray(outcomes) ? outcomes : [])
    .filter(o => o.chain_stage === 'test_completed' && (o.evidence_created || 0) > 0);

  /* 1. Every gap tested at least once. */
  const testedGaps = gaps.filter(g => g.state !== 'untested').length;
  const allGapsTested = total > 0 && testedGaps === total;

  /* 2. Spread rather than concentration: the busiest gap does not hold more than
        half of the tests, and at least three gaps have a test on them. */
  const byGap = new Map();
  done.forEach(o => byGap.set(o.gap_id, (byGap.get(o.gap_id) || 0) + 1));
  const busiest = Math.max(0, ...byGap.values());
  const spread = byGap.size >= 3 && done.length > 0 && busiest <= Math.ceil(done.length / 2);

  /* 3. Before and after reflections on the tests actually run. */
  const experiments = (context.experiments || []).filter(e => e.path_name === pathName);
  const measured = experiments.map(e => context.measurements?.[e.id]).filter(Boolean);
  const bothEnds = measured.filter(m => m.pre_completed_at && m.post_completed_at).length;
  const reflected = measured.length > 0 && bothEnds === measured.length;

  /* 4. At least one piece of higher-value evidence. */
  const high = done.filter(o => HIGH_METHODS.includes(o.evidence_method));

  /* 5. The written answer. */
  const answer = written(passport?.how_you_decided) || written(passport?.what_you_know);
  const defended = answer.length >= MIN_WRITTEN;

  const checks = [
    {
      id: 'all_gaps_tested',
      label: 'Every conviction gap tested at least once',
      met: allGapsTested,
      detail: total
        ? `${testedGaps} of ${total} gaps have evidence behind them.`
        : 'No gaps are being tracked on this path yet.',
    },
    {
      id: 'spread',
      label: 'Evidence spread across the path, not stacked on one gap',
      met: spread,
      detail: done.length
        ? `${done.length} ${done.length === 1 ? 'test' : 'tests'} across ${byGap.size} ${byGap.size === 1 ? 'gap' : 'gaps'}, the busiest holding ${busiest}.`
        : 'No completed test has produced evidence on this path yet.',
    },
    {
      id: 'reflected',
      label: 'Before and after reflections finished on the tests you ran',
      met: reflected,
      detail: measured.length
        ? `${bothEnds} of ${measured.length} ${measured.length === 1 ? 'test has' : 'tests have'} both check-ins recorded.`
        : 'No test on this path has a check-in yet.',
    },
    {
      id: 'higher_value',
      label: 'At least one piece of Applied or Lived evidence',
      met: high.length > 0,
      detail: high.length
        ? `${high.length} ${high.length === 1 ? 'test sits' : 'tests sit'} at Applied or Lived.`
        : 'Nothing here yet came from doing a real piece of the work.',
    },
    {
      id: 'defended',
      label: 'You have written why this path is or is not worth pursuing',
      met: defended,
      detail: defended
        ? 'Your written answer is on file with this path.'
        : 'Write your conclusion in the Decide stage to meet this.',
    },
  ];

  const metCount = checks.filter(c => c.met).length;
  const allGapsComplete = allGapsTested && spread && reflected && high.length > 0;
  const complete = allGapsComplete && defended;

  const stateKey = complete
    ? 'path_complete'
    : allGapsComplete
      ? 'all_gaps_complete'
      : allGapsTested
        ? 'all_gaps_tested'
        : 'gaps_tested';

  return {
    checks,
    metCount,
    total: checks.length,
    complete,
    stateKey,
    state: COMPLETION_STATES.find(s => s.key === stateKey),
    states: COMPLETION_STATES,
    testedGaps,
    gapTotal: total,
    testsWithEvidence: done.length,
  };
}

export default pathCompletion;