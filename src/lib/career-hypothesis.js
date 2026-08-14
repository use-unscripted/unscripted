/**
 * Career hypothesis layer for Paths.
 *
 * A Path is treated as a career hypothesis being tested, not a recommendation.
 * This module derives the hypothesis view (fit, confidence, evidence, unresolved
 * questions) from data the student already has — onboarding answers plus real
 * activity — and backfills it onto existing Paths so nobody restarts onboarding.
 *
 * Fit and confidence are SEPARATE and are never combined: fit is how promising
 * the career currently looks, confidence is how much evidence stands behind it.
 */
import { base44 } from '@/api/base44Client';
import { deriveUncertaintyMap, uncertaintyQuestions } from '@/lib/uncertainty-model';
import { deriveFitDimensions, blendOverallFit } from '@/lib/career-fit-dimensions';
import { characteristicSignals } from '@/lib/evidence-patterns';
import { evidenceConfidence, detectContradictions } from '@/lib/evidence-contradictions';
import { extractReflectionSignals } from '@/lib/reflection-signals';

export const HYPOTHESIS_STATUS_LABELS = {
  suggested: 'Suggested',
  testing: 'Testing',
  strong_evidence: 'Strong Evidence',
  mixed_evidence: 'Mixed Evidence',
  low_fit: 'Low Fit',
  archived: 'Archived',
};

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

/** Records that belong to this path, matched the way the rest of the app does. */
function activityFor(path, { experiments = [], proof = [], reflections = [], measurements = {} }) {
  const exps = experiments.filter(e => e.path_name === path.path_name);
  const expIds = new Set(exps.map(e => e.id));
  return {
    exps,
    completedExps: exps.filter(e => e.status === 'completed'),
    // Experiments with a completed post-experiment check-in. This is the
    // strongest evidence a career can have, so confidence counts it separately.
    measured: exps.filter(e => measurements[e.id]?.post_completed_at),
    proof: proof.filter(p => p.path_tested === path.path_name || expIds.has(p.experiment_id)),
    reflections: reflections.filter(r => r.path_name === path.path_name || expIds.has(r.experiment_id)),
  };
}

/**
 * The starting estimate for career fit, 0-100, before any measured dimension is
 * taken into account. Readiness (0-10) from onboarding is where it comes from.
 */
function priorFit(path) {
  if (typeof path.career_fit_score === 'number') return clamp(path.career_fit_score);
  const readiness = typeof path.readiness_score === 'number' ? path.readiness_score : null;
  if (readiness === null) return 60;
  return clamp(readiness * 10);
}

function supporting(path, act) {
  const items = [];
  (path.path_fit_signals || []).forEach(s => items.push({ text: s, source: 'Your onboarding answers' }));
  if (path.goals_supported) items.push({ text: path.goals_supported, source: 'Your stated goals' });
  if (!items.length && (path.why_it_fits || path.fit_reason)) {
    items.push({ text: path.why_it_fits || path.fit_reason, source: 'Your onboarding answers' });
  }
  if (act.completedExps.length) {
    items.push({
      text: `You completed ${act.completedExps.length} experiment${act.completedExps.length > 1 ? 's' : ''} on this path.`,
      source: 'Your experiments',
    });
  }
  if (act.proof.length) {
    items.push({
      text: `You produced ${act.proof.length} piece${act.proof.length > 1 ? 's' : ''} of proof of work here.`,
      source: 'Your proof of work',
    });
  }
  if (act.reflections.length) {
    items.push({
      text: `You have written ${act.reflections.length} reflection${act.reflections.length > 1 ? 's' : ''} about this work.`,
      source: 'Your reflections',
    });
  }
  // What the student actually said, in their own words, where a reflection
  // named a work characteristic and how they felt about it.
  act.reflections.forEach(r => extractReflectionSignals(r)
    .filter(x => x.polarity === 'positive')
    .slice(0, 2)
    .forEach(x => items.push({
      text: `You wrote positively about ${x.label.toLowerCase()}: "${x.quote}"`,
      source: 'Your reflections',
    })));
  return items;
}

