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
import { depthOf, recommendDepth, deepDiveUnlock, depthMeta } from '@/lib/experiment-depth';
import { loadOverrides, suppressionFrom } from '@/lib/recommendation-overrides';
import { base44 } from '@/api/base44Client';
import { scenarioEvidence } from '@/lib/scenarios/scenario-signals';
import { CAREER_DIMENSIONS } from '@/lib/career-dimensions';
import { humanRealityFor } from '@/lib/human-reality';

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
  scenario_disagreement: 12,    // hypothetical answers disagree with each other or with what we were told
  recent_repeat_penalty: 22,    // tested in the last few experiments
  saturated_penalty: 30,        // already answered consistently
  deferred_penalty: 16,         // the student asked to come back to it later
};

/**
 * Which interpretable rule produced the recommendation.
 *
 * Logged with every recommendation the student accepts or overrides, so that the
 * question "which rule tends to put forward the tests students actually learn
 * from" can be answered later from records rather than guessed. Deliberately a
 * short list of stated rules: no opaque model, and every id is readable.
 */
export const RULE_VERSION = '2026-08-r1';

export const RECOMMENDATION_RULES = {
  resolve_contradiction: 'Evidence on this dimension points both ways, so settling it is worth more than anything new.',
  differentiate_leading_paths: 'This answer separates the leading directions rather than confirming all of them.',
  cross_career_unknown: 'One unknown that several live directions turn on.',
  explore_low_confidence_path: 'A credible direction we know very little about yet.',
  first_behavioural_evidence: 'No experiment has been measured yet, so any real reading is the most useful thing available.',
  highest_impact_unknown: 'The open question with the highest impact on what we can tell this student.',
};

function ruleFor(candidate, mode) {
  if (candidate.contradicted) return 'resolve_contradiction';
  if (mode === 'early') return 'first_behavioural_evidence';
  if (candidate.differentiates) return 'differentiate_leading_paths';
  if (candidate.cross_career) return 'cross_career_unknown';
  if (mode === 'exploration') return 'explore_low_confidence_path';
  return 'highest_impact_unknown';
}

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
export function deriveOpenQuestions(ctx, { suppressed = new Map(), skip = [], pathId = null } = {}) {
  const skipSet = new Set(skip);
  const paths = (ctx.paths || []).filter(p => p.status !== 'archived' && p.hypothesis_status !== 'archived');
  if (!paths.length) return { candidates: [], hypotheses: [], leading: [] };

  const hypotheses = paths.map(path => ({ path, h: deriveHypothesis(path, ctx) }))
    .sort((a, b) => (b.h.career_fit_score || 0) - (a.h.career_fit_score || 0));
  const leading = hypotheses.slice(0, 3);
  const leadingIds = new Set(leading.map(x => x.path.id));

  const signalsById = new Map((ctx.signals || []).map(s => [s.id, s]));
  const recent = recentlyTested(ctx);
  const scenarioByVariable = scenarioSignalsByVariable(ctx.scenarioResponses || []);
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
    // The student's own overrides. "Not relevant" takes a question off the table
    // for a while; anything else only pushes it down the order. Nothing stored
    // about the uncertainty itself is touched either way.
    .filter(c => !skipSet.has(c.variable) && !suppressed.get(c.variable)?.hard)
    // Pinned to one career hypothesis: a student who just finished an experiment
    // on a path they created is asking what to test next ON THAT PATH, so only
    // questions that path actually turns on are candidates, and the test is
    // designed against it rather than against whichever path scores best.
    .filter(c => !pathId || c.careers.some(x => x.path_id === pathId))
    .map(c => score(c, { signalsById, recent, leading, suppressed, pathId, scenarioByVariable }))
    // Already answered, consistently, more than once: taken off the table
    // rather than ranked low, so it can never resurface as the best option.
    .filter(c => !(c.evidence.settled && !c.evidence.contradicted))
    .sort((a, b) => b.learning_value_score - a.learning_value_score);

  return { candidates, hypotheses, leading };
}

/**
 * Scenario answers, indexed by the uncertainty variables they touch.
 *
 * Scenario evidence never answers "which career", only "what is worth testing".
 * An unsettled hypothetical reading is exactly the kind of unknown a real
 * experiment can close, so it raises a question's learning value and nothing else.
 */
