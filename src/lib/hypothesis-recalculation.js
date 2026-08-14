/**
 * Career Hypothesis recalculation.
 *
 * This is the step that turns a reflection from a stored journal entry into
 * evidence: once the experiment is measured, the proof is in and the reflection
 * is written, the affected career hypothesis is recalculated from ALL of the
 * evidence together and the change is recorded with its reasons.
 *
 * What it explicitly does not do:
 *  - It never recalculates from the reflection text alone. The reflection is one
 *    input alongside pre/post measurements, proof, prior evidence and the
 *    existing scores.
 *  - It never treats a fall in fit as a fall in confidence. Fit and confidence
 *    come from different places (see evidence-contradictions.js) so a career can
 *    become less promising and better understood at the same time.
 *  - It never archives a career, and it never deletes prior evidence. A
 *    contradiction is stored next to what it contradicts.
 *  - It never lets one experiment settle a question: every dimension is shrunk
 *    toward neutral by how many observations exist, in career-fit-dimensions.js.
 *
 * The weighting knobs are constants at the top so this stays tunable.
 */
import { base44 } from '@/api/base44Client';
import { deriveHypothesis } from '@/lib/career-hypothesis';
import { characteristicSignals } from '@/lib/evidence-patterns';
import { loadMeasurements } from '@/lib/experiment-measurement';
import { extractReflectionSignals } from '@/lib/reflection-signals';
import { FIT_DIMENSIONS } from '@/lib/career-fit-dimensions';

/** A change smaller than this is noise and is not worth telling the student. */
export const MEANINGFUL_CHANGE = 2;

const active = (rows) => (Array.isArray(rows) ? rows : []).filter(r => r?.deletion_status !== 'deleted' && r?.deletion_status !== 'permanently_deleted');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const SCORE_FIELDS = ['career_fit_score', 'fit_confidence_score', ...FIT_DIMENSIONS.map(d => d.key), 'evidence_confidence'];

/** Everything the recalculation reads. One pass, all of it the student's own. */
export async function loadRecalculationContext() {
  const [exps, refs, prf, profs, paths] = await Promise.all([
    base44.entities.Experiments.list('-created_date', 200).catch(() => []),
    base44.entities.WeeklyReflections.list('-created_date', 200).catch(() => []),
    base44.entities.ProofOfWork.list('-created_date', 200).catch(() => []),
    base44.entities.StudentProfile.list('-created_date', 1).catch(() => []),
    base44.entities.PathRecommendations.list('-created_date', 200).catch(() => []),
  ]);
  const measurements = await loadMeasurements().catch(() => ({}));
  const experiments = active(exps);
  const reflections = active(refs);
  const proof = active(prf);
  return {
    experiments,
    reflections,
    proof,
    measurements,
    profile: (Array.isArray(profs) ? profs[0] : null) || {},
    paths: Array.isArray(paths) ? paths : [],
    signals: characteristicSignals({ experiments, measurements, reflections }),
  };
}

// ── Why it changed ──────────────────────────────────────────────────────────
/**
 * Reasons, built only from evidence that actually exists. Every line names what
 * the student did or said, never "our AI thinks". Ability and enjoyment reasons
 * are worded so they can never be mistaken for one another.
 */
