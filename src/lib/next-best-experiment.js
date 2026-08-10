/**
 * Next Best Experiment.
 *
 * The question this module answers is NOT "what should this student do next on
 * their best career". It is:
 *
 *   "What uncertainty should we test next to learn the most useful new thing
 *    about this student?"
 *
 * So the unit of recommendation is an UNRESOLVED QUESTION, not a career. Careers
 * enter only as the reason a question matters: the same unknown touching three
 * leading hypotheses is worth more than a private unknown on the top-ranked one,
 * and a career with a moderate fit and almost no evidence can beat a
 * well-tested favourite outright.
 *
 * Rules held here on purpose:
 *  - The highest-ranked career gets no automatic claim on the recommendation.
 *  - A test whose likely result would LOWER a career's fit is a good test. Value
 *    is measured in evidence gained, never in scores protected.
 *  - Characteristics with strong, consistent evidence are removed from the pool
 *    entirely, so the student is never asked to prove the same thing twice.
 *  - Contradictory evidence is a high-value target: it is the one case where
 *    retesting something already measured is the most useful thing available.
 *
 * Pure apart from the loader. Nothing student-facing repeats these terms.
 */
import { deriveHypothesis } from '@/lib/career-hypothesis';
import { loadRecalculationContext } from '@/lib/hypothesis-recalculation';
import { blueprintFor } from '@/lib/next-test-blueprints';

/** Every knob in one place, so the engine's judgement can be tuned. */
export const LEARNING_VALUE_WEIGHTS = {
  question_importance: 22,      // how central the characteristic is to the career
  career_relevance: 20,         // how much of the student's leading careers it touches
  evidence_weakness: 24,        // how little we currently know about it
  confidence_headroom: 14,      // how unsettled the affected careers are
  cross_career: 10,             // the same answer informs several careers
  differentiates: 8,            // it separates leading careers rather than confirming all
  contradiction: 18,            // conflicting readings that need a decider
  exploration_bonus: 8,         // a credible career with very little evidence
  recent_repeat_penalty: 22,    // tested in the last few experiments
  saturated_penalty: 30,        // already answered consistently
};

const RELEVANCE = { high: 1, medium: 0.62, low: 0.25 };
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const norm = (n, fallback = 0.5) => (typeof n === 'number' && Number.isFinite(n) ? n / 100 : fallback);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Everything the engine reads. Deliberately the same context the recalculation uses. */
export const loadNextBestContext = loadRecalculationContext;

// ── What we already know ────────────────────────────────────────────────────
/**
 * A characteristic counts as SETTLED when it has been measured more than once
 * and those readings agree. That is the test that stops the engine recommending
 * a fifth teamwork experiment to somebody who has already answered the question.
 */
function readingsOf(signal) {
  return [...(signal.enjoyment || []), ...(signal.energy || []), ...(signal.desire || [])]
    .filter(n => typeof n === 'number');
}

export function evidenceState(signal) {
  if (!signal) return { rated: 0, settled: false, contradicted: false, direction: null };
  const readings = readingsOf(signal);
  const high = readings.filter(n => n >= 7).length;
  const low = readings.filter(n => n <= 4.5).length;
  const contradicted = high > 0 && low > 0;
  const rated = signal.ratedCount || readings.length;
  const mean = avg(readings);
  return {
    rated,
    contradicted,
    settled: rated >= 2 && !contradicted && mean !== null && (mean >= 7 || mean <= 4.5),
    direction: mean === null ? null : mean >= 7 ? 'positive' : mean <= 4.5 ? 'negative' : 'mixed',
    mean,
    label: signal.label,
  };
}

/** Characteristics tested in the student's three most recent measured experiments. */
function recentlyTested(ctx) {
  const measured = (ctx.experiments || [])
    .filter(e => ctx.measurements?.[e.id]?.post_completed_at)
    .slice(0, 3);
  const ids = new Set();
  measured.forEach(e => [...(e.work_characteristic_ids || []), ...(e.work_characteristics_tested || [])]
    .forEach(t => ids.add(String(t).toLowerCase())));
  return ids;
}

// ── Candidate questions ─────────────────────────────────────────────────────
/**
 * Every unresolved question across every live career hypothesis, collapsed so
 * that one characteristic appears once with all of the careers it affects.
 */
