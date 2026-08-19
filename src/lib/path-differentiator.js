/**
 * The most useful difference to test between two credible paths.
 *
 * The student is never asked which path they prefer. The differentiator is READ
 * off evidence that already exists: the dimensions each path's Career
 * Uncertainty Map says matter, and how many real readings each path has on each
 * of them. A dimension is only worth testing comparatively when it matters to
 * both paths and at least one of them is still unread on it — a dimension both
 * paths already have evidence on separates nothing new.
 *
 * Provenance stays per path. Each side keeps its own reading, its own count of
 * observations and its own confidence, and nothing here averages or merges the
 * two into a single score.
 */

const RELEVANCE = { high: 2, medium: 1, low: 0 };
const KNOWN_GAP = { untested: 3, partial: 2, tested: 0 };
const STATUS_LABEL = { tested: 'Tested', partial: 'One reading', untested: 'No reading yet' };
const lower = (s) => String(s || '').trim().replace(/\?$/, '').replace(/^./, c => c.toLowerCase());

/** A path credible enough to be worth comparing against. */
export function isCredible(entry) {
  const status = entry?.path?.hypothesis_status;
  if (status === 'eliminated' || status === 'archived' || status === 'low_fit') return false;
  const confidence = entry?.hypothesis?.fit_confidence_score;
  return (entry?.progress?.testedCount || 0) >= 1 || (typeof confidence === 'number' && confidence >= 40);
}

/**
 * @param {object} args
 * @param {{path: object, hypothesis: object, progress: object}} args.primary
 * @param {Array} args.others  same shape, the student's other paths
 * @returns {object|null} the comparison, or null when there is no second
 *          credible path or no dimension worth separating them on
 */
export function buildDifferentiator({ primary, others = [] }) {
  if (!primary?.progress?.rows?.length) return null;
  const credible = others.filter(o => o?.progress?.rows?.length && isCredible(o));
  if (!credible.length) return null;

  const mine = new Map(primary.progress.rows.map(r => [r.id, r]));
  let best = null;

  credible.forEach(other => {
    other.progress.rows.forEach(theirs => {
      const ours = mine.get(theirs.id);
      if (!ours) return; // matters to only one path, so it separates nothing
      const gap = KNOWN_GAP[ours.status] + KNOWN_GAP[theirs.status];
      if (!gap) return;  // both already read — no new separation available
      const score = gap + RELEVANCE[ours.relevance] + RELEVANCE[theirs.relevance];
      if (!best || score > best.score) best = { score, other, ours, theirs };
    });
  });

  if (!best) return null;

  const { other, ours, theirs } = best;
  return {
    variable: ours.id,
    dimension: ours.label,
    question: ours.question,
    /* Why this one and not another: stated in terms of what is unread, never in
       terms of which path is winning. */
    why: `${ours.label} matters to both ${primary.path.path_name} and ${other.path.path_name}, and ${
      ours.status === 'untested' && theirs.status === 'untested'
        ? 'neither has a reading on it yet'
        : 'at least one of them is still unread on it'
    }. Testing ${lower(ours.label)} tells you something about both, which comparing your own preferences cannot.`,
    /* One side each. Kept apart on purpose. */
    sides: [side(primary, ours), side(other, theirs)],
  };
}

function side(entry, row) {
  const confidence = entry.hypothesis?.fit_confidence_score;
  return {
    pathId: entry.path.id,
    pathName: entry.path.path_name,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status],
    observations: row.observations || 0,
    contradicted: Boolean(row.contradicted),
    relevance: row.relevance,
    confidence: typeof confidence === 'number' ? confidence : null,
    /* Where this path's reading came from, for this path only. */
    provenance: row.observations
      ? `${row.observations} recorded reading${row.observations === 1 ? '' : 's'} on ${lower(row.label)} from your own tests on ${entry.path.path_name}.`
      : `Nothing recorded on ${lower(row.label)} for ${entry.path.path_name} yet.`,
    to: `/moment?recId=${entry.path.id}&variable=${encodeURIComponent(row.id)}`,
  };
}

export default buildDifferentiator;