function contradicting(path, act = {}, contradictions = []) {
  const items = [];
  if (path.why_it_may_not_fit || path.concern) {
    items.push({ text: path.why_it_may_not_fit || path.concern, source: 'Your onboarding answers' });
  }
  if (path.main_tradeoffs) items.push({ text: path.main_tradeoffs, source: 'Tradeoffs on this path' });
  // Negative reflection evidence and conflicting characteristics are recorded
  // here rather than cancelling out the positive evidence above. Both stay.
  (act.reflections || []).forEach(r => extractReflectionSignals(r)
    .filter(x => x.polarity === 'negative')
    .slice(0, 2)
    .forEach(x => items.push({
      text: `You wrote negatively about ${x.label.toLowerCase()}: "${x.quote}"`,
      source: 'Your reflections',
    })));
  contradictions.slice(0, 3).forEach(c => items.push({ text: c.note, source: 'Conflicting evidence' }));
  return items;
}

function unresolved(path, act) {
  const items = [];
  if (!act.completedExps.length) {
    items.push({
      question: 'Do you actually enjoy the day-to-day work on this path?',
      why_it_matters: 'Nothing here has been tested through real work yet.',
    });
  }
  if (!act.proof.length) {
    items.push({
      question: 'Can you produce work in this field you are proud of?',
      why_it_matters: 'Proof of work is the strongest evidence we can use.',
    });
  }
  const gaps = path.skill_gaps?.length ? path.skill_gaps : (path.current_gaps || []);
  gaps.slice(0, 2).forEach(g => items.push({
    question: `How quickly do you pick up ${String(g).toLowerCase()}?`,
    why_it_matters: 'This is a gap between where you are and what this path asks for.',
  }));
  if (!act.reflections.length) {
    items.push({
      question: 'Does this work give you energy or drain it?',
      why_it_matters: 'A reflection after real work is what tells us.',
    });
  }
  return items.slice(0, 4);
}

/**
 * Status is a description of the evidence, not a verdict. A career is never
 * archived here just because its fit fell: that is the student's decision.
 */
function hypothesisStatus(path, { fit, confidence, act, against, contradictions = [] }) {
  if (path.status === 'archived') return 'archived';
  const tested = act.completedExps.length || act.proof.length || act.reflections.length;
  if (!tested) return 'suggested';
  // Directly conflicting evidence outranks everything else: nothing is settled
  // while the same characteristic has been rated both ways.
  if (contradictions.length) return 'mixed_evidence';
  if (fit < 45 && confidence >= 50) return 'low_fit';
  if (confidence >= 65 && fit >= 70) return 'strong_evidence';
  if (against.length) return 'mixed_evidence';
  return 'testing';
}

