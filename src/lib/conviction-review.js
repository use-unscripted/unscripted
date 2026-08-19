/**
 * The Conviction Review for one path: a short, honest read of where this path
 * stands, assembled entirely from records the student already produced.
 *
 * Nothing here is generated or scored. Each block names its own source, and a
 * block with no evidence behind it says so rather than filling itself in.
 */

const text = (v) => String(v || '').trim();
const longest = (arr) => arr.filter(Boolean).sort((a, b) => b.length - a.length)[0] || '';

/**
 * @param {object} args
 * @param {object} args.path
 * @param {object} args.hypothesis   derived Career Hypothesis
 * @param {object|null} args.progress dimensionProgress() result
 * @param {object} args.tradeoffs    buildTradeoffs() result
 * @param {Array}  args.tensions     buildTensions() result
 * @param {object|null} args.nextTest nextTestForPath() result
 * @param {object} args.readiness    decisionReadinessState() result
 * @param {object} args.context      loadStudentContext() result
 */
export function buildConvictionReview({ path, hypothesis, progress, tradeoffs = null, tensions = [], nextTest, readiness, context }) {
  const tradeoffItems = tradeoffs?.items || [];
  const unresolvedImportant = tradeoffs?.unresolvedImportant || [];
  const experiments = (context?.experiments || []).filter(e => e.path_name === path.path_name);
  const measurements = experiments.map(e => context?.measurements?.[e.id]).filter(Boolean);

  const known = (hypothesis?.what_we_know || []).slice(0, 3);
  const unknown = (progress?.untested || []).slice(0, 3);
  const support = (hypothesis?.supporting_evidence || [])[0] || null;
  const against = (hypothesis?.contradicting_evidence || [])[0] || null;

  /* The biggest assumption that changed: the student's own words from a
     post-experiment check-in, never a paraphrase. */
  const changed = longest(measurements.map(m => text(m.assumption_that_changed) || text(m.surprise_reflection)));

  const important = tradeoffItems
    .filter(t => t.importance === 'high' || t.status === 'concern' || t.status === 'dealbreaker')
    .slice(0, 3);

  /* What could still change their mind: open questions, disagreements in the
     evidence, and costs that have not been faced yet. */
  const mindChangers = [
    ...unknown.map(u => `${u.label} has never been tested here.`),
    ...tensions.slice(0, 2).map(t => t.question || t.title),
    ...unresolvedImportant
      .slice(0, 2)
      .map(t => `You have not decided whether you could accept ${String(t.label || '').toLowerCase()}.`),
    ...(hypothesis?.unresolved_questions || []).slice(0, 2).map(q => q.question),
  ].filter(Boolean).slice(0, 4);

  return {
    known: known.map(k => ({ text: k.text, source: k.source })),
    unknown: unknown.map(u => ({ text: u.label, source: u.question })),
    support: support ? { text: support.text, source: support.source } : null,
    against: against ? { text: against.text, source: against.source } : null,
    changedAssumption: changed || null,
    tradeoffs: important.map(t => ({ label: t.label, status: t.statusLabel || t.status, note: t.note || t.detail || '' })),
    mindChangers,
    nextTest: nextTest || null,
    readiness,
    basis: {
      experiments: experiments.filter(e => e.status === 'completed').length,
      checkIns: measurements.filter(m => m.post_completed_at).length,
      dimensionsRead: (progress?.rows || []).filter(r => r.status !== 'untested').length,
      dimensionsTotal: progress?.total || 0,
    },
  };
}

export default buildConvictionReview;