export function scenarioSignalsByVariable(responses = []) {
  const out = new Map();
  scenarioEvidence(responses).forEach(s => {
    const dim = CAREER_DIMENSIONS.find(d => d.id === s.dimension);
    if (!dim) return;
    [dim.id, ...dim.signals].forEach(v => out.set(v, s));
  });
  return out;
}

/** The learning value of answering one question, and the reasons behind it. */
function score(candidate, { signalsById, recent, leading, suppressed = new Map(), pathId = null, scenarioByVariable = new Map() }) {
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

  // Hypothetical answers that point both ways, on something no experiment has
  // settled, are a high-information unknown: the scenario raised the question and
  // only real work can answer it.
  const scenario = scenarioByVariable.get(candidate.variable);
  const scenarioUnsettled = Boolean(scenario)
    && (scenario.scenario_level === 'conflicting' || scenario.direction === 'unclear')
    && evidence.rated === 0;
  if (scenarioUnsettled) { total += W.scenario_disagreement; factors.push('your scenario answers point both ways'); }

  if (differentiates) { total += W.differentiates; factors.push('separates your leading paths'); }
  if (contradicted) { total += W.contradiction; factors.push('resolves conflicting evidence'); }
  if (careers.length >= 2) factors.push('applies across several paths');
  if (weakness >= 0.6) factors.push('little evidence so far');

  // The career this test attaches to. Fit matters, but an unsettled career with
  // real open questions outranks a well-tested favourite, which is what stops
  // the top-ranked path collecting every recommendation.
  const attached = (pathId && careers.find(c => c.path_id === pathId))
    || [...careers].sort((a, b) => opportunity(b) - opportunity(a))[0];
  if (norm(attached.confidence, 0.5) < 0.45) { total += W.exploration_bonus; factors.push('a path we still know little about'); }
  if (isRecent) total -= W.recent_repeat_penalty;
  if (evidence.settled) total -= W.saturated_penalty;
  const deferred = suppressed.get(candidate.variable);
  if (deferred) total -= W.deferred_penalty;

  return {
    ...candidate,
    evidence,
    attached,
    factors,
    contradicted,
    scenario_evidence: scenario || null,
    scenario_unsettled: scenarioUnsettled,
    recently_tested: isRecent,
    cross_career: careers.length >= 2,
    cross_career_count: careers.length,
    differentiates,
    deferred: deferred?.action || null,
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
export function nextBestExperiment(ctx, opts = {}) {
  const { candidates, hypotheses, leading } = deriveOpenQuestions(ctx, opts);
  if (!candidates.length) return null;

  const top = candidates[0];
  const blueprint = blueprintFor(top);
  // Quick Test or Deep Dive. Short is the normal answer; a Deep Dive is only put
  // forward once there is a run of short evidence on this career or the question
  // genuinely needs work you can hand over. Both are always offered.
  const onCareer = (ctx.experiments || []).filter(e =>
    e.status === 'completed'
    && (e.career_hypothesis_id === top.attached.path_id || e.path_name === top.attached.path_name));
  const quickTests = onCareer.filter(e => depthOf(e) === 'quick_test').length;
  const deepDives = onCareer.filter(e => depthOf(e) === 'deep_dive').length;
  const depth = recommendDepth({ quickTests, deepDives, question: top.question, contradicted: top.contradicted });
  const unlock = deepDiveUnlock({
    careerName: top.attached.path_name,
    testedDimensions: quickTests,
    totalDimensions: (top.careers.length && candidates.length + quickTests) || 0,
    quickTests,
    deepDives,
  });
  const mode = modeOf(top, leading, ctx);
  const knows = established(ctx);
  // Distinct, and limited to the careers the student is actively weighing.
  const uniq = (xs) => [...new Set(xs.filter(Boolean))];
  const careerNames = uniq(top.careers.filter(c => c.leading).map(c => c.path_name));
  const names = (careerNames.length ? careerNames : uniq(top.careers.map(c => c.path_name))).slice(0, 3);

  const why = [
    knows.length
      ? `You have shown ${knows.slice(0, 2).join(' and ')}.`
      : 'We know what you told us you want, and very little yet about how you work.',
    `We still do not know ${lowerFirst(top.question)}`,
    names.length > 1
      ? `That matters across ${names.slice(0, 3).join(', ')}.`
      : `That matters on ${names[0]}.`,
  ].join(' ');

  const rule_id = ruleFor(top, mode);

  /* Some unknowns cannot be simulated at all: lifestyle, hours, hierarchy,
     client dynamics, culture, progression, real stakes. Where the top-ranked
     question is one of those, the recommended next test IS a conversation with
     somebody who does the work, rather than a task pretending to stand in for
     it. Same slot, same authority. */
  const human = humanRealityFor(top);

  return {
    mode,
    human_reality: human,
    experiment_type: human ? 'human_reality' : 'work_sample',
    early: mode === 'early',
    candidate: top,
    // The rule behind this recommendation, kept interpretable and logged with
    // whatever the student does next.
    rule_id,
    rule_version: RULE_VERSION,
    rule_explanation: RECOMMENDATION_RULES[rule_id],
    rule_reasons: top.factors,
    blueprint,
    title: blueprint.title,
    tests: blueprint.tests,
    why,
    // The career the experiment will be designed against, and how to start it.
    path_id: top.attached.path_id,
    path_name: top.attached.path_name,
    // Which level we lead with, and the reason, so the screen never has to guess.
    depth: depth.depth,
    depth_alternative: depth.alternative,
    depth_reason: depth.reason,
    // Cross-hypothesis value, stated plainly: one answer that informs several
    // directions is worth more than three career-shaped tests of the same thing.
    // Distinct careers, and the ones the student is actually weighing rather than
    // every hypothesis on file: counting rows produced "useful across 21
    // directions", which is true of the data and meaningless to a student.
    cross_career_count: names.length,
    informs: names,
    cross_career_note: names.length >= 2
      // The careers themselves are already named in the paragraph above, so this
      // line carries only what that one does not: the count.
      ? `One test, useful across ${names.length} of the directions you are considering.`
      : null,
    // Why this is the SMALLEST useful test, rather than the most thorough one.
    smallest_useful: depth.depth === 'quick_test'
      ? 'A short test is enough to answer this, so there is no reason to spend longer on it yet.'
      : 'A short test cannot produce the evidence this question needs, so this one is longer on purpose.',
    depth_meta: depthMeta(depth.depth),
    alternative_depth_meta: depthMeta(depth.alternative),
    quick_test_count: quickTests,
    deep_dive_count: deepDives,
    unlock,
    // The dimensions the student can choose between before starting, all on the
    // career this test is attached to. The recommended one is first.
    dimension_options: candidates
      .filter(c => c.careers.some(x => x.path_id === top.attached.path_id))
      .slice(0, 8)
      .map(c => ({
        variable: c.variable,
        label: c.label,
        question: c.question,
        recommended: c.variable === top.variable,
      })),
    quick_to: `/moment?recId=${top.attached.path_id}&variable=${encodeURIComponent(top.variable)}`,
    deep_to: `/experiments/new?recId=${top.attached.path_id}&variable=${encodeURIComponent(top.variable)}`,
    start_to: human
      ? `/human-reality?recId=${top.attached.path_id}&variable=${encodeURIComponent(top.variable)}`
      : `/experiments/new?recId=${top.attached.path_id}&variable=${encodeURIComponent(top.variable)}`,
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

/**
 * Load and compute in one step, for the screens. `skip` is how a student asking
 * for something else is honoured within a session, on top of the overrides they
 * have already recorded.
 */
export async function loadNextBestExperiment({ skip = [], pathId = null } = {}) {
  const [baseCtx, overrides, scenarioResponses] = await Promise.all([
    loadNextBestContext(),
    loadOverrides().catch(() => []),
    base44.entities.ScenarioResponse.list('-completed_at', 200).catch(() => []),
  ]);
  const ctx = { ...baseCtx, scenarioResponses: Array.isArray(scenarioResponses) ? scenarioResponses : [] };
  const suppressed = suppressionFrom(overrides);
  // Pinned first. If that career has no open question left, fall back to the
  // cross-path recommendation rather than showing nothing.
  const rec = (pathId && nextBestExperiment(ctx, { suppressed, skip, pathId }))
    || nextBestExperiment(ctx, { suppressed, skip });
  return { ctx, recommendation: rec, overrides };
}

export default nextBestExperiment;