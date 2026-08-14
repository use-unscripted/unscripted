/**
 * Career Fit dimensions.
 *
 * The architectural rule this file exists to hold: ABILITY and ENJOYMENT are
 * different kinds of evidence and are never inferred from one another. Being
 * good at work does not mean wanting to do it repeatedly, and enjoying work does
 * not mean currently being strong at it. Each dimension is scored from its own
 * evidence, carries its own confidence, and states its own uncertainty.
 *
 * Six dimensions, each 0-100:
 *   ability_fit           demonstrated performance on relevant work
 *   enjoyment_fit         enjoyment, energy, desire to repeat, frustration
 *   work_environment_fit  pace, structure, autonomy, interpersonal load
 *   preference_fit        how the work matches observed working preferences
 *   interest_fit          stated interest and pull toward the field
 *   evidence_confidence   how much evidence stands behind the above
 *
 * Nothing here recalculates and stores a career's fit — that is a later phase.
 * This module derives the dimensions so the future recalculation has real
 * fields and real evidence relationships to work from.
 *
 * Two guards worth naming:
 *  - Longitudinal by construction. Every dimension is shrunk toward neutral by
 *    how many relevant observations exist, so one unusual experiment moves a
 *    score a little and a repeated pattern moves it a lot. No single experiment
 *    can produce a settled conclusion.
 *  - Self-perception is stored next to observed performance, never merged into
 *    it. A gap between the two is recorded as evidence and left uninterpreted.
 */
import { evidenceSource, summarizeEvidence } from '@/lib/evidence-graph';

export const FIT_DIMENSIONS = [
  { key: 'ability_fit', label: 'Ability', question: 'How well are you performing at this kind of work?' },
  { key: 'enjoyment_fit', label: 'Enjoyment', question: 'Does doing this work repeatedly energise you?' },
  { key: 'work_environment_fit', label: 'Work Environment', question: 'Does this field\u2019s pace and structure suit you?' },
  { key: 'preference_fit', label: 'Preference Fit', question: 'Does this work match how you prefer to work?' },
  { key: 'interest_fit', label: 'Interest', question: 'How strongly are you drawn to this field?' },
];