export function deriveOpenQuestions(ctx) {
  const paths = (ctx.paths || []).filter(p => p.status !== 'archived' && p.hypothesis_status !== 'archived');
  if (!paths.length) return { candidates: [], hypotheses: [], leading: [] };

  const hypotheses = paths.map(path => ({ path, h: deriveHypothesis(path, ctx) }))
    .sort((a, b) => (b.h.career_fit_score || 0) - (a.h.career_fit_score || 0));
  const leading = hypotheses.slice(0, 3);
  const leadingIds = new Set(leading.map(x => x.path.id));

  const signalsById = new Map((ctx.signals || []).map(s => [s.id, s]));
  const recent = recentlyTested(ctx);
  const byVariable = new Map();

  hypotheses.forEach(({ path, h }) => {
    const contradictedHere = new Set((h.contradictions || []).map(c => c.id));
    (h.uncertainty?.variables || [])
      // Openness is judged per CHARACTERISTIC, not per career. The career-level
      // evidence strength rises with every experiment, so a student four
      // experiments in would otherwise look settled on characteristics nobody has
      // ever measured them on.
      .filter(v => v.relevance !== 'low'
        && (!evidenceState(signalsById.get(v.variable)).settled || contradictedHere.has(v.variable)))
      .forEach(v => {
        if (!byVariable.has(v.variable)) {
          byVariable.set(v.variable, {
            variable: v.variable,
            label: v.label,
            question: v.question,
            careers: [],
            evidence_strength: v.evidence_strength,
          });
        }
        const c = byVariable.get(v.variable);
        c.evidence_strength = Math.min(c.evidence_strength, v.evidence_strength);
        c.careers.push({
          path_id: path.id,
          path_name: path.path_name,
          relevance: v.relevance,
          fit: h.career_fit_score,
          confidence: h.fit_confidence_score,
          leading: leadingIds.has(path.id),
          contradicted: contradictedHere.has(v.variable),
        });
      });
  });

  const candidates = [...byVariable.values()]
    .map(c => score(c, { signalsById, recent, leading }))
    // Already answered, consistently, more than once: taken off the table
    // rather than ranked low, so it can never resurface as the best option.
    .filter(c => !(c.evidence.settled && !c.evidence.contradicted))
    .sort((a, b) => b.learning_value_score - a.learning_value_score);

  return { candidates, hypotheses, leading };
}

/** The learning value of answering one question, and the reasons behind it. */
function score(candidate, { signalsById, recent, leading }) {
  const W = LEARNING_VALUE_WEIGHTS;
  const evidence = evidenceState(signalsById.get(candidate.variable));
  const careers = candidate.careers;
  const factors = [];

  const importance = Math.max(...careers.map(c => RELEVANCE[c.relevance] || 0.25));
  const leadingTouched = careers.filter(c => c.leading);
  const relevanceToLeading = avg(leadingTouched.map(c => norm(c.fit))) ?? 0.4;
  // How little we know about THIS characteristic: measured twice is close to
  // answered, once is a start, never measured is open however much other work
  // the student has done.
  const strength = evidence.rated >= 2 ? 70 : evidence.rated === 1 ? 45 : Math.min(candidate.evidence_strength, 30);
  const weakness = 1 - norm(strength, 0.2);
  const headroom = 1 - (Math.min(...careers.map(c => norm(c.confidence, 0.5))));
  const crossCareer = careers.length >= 2 ? Math.min(1, (careers.length - 1) / 2) : 0;
  const differentiates = leading.length >= 2 && leadingTouched.length >= 1 && leadingTouched.length < leading.length;
  const contradicted = evidence.contradicted || careers.some(c => c.contradicted);
  const isRecent = recent.has(candidate.variable) || recent.has(candidate.label.toLowerCase());

  let total =
    importance * W.question_importance +
    relevanceToLeading * W.career_relevance +
    weakness * W.evidence_weakness +
    headroom * W.confidence_headroom +
    crossCareer * W.cross_career;

  if (differentiates) { total += W.differentiates; factors.push('separates your leading paths'); }
  if (contradicted) { total += W.contradiction; factors.push('resolves conflicting evidence'); }
  if (careers.length >= 2) factors.push('applies across several paths');
  if (weakness >= 0.6) factors.push('little evidence so far');

  // The career this test attaches to. Fit matters, but an unsettled career with
  // real open questions outranks a well-tested favourite, which is what stops
  // the top-ranked path collecting every recommendation.
  const attached = [...careers].sort((a, b) => opportunity(b) - opportunity(a))[0];
  if (norm(attached.confidence, 0.5) < 0.45) { total += W.exploration_bonus; factors.push('a path we still know little about'); }
  if (isRecent) total -= W.recent_repeat_penalty;
  if (evidence.settled) total -= W.saturated_penalty;

  return {
    ...candidate,
    evidence,
    attached,
    factors,
    contradicted,
    recently_tested: isRecent,
    cross_career: careers.length >= 2,
    differentiates,
    learning_value_score: clamp(total),
  };
}

function opportunity(c) {
  return (RELEVANCE[c.relevance] || 0.25) * (0.45 * norm(c.fit) + 0.55 * (1 - norm(c.confidence, 0.5)));
}

