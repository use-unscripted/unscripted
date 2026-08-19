/**
 * How much answering one open question could actually MOVE a student's
 * conviction about a Path.
 *
 * Learning value already asks "how little do we know about this". This asks a
 * different question: "if we learned it, would anything the student believes
 * change?" Two things follow from that:
 *
 *  - A question that separates two Paths the student is weighing at almost the
 *    same fit is worth more than one that would nudge a Path already miles
 *    ahead. It is where a real tradeoff sits.
 *  - A question with consistent readings on a Path the student is already
 *    confident about is worth less, even when the pool is thin. Confirming
 *    something established does not change conviction.
 *
 * Deliberately separate from Experiment Strength, which is about how well
 * validated an experiment is, not about what this student stands to learn. This
 * module never reads validation data and must not start to.
 */

const norm = (n, fallback = 0.5) => (typeof n === 'number' && Number.isFinite(n) ? n / 100 : fallback);

/** How close two Paths have to be in fit before the choice counts as a tradeoff. */
export const TRADEOFF_FIT_GAP = 10;

/**
 * `careers` are the rows of one candidate question; `leading` are the ranked
 * hypotheses ({ path, h }); `attached` is the career the test would run on.
 */
export function convictionSignals({ evidence, careers = [], leading = [], attached = null }) {
  const fits = leading.map(x => x.h?.career_fit_score).filter(n => typeof n === 'number');
  const gap = fits.length >= 2 ? Math.abs(fits[0] - fits[1]) : null;
  const contenders = leading.slice(0, 2).map(x => x.path.id);
  const touched = careers.filter(c => contenders.includes(c.path_id)).length;

  // A live tradeoff: the top two are close, and this question does not simply
  // apply to both of them equally.
  const path_tradeoff = gap !== null && gap <= TRADEOFF_FIT_GAP && touched === 1;
  // The same question across both close contenders still clarifies the choice,
  // just less sharply than one that only one of them turns on.
  const contested = gap !== null && gap <= TRADEOFF_FIT_GAP && touched >= 2;

  // Measured more than once, pointing one way: another reading mostly repeats it.
  const established = Boolean(evidence)
    && evidence.rated >= 2
    && !evidence.contradicted
    && evidence.direction !== 'mixed';

  // And when the Path itself is already well settled, retesting it is the least
  // conviction-moving thing on the table.
  const confirms_settled = established && norm(attached?.confidence, 0.5) >= 0.7;

  return { path_tradeoff, contested, redundant: established, confirms_settled, fit_gap: gap };
}

export default convictionSignals;