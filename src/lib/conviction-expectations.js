/**
 * Expectation against reality, across every test on ONE path.
 *
 * Per-experiment comparison already exists (expectation-reality.js). This adds
 * nothing to it: it reads the same measurement rows and reports, for a path, how
 * often the student's expectation and their actual experience pulled apart.
 *
 * Deliberate limits:
 *  - Only pairs the student actually answered are counted. No baseline is ever
 *    invented, and a test with only an after reading is excluded.
 *  - A single divergence is described, never concluded from. One experience
 *    cannot make a career right or wrong, and the copy here says so.
 *  - Nothing is scored, averaged into a fit percentage, or written back.
 */
import { COMPARISON_ROWS } from '@/lib/expectation-reality';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Which direction of movement is worth naming, in plain words. */
const WORDING = {
  enjoyment: { down: 'you enjoyed it less than you expected', up: 'you enjoyed it more than you expected' },
  difficulty: { down: 'it was easier than you expected', up: 'it was harder than you expected' },
  energy: { down: 'it left you flatter than you expected', up: 'it left you more energised than you expected' },
  frustration: { down: 'it frustrated you less than you expected', up: 'it frustrated you more than you expected' },
  repeat: { down: 'you want to repeat it less than you expected', up: 'you want to repeat it more than you expected' },
  interest: { down: 'your interest in the path fell', up: 'your interest in the path rose' },
  confidence: { down: 'your confidence that it fits you fell', up: 'your confidence that it fits you rose' },
};

/**
 * @param {object} args
 * @param {string} args.pathName
 * @param {object} args.context loadStudentContext() result
 */
export function buildExpectationEvidence({ pathName, context }) {
  const experiments = (context?.experiments || []).filter(e => e.path_name === pathName);
  const paired = experiments
    .map(e => ({ exp: e, m: context?.measurements?.[e.id] }))
    .filter(x => x.m?.pre_completed_at && x.m?.post_completed_at);

  const rows = COMPARISON_ROWS.map(r => {
    const deltas = paired
      .map(x => {
        const expected = num(x.m[r.pre]);
        const actual = num(x.m[r.post]);
        return expected === null || actual === null ? null : { title: x.exp.title, delta: actual - expected };
      })
      .filter(Boolean);
    if (!deltas.length) return null;

    const avg = mean(deltas.map(d => d.delta));
    const moved = deltas.filter(d => Math.abs(d.delta) >= 2);
    const dir = avg === null || Math.abs(avg) < 1 ? 'held' : avg > 0 ? 'up' : 'down';
    return {
      key: r.key,
      label: r.label,
      tests: deltas.length,
      moved: moved.length,
      average: avg === null ? null : Math.round(avg * 10) / 10,
      direction: dir,
      note: dir === 'held'
        ? 'Close to what you expected.'
        : `On average, ${WORDING[r.key]?.[dir] || 'this moved away from what you expected'}.`,
    };
  }).filter(Boolean);

  const surprises = rows.filter(r => r.direction !== 'held');

  return {
    tests: paired.length,
    rows,
    surprises,
    /* What this evidence is allowed to say, and what it is not. */
    summary: !paired.length
      ? 'You have not yet completed a test on this path with both a before and an after reading, so nothing has been checked against what you expected.'
      : surprises.length
        ? `Across ${paired.length === 1 ? 'one test' : `${paired.length} tests`} on this path, ${surprises.length === 1 ? 'one thing' : `${surprises.length} things`} came out differently from what you expected.`
        : `Across ${paired.length === 1 ? 'one test' : `${paired.length} tests`} on this path, what happened stayed close to what you expected.`,
    caveat: paired.length
      ? 'A gap between what you expected and what happened is evidence about your expectations, not a verdict on the career. One experience is never enough to call a path right or wrong, so this only shifts how much of your picture rests on guesswork.'
      : null,
  };
}