/** The hypothesis view of a path. Pure — safe to call on every render. */
export function deriveHypothesis(path, ctx = {}) {
  const act = activityFor(path, ctx);
  const signals = ctx.signals || characteristicSignals({
    experiments: ctx.experiments || [],
    measurements: ctx.measurements || {},
    reflections: ctx.reflections || [],
  });
  // Conflicting readings on the same characteristic, kept only where the
  // characteristic actually matters here: a contradiction about teamwork should
  // not lower certainty on a career that never asks for it.
  const uncertaintyForRelevance = deriveUncertaintyMap(path, { profile: ctx.profile || {}, act });
  const relevantIds = new Set([
    ...(uncertaintyForRelevance.variables || []).filter(v => v.relevance !== 'low').map(v => v.variable),
    ...act.exps.flatMap(e => [...(e.work_characteristic_ids || []), ...(e.work_characteristics_tested || [])].map(t => String(t).toLowerCase())),
  ]);
  const contradictions = detectContradictions(signals)
    .filter(c => relevantIds.has(c.id) || relevantIds.has(c.label.toLowerCase()));
  const confidence = evidenceConfidence({ path, act, signals, contradictions });
  const against = contradicting(path, act, contradictions);
  // Which work characteristics matter here, and which of them we still cannot
  // answer. The unknowns it surfaces are what "what we still need to learn"
  // asks about; the older generic questions remain the fallback.
  const uncertainty = uncertaintyForRelevance;
  const fromUncertainty = uncertaintyQuestions(uncertainty);

  // Ability and enjoyment are separate evidence dimensions. Overall fit is a
  // weighted blend across several dimensions plus the career's own starting
  // estimate, and each dimension only contributes in proportion to the evidence
  // behind it — so it can never collapse into ability alone.
  const fitDimensions = deriveFitDimensions(path, { ...ctx, signals, uncertainty });
  const blended = blendOverallFit({
    dimensions: fitDimensions.dimensions,
    weights: fitDimensions.weights,
    priorFit: typeof path.career_fit_score === 'number' ? path.career_fit_score : priorFit(path),
  });
  const fit = blended.score;

  return {
    uncertainty,
    contradictions,
    fit: fitDimensions,
    fit_evidence_share: blended.evidence_share,
    career_fit_score: fit,
    ability_fit: fitDimensions.scores.ability_fit,
    enjoyment_fit: fitDimensions.scores.enjoyment_fit,
    work_environment_fit: fitDimensions.scores.work_environment_fit,
    preference_fit: fitDimensions.scores.preference_fit,
    interest_fit: fitDimensions.scores.interest_fit,
    evidence_confidence: fitDimensions.evidence_confidence,
    fit_state: fitDimensions.state,
    fit_confidence_score: confidence,
    why_this_may_fit: path.why_this_may_fit || path.why_it_fits || path.fit_reason || '',
    supporting_evidence: path.supporting_evidence?.length ? path.supporting_evidence : supporting(path, act),
    contradicting_evidence: against,
    unresolved_questions: fromUncertainty.length ? fromUncertainty : unresolved(path, act),
    hypothesis_status: hypothesisStatus(path, { fit, confidence, act, against, contradictions }),
  };
}

/**
 * Backfill the hypothesis fields onto paths that predate them.
 * Only writes the new fields; nothing existing is touched or removed.
 */
export async function backfillHypotheses(paths, ctx) {
  const stale = paths.filter(p => typeof p.career_fit_score !== 'number');
  if (!stale.length) return false;
  await Promise.all(stale.map(p => {
    // `uncertainty`, `fit` and the evidence share are derived on every render
    // and are not stored fields.
    const { uncertainty, fit, fit_evidence_share, contradictions, ...fields } = deriveHypothesis(p, ctx);
    return base44.entities.PathRecommendations
      .update(p.id, { ...fields, last_recalculated_at: new Date().toISOString() })
      .catch(() => null);
  }));
  return true;
}

/**
 * Persist the separate fit dimensions so ability and enjoyment are stored apart
 * from one another and apart from the overall score.
 *
 * Deliberately does NOT touch career_fit_score or hypothesis_status: full
 * hypothesis recalculation is a later phase. This only keeps the dimension
 * fields, the self-versus-observed gap and the four-state label in step with the
 * evidence that already exists.
 */
export async function syncFitDimensions(paths, ctx) {
  const changed = paths.filter(p => {
    const h = deriveHypothesis(p, ctx);
    return ['ability_fit', 'enjoyment_fit', 'work_environment_fit', 'preference_fit', 'interest_fit']
      .some(k => h[k] !== null && p[k] !== h[k]) || p.fit_state !== h.fit_state;
  });
  if (!changed.length) return false;

  await Promise.all(changed.map(p => {
    const h = deriveHypothesis(p, ctx);
    const self = h.fit.self_perception;
    return base44.entities.PathRecommendations.update(p.id, {
      ability_fit: h.ability_fit ?? undefined,
      enjoyment_fit: h.enjoyment_fit ?? undefined,
      work_environment_fit: h.work_environment_fit ?? undefined,
      preference_fit: h.preference_fit ?? undefined,
      interest_fit: h.interest_fit ?? undefined,
      evidence_confidence: h.evidence_confidence,
      fit_state: h.fit_state,
      self_rated_ability: self.self_rated_ability ?? undefined,
      observed_ability: self.observed_ability ?? undefined,
      ability_self_observed_gap: self.discrepancy ?? undefined,
      fit_dimensions_updated_at: new Date().toISOString(),
    }).catch(() => null);
  }));
  return true;
}