function buildReasons({ experiment, measurement, reflection, proof, dimensionDeltas, contradictions }) {
  const reasons = [];
  const push = (text, source, dimension) => reasons.push({ text, source, dimension });
  const m = measurement || {};

  const observed = [num(m.system_performance_score), num(m.reasoning_quality), num(m.execution_quality)].filter(n => n !== null);
  if (observed.length) {
    const avg = observed.reduce((a, b) => a + b, 0) / observed.length;
    push(
      avg >= 7 ? `You performed strongly on ${experiment?.title || 'this experiment'} when the work was reviewed.`
        : avg <= 4.5 ? `Reviewed performance on ${experiment?.title || 'this experiment'} came out lower than this path asks for.`
        : `Reviewed performance on ${experiment?.title || 'this experiment'} was middling.`,
      'Post-experiment review', 'ability_fit');
  }
  if (num(m.self_rated_performance) !== null && observed.length) {
    const gap = Math.round(observed.reduce((a, b) => a + b, 0) / observed.length - m.self_rated_performance);
    if (Math.abs(gap) >= 2) {
      push(`You rated your own performance ${gap > 0 ? 'lower' : 'higher'} than the review did. The gap is recorded, not interpreted.`, 'Your self-rating', 'ability_fit');
    }
  }
  if (num(m.actual_enjoyment) !== null) {
    push(`You reported ${m.actual_enjoyment >= 7 ? 'high' : m.actual_enjoyment <= 4 ? 'low' : 'moderate'} enjoyment of the work itself.`, 'Post-experiment check-in', 'enjoyment_fit');
  }
  if (num(m.actual_energy) !== null) {
    push(`You felt ${m.actual_energy >= 7 ? 'energised' : m.actual_energy <= 4 ? 'drained' : 'neither energised nor drained'} after completing the task.`, 'Post-experiment check-in', 'enjoyment_fit');
  }
  if (num(m.desire_to_repeat) !== null) {
    push(`You said you ${m.desire_to_repeat >= 7 ? 'would like to do similar work again' : m.desire_to_repeat <= 4 ? 'would rather not repeat similar work' : 'are unsure about repeating similar work'}.`, 'Post-experiment check-in', 'enjoyment_fit');
  }
  if (num(m.frustration_level) !== null && m.frustration_level >= 7) {
    push('You reported high frustration while doing the work.', 'Post-experiment check-in', 'enjoyment_fit');
  }
  if (num(m.enjoyment_expectation_delta) !== null && Math.abs(m.enjoyment_expectation_delta) >= 2) {
    push(`The work was ${m.enjoyment_expectation_delta > 0 ? 'more' : 'less'} enjoyable than you expected beforehand.`, 'Pre versus post expectations', 'enjoyment_fit');
  }
  (experiment?.work_characteristics_tested || []).slice(0, 2).forEach(c => {
    push(`This experiment provided new evidence about ${String(c).toLowerCase()}.`, 'Work characteristics tested', 'work_environment_fit');
  });
  extractReflectionSignals(reflection).slice(0, 3).forEach(x => {
    push(
      x.belief_correction
        ? `Your reflection corrected an expectation about ${x.label.toLowerCase()}: "${x.quote}"`
        : `Your reflection points to ${x.polarity === 'positive' ? 'enjoyment of' : 'lower enjoyment of'} ${x.label.toLowerCase()}: "${x.quote}"`,
      'Your reflection', 'enjoyment_fit');
  });
  if (proof?.length) {
    push(`You produced ${proof.length} deliverable${proof.length === 1 ? '' : 's'} from this experiment.`, 'Proof of work', 'ability_fit');
  }
  contradictions.slice(0, 2).forEach(c => {
    push(c.note, 'Conflicting evidence', null);
  });

  // Dimension movement last, so the causes are read before the effects.
  dimensionDeltas.forEach(d => {
    push(`${d.label} moved from ${d.before}% to ${d.after}%.`, 'Recalculated dimension', d.key);
  });

  return reasons;
}

/**
 * Recalculate one career hypothesis from all current evidence.
 * Pure apart from reading nothing: it takes the loaded context and returns the
 * before, the after, and why. Nothing is written here.
 */
export function recalculateHypothesis(path, ctx, { experiment = null, reflection = null } = {}) {
  const hypothesis = deriveHypothesis(path, ctx);
  const measurement = experiment ? ctx.measurements[experiment.id] || null : null;
  const proof = experiment ? (ctx.proof || []).filter(p => p.experiment_id === experiment.id) : [];

  const before = {};
  const after = {};
  SCORE_FIELDS.forEach(k => {
    before[k] = num(path[k]);
    after[k] = num(hypothesis[k]);
  });

  const dimensionDeltas = FIT_DIMENSIONS
    .map(d => ({ key: d.key, label: d.label, before: before[d.key], after: after[d.key] }))
    .filter(d => d.before !== null && d.after !== null && Math.abs(d.after - d.before) >= MEANINGFUL_CHANGE);

  const statusBefore = path.hypothesis_status || 'suggested';
  const statusAfter = hypothesis.hypothesis_status;
  const deltaFit = before.career_fit_score === null ? null : after.career_fit_score - before.career_fit_score;
  const deltaConfidence = before.fit_confidence_score === null ? null : after.fit_confidence_score - before.fit_confidence_score;

  const meaningful =
    dimensionDeltas.length > 0 ||
    statusBefore !== statusAfter ||
    (deltaFit !== null && Math.abs(deltaFit) >= MEANINGFUL_CHANGE) ||
    (deltaConfidence !== null && Math.abs(deltaConfidence) >= MEANINGFUL_CHANGE);

  return {
    path,
    hypothesis,
    before,
    after,
    dimensionDeltas,
    deltaFit,
    deltaConfidence,
    statusBefore,
    statusAfter,
    contradictions: hypothesis.contradictions || [],
    meaningful,
    reasons: buildReasons({
      experiment, measurement, reflection, proof,
      dimensionDeltas, contradictions: hypothesis.contradictions || [],
    }),
    evidence_counts: hypothesis.fit.observations,
  };
}

