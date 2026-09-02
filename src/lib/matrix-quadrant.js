/**
 * Where each path sits on the two readings the matrix already computes:
 * Path Confidence (vertical) against Evidence Coverage (horizontal).
 *
 * No new metric, no new score, no new threshold system. Both values come from
 * the matrix rows as they already are, and a path with either reading missing is
 * simply not placed rather than being given an invented position.
 *
 * The quadrant is a summary of the CURRENT evidence state, never a decision. The
 * Decision Ready wording only appears where Decision Readiness already says so.
 */

const MID = 50;

export const QUADRANTS = {
  validate: {
    key: 'validate',
    title: 'Validate path',
    message: 'Early evidence looks promising, so keep testing.',
    meaning: 'Promising signals so far, but not enough evidence yet to justify stronger conviction.',
    corner: 'top-left',
    bg: 'var(--info-50)',
    fg: 'var(--info-700)',
  },
  continue: {
    key: 'continue',
    title: 'Continue',
    message: 'Strong evidence supports continued exploration.',
    meaning: 'Stronger path confidence and stronger evidence coverage.',
    corner: 'top-right',
    bg: 'var(--success-50)',
    fg: 'var(--success-700)',
  },
  exposure: {
    key: 'exposure',
    title: 'Seek exposure',
    message: 'Not enough evidence yet, so experience more of the path.',
    meaning: 'Too little evidence to make a meaningful judgment about this path yet.',
    corner: 'bottom-left',
    bg: 'var(--ink-100)',
    fg: 'var(--text-secondary)',
  },
  reassess: {
    key: 'reassess',
    title: 'Reassess direction',
    message: 'Evidence exists, but the path may need to be reconsidered or tested differently.',
    meaning: 'Meaningful evidence, and it is mixed or does not currently support stronger conviction.',
    corner: 'bottom-right',
    bg: 'var(--warning-50)',
    fg: 'var(--warning-700)',
  },
};

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function quadrantFor(confidence, coverage) {
  const c = num(confidence);
  const e = num(coverage);
  if (c === null || e === null) return null;
  if (c >= MID) return e >= MID ? QUADRANTS.continue : QUADRANTS.validate;
  return e >= MID ? QUADRANTS.reassess : QUADRANTS.exposure;
}

/**
 * The matrix rows as plottable points.
 * @param {Array}  rows       data.active from the matrix
 * @param {object} conviction data.conviction, keyed by path id
 */
export function plotPaths({ rows = [], conviction = {} } = {}) {
  const points = [];
  const unplaced = [];

  rows.forEach((row, i) => {
    const confidence = num(row.confidence?.value);
    const coverage = num(row.coverage?.value);
    const quadrant = quadrantFor(confidence, coverage);
    if (!quadrant) {
      unplaced.push({ pathId: row.pathId, name: row.name });
      return;
    }
    const readiness = conviction?.[row.pathId]?.decisionReadiness || null;
    points.push({
      index: points.length + 1,
      pathId: row.pathId,
      name: row.name,
      confidence,
      coverage,
      quadrant,
      readiness,
      // Only where Decision Readiness itself says so.
      readyLabel: quadrant.key === 'continue' && readiness?.key === 'ready' ? readiness.label : null,
      row,
      order: i,
    });
  });

  return { points, unplaced };
}

export default plotPaths;