// ── The recommendation ──────────────────────────────────────────────────────
/** Characteristics the student has genuinely established, for "what we know". */
function established(ctx) {
  return (ctx.signals || [])
    .map(s => ({ signal: s, state: evidenceState(s) }))
    .filter(x => x.state.settled && x.state.direction === 'positive')
    .slice(0, 3)
    .map(x => x.signal.label.toLowerCase());
}

function modeOf(candidate, leading, ctx) {
  const measured = (ctx.experiments || []).filter(e => ctx.measurements?.[e.id]?.post_completed_at).length;
  if (!measured) return 'early';
  if (candidate.contradicted) return 'contradiction';
  const top = leading[0]?.path?.id;
  return candidate.attached.path_id === top ? 'confirmation' : 'exploration';
}

/**
 * The recommended next test, its reasoning, and the runners-up.
 * Returns null only when there is no live career hypothesis to test.
 */
export function nextBestExperiment(ctx) {
  const { candidates, hypotheses, leading } = deriveOpenQuestions(ctx);
  if (!candidates.length) return null;

  const top = candidates[0];
  const blueprint = blueprintFor(top);
  const mode = modeOf(top, leading, ctx);
  const knows = established(ctx);
  const careerNames = top.careers.filter(c => c.leading).map(c => c.path_name);
  const names = careerNames.length ? careerNames : top.careers.map(c => c.path_name);

  const why = [
    knows.length
      ? `You have shown ${knows.slice(0, 2).join(' and ')}.`
      : 'We know what you told us you want, and very little yet about how you work.',
    `We still do not know ${lowerFirst(top.question)}`,
    names.length > 1
      ? `That matters across ${names.slice(0, 3).join(', ')}.`
      : `That matters on ${names[0]}.`,
  ].join(' ');

  return {
    mode,
    early: mode === 'early',
    candidate: top,
    blueprint,
    title: blueprint.title,
    tests: blueprint.tests,
    why,
    // The career the experiment will be designed against, and how to start it.
    path_id: top.attached.path_id,
    path_name: top.attached.path_name,
    start_to: `/experiments/new?recId=${top.attached.path_id}&variable=${encodeURIComponent(top.variable)}`,
    detail: whyThisMatters(top, { knows, hypotheses, mode }),
    alternatives: candidates.slice(1, 4).map(c => ({
      ...c,
      blueprint: blueprintFor(c),
      start_to: `/experiments/new?recId=${c.attached.path_id}&variable=${encodeURIComponent(c.variable)}`,
    })),
  };
}

function lowerFirst(s) {
  const t = String(s || '').trim().replace(/\?$/, '');
  return t ? `${t[0].toLowerCase()}${t.slice(1)}.` : 'how you respond to this kind of work.';
}

/** The "Why this matters" view. Plain language, no scores, no formulas. */
function whyThisMatters(candidate, { knows, hypotheses, mode }) {
  const clarifies = candidate.careers
    .slice()
    .sort((a, b) => (b.fit || 0) - (a.fit || 0))
    .map(c => {
      const h = hypotheses.find(x => x.path.id === c.path_id);
      return {
        path_id: c.path_id,
        path_name: c.path_name,
        note: c.contradicted
          ? `Your readings on ${candidate.label.toLowerCase()} here have gone both ways.`
          : c.relevance === 'high'
            ? `${candidate.label} is central to this path and is still open.`
            : `${candidate.label} is relevant here and only partly tested.`,
        status: h?.h?.hypothesis_status || c.status,
      };
    });

  return {
    known: knows.length
      ? knows.map(k => `You consistently report and demonstrate strength around ${k}.`)
      : ['You have told us what you are aiming for, and we have not yet watched you do the work.'],
    learning: [
      candidate.evidence.contradicted
        ? `Whether you actually enjoy ${candidate.label.toLowerCase()}. You have rated it both ways, so a different realistic context is what settles it.`
        : `${candidate.question}`,
    ],
    why: mode === 'exploration'
      ? 'This is not your highest ranked path, but it is the one where a single piece of real evidence would tell us the most.'
      : mode === 'contradiction'
        ? 'Testing this again in a different realistic context is the fastest way to settle evidence that currently points both ways.'
        : mode === 'early'
          ? 'This is an early recommendation, based on your answers rather than on work we have watched you do.'
          : 'This is the open question that would change what we can tell you, rather than repeat what we already know.',
    clarifies,
    could_lower: `The result may lower ${candidate.attached.path_name}\u2019s estimate rather than raise it. That is still a good outcome: it means you learned something real before committing.`,
  };
}

/** Load and compute in one step, for the screens. */
export async function loadNextBestExperiment() {
  const ctx = await loadNextBestContext();
  return { ctx, recommendation: nextBestExperiment(ctx) };
}

export default nextBestExperiment;