/** Persist the recalculated scores, and the record of why they changed. */
async function persist(result, { experiment, reflection, trigger }) {
  const { path, hypothesis, after } = result;
  const now = new Date().toISOString();

  await base44.entities.PathRecommendations.update(path.id, {
    career_fit_score: after.career_fit_score ?? undefined,
    fit_confidence_score: after.fit_confidence_score ?? undefined,
    ability_fit: after.ability_fit ?? undefined,
    enjoyment_fit: after.enjoyment_fit ?? undefined,
    work_environment_fit: after.work_environment_fit ?? undefined,
    preference_fit: after.preference_fit ?? undefined,
    interest_fit: after.interest_fit ?? undefined,
    evidence_confidence: after.evidence_confidence ?? undefined,
    fit_state: hypothesis.fit_state,
    // Both sides are stored. New evidence never overwrites the old record of
    // what pointed the other way.
    supporting_evidence: hypothesis.supporting_evidence,
    contradicting_evidence: hypothesis.contradicting_evidence,
    unresolved_questions: hypothesis.unresolved_questions,
    hypothesis_status: result.statusAfter,
    fit_dimensions_updated_at: now,
    last_recalculated_at: now,
  });

  return base44.entities.HypothesisRecalculation.create({
    path_id: path.id,
    path_name: path.path_name,
    experiment_id: experiment?.id,
    experiment_title: experiment?.title,
    reflection_id: reflection?.id,
    trigger: trigger || 'reflection',
    before: result.before,
    after: result.after,
    delta_fit: result.deltaFit ?? undefined,
    delta_confidence: result.deltaConfidence ?? undefined,
    status_before: result.statusBefore,
    status_after: result.statusAfter,
    reasons: result.reasons,
    contradictions: result.contradictions.map(c => ({ label: c.label, note: c.note })),
    evidence_counts: result.evidence_counts,
    recalculated_at: now,
  }).catch(() => null);
}

/**
 * The step that runs when a reflection is saved.
 *
 * Recalculates the career the experiment was testing, plus any other career
 * whose evidence moved because the new characteristic ratings apply to it too.
 * Returns the change records for the "Why this changed" panel; a career that
 * barely moved is recalculated but not announced.
 */
export async function recalculateAfterReflection({ reflection, experiment }) {
  const ctx = await loadRecalculationContext();
  const exp = experiment || ctx.experiments.find(e => e.id === reflection?.experiment_id) || null;

  const primary = ctx.paths.find(p => p.id === (reflection?.path_id || exp?.path_id))
    || ctx.paths.find(p => p.path_name === (reflection?.path_name || exp?.path_name))
    || null;

  // The career being tested, plus any other career whose own tested
  // characteristics overlap with this experiment's — that is where this evidence
  // legitimately carries over. Unrelated careers are left alone.
  const tested = new Set([...(exp?.work_characteristic_ids || []), ...(exp?.work_characteristics_tested || [])].map(t => String(t).toLowerCase()));
  const sharesCharacteristic = (p) => ctx.experiments.some(e =>
    e.path_name === p.path_name &&
    ctx.measurements[e.id]?.post_completed_at &&
    [...(e.work_characteristic_ids || []), ...(e.work_characteristics_tested || [])].some(t => tested.has(String(t).toLowerCase())));
  const targets = ctx.paths.filter(p => p.status !== 'archived' && (p.id === primary?.id || sharesCharacteristic(p)));
  if (!targets.length) return [];

  const results = [];
  for (const path of targets) {
    const isPrimary = path.id === primary?.id;
    const result = recalculateHypothesis(path, ctx, {
      experiment: isPrimary ? exp : null,
      reflection: isPrimary ? reflection : null,
    });
    await persist(result, { experiment: isPrimary ? exp : null, reflection: isPrimary ? reflection : null, trigger: 'reflection' }).catch(() => null);
    if (result.meaningful) results.push(result);
  }
  // The career the student just tested comes first.
  return results.sort((a, b) => (a.path.id === primary?.id ? -1 : b.path.id === primary?.id ? 1 : 0));
}

/** The most recent recorded change per career, for the profile and path screens. */
export async function loadLatestRecalculations() {
  const rows = await base44.entities.HypothesisRecalculation.list('-created_date', 200).catch(() => []);
  const byPath = {};
  (Array.isArray(rows) ? rows : []).forEach(r => { if (r.path_id && !byPath[r.path_id]) byPath[r.path_id] = r; });
  return byPath;
}

export default recalculateAfterReflection;