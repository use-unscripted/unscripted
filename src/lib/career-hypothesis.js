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
function activityFor(path, { experiments = [], proof = [], reflections = [] }) {
  const exps = experiments.filter(e => e.path_name === path.path_name);
  const expIds = new Set(exps.map(e => e.id));
  return {
    exps,
    completedExps: exps.filter(e => e.status === 'completed'),
    proof: proof.filter(p => p.path_tested === path.path_name || expIds.has(p.experiment_id)),
    reflections: reflections.filter(r => r.path_name === path.path_name || expIds.has(r.experiment_id)),
  };
}

/**
 * Current estimated career fit, 0-100.
 * Readiness (0-10) from onboarding is the starting estimate. Recalibration from
 * experiment outcomes is a later phase, so nothing else moves this yet.
 */
function fitScore(path) {
  if (typeof path.career_fit_score === 'number') return clamp(path.career_fit_score);
  const readiness = typeof path.readiness_score === 'number' ? path.readiness_score : null;
  if (readiness === null) return 60;
  return clamp(readiness * 10);
}

/**
 * Confidence in the fit estimate, 0-100.
 * Onboarding answers alone are a weak basis. Confidence rises only when the
 * student actually produces evidence — never because time has passed.
 */
function confidenceScore(path, act) {
  const base = { low: 20, medium: 30, high: 38 }[path.confidence_level] || 25;
  const earned =
    act.completedExps.length * 12 +
    act.proof.length * 8 +
    act.reflections.length * 6;
  return clamp(Math.min(base + earned, 90));
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
  return items;
}

function contradicting(path) {
  const items = [];
  if (path.why_it_may_not_fit || path.concern) {
    items.push({ text: path.why_it_may_not_fit || path.concern, source: 'Your onboarding answers' });
  }
  if (path.main_tradeoffs) items.push({ text: path.main_tradeoffs, source: 'Tradeoffs on this path' });
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

function hypothesisStatus(path, { fit, confidence, act, against }) {
  if (path.status === 'archived') return 'archived';
  const tested = act.completedExps.length || act.proof.length || act.reflections.length;
  if (!tested) return 'suggested';
  if (fit < 45) return 'low_fit';
  if (confidence >= 65 && fit >= 70) return 'strong_evidence';
  if (against.length) return 'mixed_evidence';
  return 'testing';
}

/** The hypothesis view of a path. Pure — safe to call on every render. */
export function deriveHypothesis(path, ctx = {}) {
  const act = activityFor(path, ctx);
  const fit = fitScore(path);
  const confidence = confidenceScore(path, act);
  const against = path.contradicting_evidence?.length ? path.contradicting_evidence : contradicting(path);
  return {
    career_fit_score: fit,
    fit_confidence_score: confidence,
    why_this_may_fit: path.why_this_may_fit || path.why_it_fits || path.fit_reason || '',
    supporting_evidence: path.supporting_evidence?.length ? path.supporting_evidence : supporting(path, act),
    contradicting_evidence: against,
    unresolved_questions: path.unresolved_questions?.length ? path.unresolved_questions : unresolved(path, act),
    hypothesis_status: hypothesisStatus(path, { fit, confidence, act, against }),
  };
}

/**
 * Backfill the hypothesis fields onto paths that predate them.
 * Only writes the new fields; nothing existing is touched or removed.
 */
export async function backfillHypotheses(paths, ctx) {
  const stale = paths.filter(p => typeof p.career_fit_score !== 'number');
  if (!stale.length) return false;
  await Promise.all(stale.map(p =>
    base44.entities.PathRecommendations
      .update(p.id, { ...deriveHypothesis(p, ctx), last_recalculated_at: new Date().toISOString() })
      .catch(() => null)
  ));
  return true;
}