const NEUTRAL = 50;
/** Observations needed before a dimension is allowed to move most of the way. */
const SHRINK_K = 2;

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const avg = (nums) => { const xs = nums.filter(n => n !== null); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
const pct10 = (n) => (n === null ? null : clamp(n * 10));

/**
 * Pull a raw 0-100 reading toward neutral according to how much evidence there
 * is. This is what stops one experiment defining a dimension.
 */
function longitudinal(raw, observations) {
  if (raw === null) return { score: null, weight: 0 };
  const w = observations / (observations + SHRINK_K);
  return { score: clamp(NEUTRAL + (raw - NEUTRAL) * w), weight: w };
}

/** Records relevant to this career, matched the way the rest of the app matches. */
function relevantActivity(path, { experiments = [], measurements = {}, proof = [], reflections = [] }) {
  const exps = experiments.filter(e =>
    e.path_name === path.path_name ||
    e.career_name === path.path_name ||
    e.career_hypothesis_id === path.id ||
    e.path_recommendation_id === path.id);
  const ids = new Set(exps.map(e => e.id));
  return {
    exps,
    completed: exps.filter(e => e.status === 'completed'),
    measured: exps.map(e => ({ exp: e, m: measurements[e.id] })).filter(x => x.m?.post_completed_at),
    proof: proof.filter(p => p.path_tested === path.path_name || ids.has(p.experiment_id)),
    reflections: reflections.filter(r => r.path_name === path.path_name || ids.has(r.experiment_id)),
  };
}

const expLink = (e) => `/experiments?experimentId=${e.id}`;

// ── Ability ─────────────────────────────────────────────────────────────────
/**
 * Ability reads performance evidence only: reviewed performance on the work,
 * reasoning and execution quality, demonstrated strengths, and proof of work.
 * A student's own rating of their performance is collected separately below and
 * deliberately does not feed this score.
 */
function abilityDimension(act) {
  const sources = [];
  const readings = [];

  act.measured.forEach(({ exp, m }) => {
    const observed = avg([num(m.system_performance_score), num(m.reasoning_quality), num(m.execution_quality)]);
    if (observed !== null) {
      readings.push(pct10(observed));
      sources.push(evidenceSource({
        kind: 'system_evaluation',
        detail: `Reviewed performance on ${exp.title}`,
        date: m.system_evaluated_at || m.post_completed_at,
        link: expLink(exp), nodeId: `performance:${m.id}`,
      }));
    }
    (m.demonstrated_strengths || []).slice(0, 3).forEach(s => sources.push(evidenceSource({
      kind: 'system_evaluation', detail: `Strength shown on ${exp.title}: ${s}`,
      date: m.system_evaluated_at || m.post_completed_at, link: expLink(exp), nodeId: `performance:${m.id}`,
    })));
  });

  // Completing the work is weaker ability evidence than being reviewed on it,
  // so it counts as a modest positive reading rather than a performance score.
  act.completed.filter(e => !act.measured.some(x => x.exp.id === e.id && num(x.m.system_performance_score) !== null)).forEach(e => {
    readings.push(62);
    sources.push(evidenceSource({
      kind: 'experiment', detail: `You completed ${e.title}`,
      date: e.updated_date || e.created_date, link: expLink(e), nodeId: `experiment:${e.id}`,
    }));
  });

  act.proof.forEach(p => {
    readings.push(68);
    sources.push(evidenceSource({
      kind: 'proof', detail: p.title, date: p.completed_at || p.created_date,
      link: '/evidence?tab=proof', nodeId: `proof:${p.id}`,
    }));
  });

  const { score, weight } = longitudinal(avg(readings), readings.length);
  return { key: 'ability_fit', observations: readings.length, raw: avg(readings), score, weight, sources, summary: summarizeEvidence(sources) };
}

/**
 * Self-rated ability, kept apart from the observed score above.
 * The discrepancy is stored and left uninterpreted: why it exists is exactly
 * what later evidence is for.
 */
function selfPerception(act) {
  const selfReadings = [];
  const observedReadings = [];
  const sources = [];
  act.measured.forEach(({ exp, m }) => {
    const self = num(m.self_rated_performance);
    const observed = avg([num(m.system_performance_score), num(m.reasoning_quality), num(m.execution_quality)]);
    if (self !== null) {
      selfReadings.push(pct10(self));
      sources.push(evidenceSource({
        kind: 'measurement', detail: `You rated your own performance on ${exp.title} at ${self}/10`,
        date: m.post_completed_at, link: expLink(exp), nodeId: `outcome:${m.id}`,
      }));
    }
    if (self !== null && observed !== null) observedReadings.push(pct10(observed));
  });
  const self = avg(selfReadings);
  const observed = avg(observedReadings);
  return {
    self_rated_ability: self === null ? null : clamp(self),
    observed_ability: observed === null ? null : clamp(observed),
    // Positive means observed came out above the student's own rating.
    discrepancy: self === null || observed === null ? null : clamp(observed) - clamp(self),
    pairs: observedReadings.length,
    sources,
  };
}

// ── Enjoyment ───────────────────────────────────────────────────────────────
/**
 * Enjoyment reads how the work actually felt: enjoyment, energy afterwards,
 * desire to do it again, and frustration inverted. Written reflections count as
 * supporting evidence of engagement.
 */
function enjoymentDimension(act) {
  const sources = [];
  const readings = [];

  act.measured.forEach(({ exp, m }) => {
    const positive = avg([num(m.actual_enjoyment), num(m.actual_energy), num(m.desire_to_repeat)]);
    const frustration = num(m.frustration_level);
    const combined = avg([positive, frustration === null ? null : 11 - frustration]);
    if (combined !== null) {
      readings.push(pct10(combined));
      sources.push(evidenceSource({
        kind: 'measurement', detail: `How ${exp.title} actually felt to you`,
        date: m.post_completed_at, link: expLink(exp), nodeId: `outcome:${m.id}`,
      }));
    }
  });

  act.reflections.forEach(r => {
    const dir = r.interest_direction;
    if (dir === 'more') readings.push(78);
    else if (dir === 'less') readings.push(30);
    sources.push(evidenceSource({
      kind: 'reflection', detail: r.path_name ? `Reflection on ${r.path_name}` : 'Reflection',
      date: r.created_date, link: '/evidence?tab=reflect', nodeId: `reflection:${r.id}`,
    }));
  });

  const { score, weight } = longitudinal(avg(readings), readings.length);
  return { key: 'enjoyment_fit', observations: readings.length, raw: avg(readings), score, weight, sources, summary: summarizeEvidence(sources) };
}

// ── Work environment, preferences, interest ─────────────────────────────────
/** Work environment: the characteristics of how a field runs, not what it asks you to be good at. */
const ENVIRONMENT_IDS = ['pace', 'structure', 'autonomy', 'interpersonal', 'independent_work', 'repetitive_tolerance', 'risk_tolerance'];

function fromSignals(key, act, { signals = [], uncertainty = null, ids = null }) {
  const relevantIds = ids || (uncertainty?.variables || []).map(v => v.variable);
  const matched = signals.filter(s => relevantIds.includes(s.id) && s.ratedCount);
  const readings = [];
  const sources = [];
  matched.forEach(s => {
    const positive = avg([s.avgEnjoyment, s.avgEnergy, s.avgDesire]);
    if (positive !== null) readings.push(pct10(positive));
    s.sources.slice(0, 2).forEach(src => sources.push(src));
  });
  const { score, weight } = longitudinal(avg(readings), readings.length);
  return { key, observations: readings.length, raw: avg(readings), score, weight, sources, summary: summarizeEvidence(sources) };
}

/** Interest: stated pull toward the field, plus whether they keep choosing it. */
function interestDimension(path, act, profile) {
  const sources = [];
  const readings = [];
  const said = [path.path_name, path.path_category].filter(Boolean).map(s => s.toLowerCase());
  const stated = [profile.career_interests, profile.favorite_topics, profile.secret_paths].filter(Boolean).join(' ').toLowerCase();
  if (stated && said.some(s => stated.includes(s.split(' ')[0]))) {
    readings.push(75);
    sources.push(evidenceSource({
      kind: 'onboarding', detail: 'You named this kind of work as something you are drawn to.',
      date: profile.created_date, link: '/profile', nodeId: 'user',
    }));
  }
  if (path.is_primary_focus) {
    readings.push(72);
    sources.push(evidenceSource({
      kind: 'onboarding', detail: 'You chose this as your primary focus.',
      date: path.last_active_at || path.created_date, link: '/paths', nodeId: `career:${path.id}`,
    }));
  }
  if (act.exps.length >= 2) {
    readings.push(70);
    sources.push(evidenceSource({
      kind: 'experiment', detail: `You have run ${act.exps.length} experiments on this path.`,
      date: act.exps[0].created_date, link: '/experiments', nodeId: `experiment:${act.exps[0].id}`,
    }));
  }
  const { score, weight } = longitudinal(avg(readings), readings.length);
  return { key: 'interest_fit', observations: readings.length, raw: avg(readings), score, weight, sources, summary: summarizeEvidence(sources) };
}

// ── Overall fit ─────────────────────────────────────────────────────────────
/**
 * Emphasis per career, so a future recalculation is not a fixed formula.
 * Weights are a starting point and are read from the career's own uncertainty
 * map: a dimension that matters more on this path carries more weight. Ability
 * is never allowed to be the whole score.
 */
export function dimensionWeights(path, uncertainty) {
  const relevance = new Map((uncertainty?.variables || []).map(v => [v.variable, v.relevance]));
  const highOn = (ids) => ids.some(id => relevance.get(id) === 'high');
  const base = { ability_fit: 0.3, enjoyment_fit: 0.3, work_environment_fit: 0.15, preference_fit: 0.15, interest_fit: 0.1 };
  if (highOn(['analytical_intensity', 'quantitative_work', 'attention_to_detail', 'problem_solving'])) base.ability_fit += 0.05;
  if (highOn(['pace', 'structure', 'repetitive_tolerance'])) base.work_environment_fit += 0.05;
  if (highOn(['autonomy', 'independent_work', 'risk_tolerance'])) base.preference_fit += 0.05;
  const total = Object.values(base).reduce((a, b) => a + b, 0);
  Object.keys(base).forEach(k => { base[k] = base[k] / total; });
  return base;
}

/**
 * A blended overall fit, offered as a candidate rather than written anywhere.
 * Each dimension contributes only in proportion to its own evidence weight, and
 * the remainder stays with the career's existing estimate, so a career with no
 * measured work keeps the estimate it already had instead of drifting toward
 * whichever single dimension happens to exist.
 */
export function blendOverallFit({ dimensions, weights, priorFit }) {
  let weighted = 0;
  let used = 0;
  Object.entries(weights).forEach(([key, w]) => {
    const d = dimensions[key];
    if (!d || d.score === null || !d.weight) return;
    const effective = w * d.weight;
    weighted += d.score * effective;
    used += effective;
  });
  if (!used) return { score: clamp(priorFit), evidence_share: 0 };
  const prior = clamp(priorFit);
  return { score: clamp(weighted + prior * (1 - used)), evidence_share: Math.round(used * 100) };
}

// ── States and language ─────────────────────────────────────────────────────
const HIGH = 65;
const LOW = 50;

/**
 * The four states the product has to be able to represent, plus the honest
 * fifth: not enough evidence yet to place the career in any of them.
 */
export function fitState(ability, enjoyment) {
  const a = ability.score, e = enjoyment.score;
  const aKnown = a !== null && ability.observations >= 1;
  const eKnown = e !== null && enjoyment.observations >= 1;
  if (!aKnown && !eKnown) return 'untested';
  if (!eKnown) return 'ability_only';
  if (!aKnown) return 'enjoyment_only';
  if (a >= HIGH && e >= HIGH) return 'high_ability_high_enjoyment';
  if (a >= HIGH && e < LOW) return 'high_ability_low_enjoyment';
  if (a < HIGH && e >= HIGH) return 'developing_ability_high_enjoyment';
  if (a < LOW && e < LOW) return 'low_ability_low_enjoyment';
  return 'mixed';
}

/**
 * Language rules live here so no screen has to reinvent them. Nothing states a
 * verdict, nothing tells the student they are bad at a career, and nothing
 * recommends a career on ability alone.
 */
export function stateNarrative(state) {
  switch (state) {
    case 'high_ability_high_enjoyment':
      return {
        headline: 'Strong on both dimensions so far',
        body: 'You are performing well at this kind of work and the evidence so far suggests you find it energising. That combination is a meaningful signal, and more experiments will show how well it holds.',
      };
    case 'high_ability_low_enjoyment':
      return {
        headline: 'Capable here, less energised by it',
        body: 'You are showing strong capability in this type of work, but the evidence currently suggests that doing it repeatedly may not be especially energising for you. Being good at something is not on its own a reason to build a career on it.',
      };
    case 'developing_ability_high_enjoyment':
      return {
        headline: 'Energised here, some abilities still developing',
        body: 'You appear highly energised by this type of work. Some relevant abilities are still developing, so additional experiments could show whether performance improves with practice. This is not a reason to rule the path out.',
      };
    case 'low_ability_low_enjoyment':
      return {
        headline: 'Current evidence points to weaker fit',
        body: 'Current evidence suggests this area may require further development, and the work has not been especially energising so far. Confidence here still depends on how much evidence exists, so this is not settled.',
      };
    case 'ability_only':
      return {
        headline: 'Ability evidence only, enjoyment still uncertain',
        body: 'You are demonstrating ability here. Additional evidence about enjoyment and work-environment fit will help determine whether the career is a strong overall match. Enjoyment is still uncertain.',
      };
    case 'enjoyment_only':
      return {
        headline: 'Enjoyment evidence only, ability still uncertain',
        body: 'The work has been energising so far, and ability is still uncertain because there is little performance evidence yet. Nothing here assumes one from the other.',
      };
    case 'mixed':
      return {
        headline: 'Mixed so far',
        body: 'Ability and enjoyment are both partly measured and neither is settled. Repeated evidence, not one experiment, is what will move this.',
      };
    default:
      return {
        headline: 'Not tested yet',
        body: 'Nothing has been measured on this path yet, so ability and enjoyment are both open questions.',
      };
  }
}

/** Which dimensions are still uncertain, stated explicitly and per dimension. */
export function dimensionUncertainty(dimensions) {
  return FIT_DIMENSIONS
    .filter(({ key }) => {
      const d = dimensions[key];
      return !d || d.observations === 0 || d.weight < 0.5;
    })
    .map(({ key, label, question }) => ({
      key,
      label,
      question,
      status: !dimensions[key]?.observations ? 'untested' : 'partly_tested',
      note: !dimensions[key]?.observations
        ? `${label} is still uncertain because nothing here has measured it yet.`
        : `${label} has been measured ${dimensions[key].observations} time${dimensions[key].observations === 1 ? '' : 's'}, which is not yet a repeated pattern.`,
    }));
}

/**
 * The whole dimension view for one career hypothesis.
 * Pure, and safe to call on every render.
 */
export function deriveFitDimensions(path, ctx = {}) {
  const act = relevantActivity(path, ctx);
  const uncertainty = ctx.uncertainty || null;
  const signals = ctx.signals || [];
  const profile = ctx.profile || {};

  const ability = abilityDimension(act);
  const enjoyment = enjoymentDimension(act);
  const environment = fromSignals('work_environment_fit', act, { signals, ids: ENVIRONMENT_IDS });
  const preference = fromSignals('preference_fit', act, { signals, uncertainty });
  const interest = interestDimension(path, act, profile);

  const dimensions = {
    ability_fit: ability,
    enjoyment_fit: enjoyment,
    work_environment_fit: environment,
    preference_fit: preference,
    interest_fit: interest,
  };

  const allSources = Object.values(dimensions).flatMap(d => d.sources);
  const evidence_confidence = summarizeEvidence(allSources).confidence;
  const weights = dimensionWeights(path, uncertainty);
  const state = fitState(ability, enjoyment);
  const self = selfPerception(act);

  return {
    dimensions,
    weights,
    scores: {
      ability_fit: ability.score,
      enjoyment_fit: enjoyment.score,
      work_environment_fit: environment.score,
      preference_fit: preference.score,
      interest_fit: interest.score,
      evidence_confidence,
    },
    evidence_confidence,
    state,
    narrative: stateNarrative(state),
    uncertain: dimensionUncertainty(dimensions),
    self_perception: self,
    observations: {
      measured_experiments: act.measured.length,
      completed_experiments: act.completed.length,
      proof: act.proof.length,
      reflections: act.reflections.length,
    },
  };
}

/** Attach the dimensions and their evidence to the Career Evidence Graph. */
export function linkFitDimensions(graph, pathId, fit) {
  const careerNode = `career:${pathId}`;
  Object.values(fit.dimensions).forEach(d => {
    const id = graph.node(`fit:${pathId}:${d.key}`, 'fit_dimension', d.key, { score: d.score, observations: d.observations });
    graph.link(careerNode, id, 'scored_on');
    d.sources.forEach(s => graph.link(s.nodeId, id, 'evidences'));
  });
  if (fit.self_perception.discrepancy !== null) {
    const id = graph.node(`self_gap:${pathId}`, 'self_perception_gap', 'Self-rating versus observed performance', {
      ...fit.self_perception,
    });
    graph.link(careerNode, id, 'has_gap');
    fit.self_perception.sources.forEach(s => graph.link(s.nodeId, id, 'evidences'));
  }
  return graph;
}