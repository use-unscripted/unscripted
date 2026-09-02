/**
 * The triangulation read for a Path Complete path.
 *
 * The matrix says where a path stands. This says why it stands there, how much
 * the conclusion can be trusted, and which pieces of evidence agree or conflict.
 *
 * Assembled, not invented: the gap roster, the ConvictionGapOutcome rows, the
 * existing contradiction detector and the existing tension builder already
 * produce everything here. No new score exists, every number is a count of
 * something the student produced, and no contradiction is ever resolved or
 * averaged away.
 */
import { EVIDENCE_METHODS, METHOD_BY_ID } from '@/lib/evidence-methods';

const LOWER = ['stated', 'exposure'];
const UPPER = ['applied', 'lived'];

const direction = (o) => {
  const d = o.career_interest_delta;
  if (typeof d !== 'number' || d === 0) return 'unclear';
  return d > 0 ? 'toward' : 'away';
};

const DIRECTION_LABEL = { toward: 'toward this path', away: 'away from this path', unclear: 'no clear direction' };

/**
 * @param {object} args
 * @param {object|null} args.roster    buildGapRoster() result for the path
 * @param {Array} args.outcomes        ConvictionGapOutcome rows for the path
 * @param {Array} args.contradictions  detectContradictions() result
 * @param {Array} args.tensions        buildTensions() result for the path
 */
export function buildTriangulation({ roster = null, outcomes = [], contradictions = [], tensions = [] } = {}) {
  const done = (Array.isArray(outcomes) ? outcomes : [])
    .filter(o => o.chain_stage === 'test_completed' && (o.evidence_created || 0) > 0);

  /* 1. Agreement ACROSS methods, never within one. */
  const methods = EVIDENCE_METHODS.map(m => {
    const rows = done.filter(o => o.evidence_method === m.id);
    if (!rows.length) return null;
    const counts = { toward: 0, away: 0, unclear: 0 };
    rows.forEach(o => { counts[direction(o)] += 1; });
    const lead = counts.toward === counts.away ? 'unclear' : counts.toward > counts.away ? 'toward' : 'away';
    return { id: m.id, label: m.label, tests: rows.length, direction: lead, counts };
  }).filter(Boolean);

  const pointed = methods.filter(m => m.direction !== 'unclear');
  const towardMethods = pointed.filter(m => m.direction === 'toward');
  const awayMethods = pointed.filter(m => m.direction === 'away');
  const agreement = {
    methods,
    kinds: methods.length,
    diverges: towardMethods.length > 0 && awayMethods.length > 0,
    summary: methods.length < 2
      ? 'Only one kind of evidence exists here, so there is nothing yet to check it against.'
      : !pointed.length
        ? `${methods.length} kinds of evidence exist here, and none of them moved interest in this path either way.`
        : towardMethods.length && awayMethods.length
          ? `${towardMethods.length} ${towardMethods.length === 1 ? 'kind of evidence points' : 'kinds of evidence point'} toward this path and ${awayMethods.length} ${awayMethods.length === 1 ? 'points' : 'point'} away from it.`
          : `${pointed.length} independent ${pointed.length === 1 ? 'kind' : 'kinds'} of evidence point ${DIRECTION_LABEL[pointed[0].direction]}.`,
  };

  /* 2. Where the conclusion actually rests on the ladder. */
  const lower = done.filter(o => LOWER.includes(o.evidence_method)).length;
  const upper = done.filter(o => UPPER.includes(o.evidence_method)).length;
  const middle = done.length - lower - upper;
  const highest = done
    .map(o => o.evidence_method)
    .filter(Boolean)
    .sort((a, b) => EVIDENCE_METHODS.findIndex(m => m.id === b) - EVIDENCE_METHODS.findIndex(m => m.id === a))[0] || null;

  const strength = {
    lower,
    middle,
    upper,
    total: done.length,
    highest,
    highestLabel: highest ? METHOD_BY_ID.get(highest)?.label || highest : null,
    rows: EVIDENCE_METHODS.map(m => ({ id: m.id, label: m.label, tests: done.filter(o => o.evidence_method === m.id).length })),
    summary: upper === 0
      ? 'Nothing here came from doing a real piece of the work, so this reasoning rests on lighter evidence than the same result reached by doing it.'
      : upper > lower
        ? `Most of this rests on real work: ${upper} of ${done.length} pieces sit at Applied or Lived, against ${lower} at Stated or Exposure.`
        : `${upper} of ${done.length} ${upper === 1 ? 'piece sits' : 'pieces sit'} at Applied or Lived and ${lower} at Stated or Exposure, so the reasoning leans on the lighter evidence more than on real work.`,
  };

  /* 3. Contradictions. Kept open, never settled here. */
  const conflicts = [
    ...(Array.isArray(contradictions) ? contradictions : []).map(c => ({
      id: `signal:${c.id}`,
      title: `${c.label} reads both ways`,
      detail: c.note,
      open_question: 'Both readings are kept until another test settles which one holds.',
      source: 'Two of your own readings on the same characteristic',
    })),
    ...(Array.isArray(tensions) ? tensions : []).map(t => ({
      id: `tension:${t.id}`,
      title: t.title,
      detail: t.detail,
      open_question: t.open_question,
      source: t.source,
    })),
  ];

  /* 4. Gap by gap, with the methods each was tested at. */
  const coverage = (roster?.gaps || []).map(g => {
    const rows = done.filter(o => o.gap_id === g.id);
    const used = [...new Set(rows.map(o => o.evidence_method).filter(Boolean))]
      .map(id => METHOD_BY_ID.get(id)?.label || id);
    return {
      id: g.id,
      label: g.label,
      question: g.question,
      state: g.state,
      tests: rows.length,
      methods: used,
      onceOnly: g.state === 'tested_once',
    };
  });

  return {
    agreement,
    strength,
    conflicts,
    hasContradiction: conflicts.length > 0,
    coverage,
    testedOnce: coverage.filter(c => c.onceOnly).length,
    untested: coverage.filter(c => c.state === 'untested').length,
  };
}

export default buildTriangulation;