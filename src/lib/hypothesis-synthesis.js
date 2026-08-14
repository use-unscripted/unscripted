/**
 * The suggested hypothesis update, assembled from evidence that already exists.
 *
 * Every line this module produces traces back to a stored record: a
 * recalculation's before/after scores, the hypothesis's own supporting and
 * contradicting evidence (both derived from measurements, proof and the
 * student's own words), the unresolved questions, and the next-best-test
 * engine. Nothing is generated, guessed or written by a model, which is why
 * there is no LLM call anywhere in this file.
 *
 * The student reviews the result and can drop any line, correct the confidence
 * label, and add a note. Their correction is stored next to the derived
 * version rather than replacing it.
 */
import { HYPOTHESIS_STATUS_LABELS } from '@/lib/career-hypothesis';

export const CONFIDENCE_LABELS = ['Low', 'Moderate', 'High'];

/** Confidence as a word. Deliberately three coarse bands, never a percentage. */
export function confidenceLabel(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'Not yet rated';
  if (score < 35) return 'Low';
  if (score < 65) return 'Moderate';
  return 'High';
}

const statusLabel = (s) => HYPOTHESIS_STATUS_LABELS[s] || 'Untested';
const clean = (rows) => (Array.isArray(rows) ? rows : [])
  .map(r => (typeof r === 'string' ? { text: r, source: 'Your evidence' } : r))
  .filter(r => r && String(r.text || '').trim())
  .map(r => ({ text: String(r.text).trim(), source: r.source || 'Your evidence' }));

/**
 * Build the synthesis.
 *
 * @param change     the recalculation result for this career (before/after/status)
 * @param dimensions the decision dimensions this experiment tested
 * @param nextBest   the next-best-test recommendation, or null
 */
export function buildSynthesis({ change, dimensions = [], nextBest = null } = {}) {
  if (!change?.hypothesis) return null;
  const h = change.hypothesis;

  const unknowns = [
    ...(h.unresolved_questions || []).map(q => (typeof q === 'string' ? q : q?.question)).filter(Boolean),
    ...dimensions
      .filter(d => ['unknown', 'conflicting'].includes(d.current_evidence_level))
      .map(d => (d.current_evidence_level === 'conflicting'
        ? `${d.dimension_label} still points both ways.`
        : `${d.dimension_label} has not been tested yet.`)),
  ];

  return {
    path_id: change.path?.id || null,
    path_name: change.path?.path_name || '',
    before: {
      fit: change.before?.career_fit_score ?? null,
      confidence: change.before?.fit_confidence_score ?? null,
      confidenceLabel: confidenceLabel(change.before?.fit_confidence_score),
      statusLabel: statusLabel(change.statusBefore),
    },
    after: {
      fit: change.after?.career_fit_score ?? null,
      confidence: change.after?.fit_confidence_score ?? null,
      confidenceLabel: confidenceLabel(change.after?.fit_confidence_score),
      statusLabel: statusLabel(change.statusAfter),
    },
    strengthened: clean(h.supporting_evidence).slice(0, 6),
    weakened: clean(h.contradicting_evidence).slice(0, 6),
    unknowns: [...new Set(unknowns)].slice(0, 6),
    next_test: nextBest
      ? {
        question: nextBest.candidate?.question || nextBest.title,
        title: nextBest.title,
        to: nextBest.start_to || nextBest.quick_to || '/experiments/new',
      }
      : null,
    dimensions_tested: dimensions.map(d => d.dimension_label),
    status_before: change.statusBefore,
    status_after: change.statusAfter,
  };
}

/**
 * Apply the student's review to the derived synthesis.
 * Dropped lines are removed, a corrected confidence label wins, and the note is
 * carried through. Nothing new is added to the evidence lists here.
 */
export function applyReview(synthesis, review = {}) {
  if (!synthesis) return null;
  const keep = (rows, dropped = []) => rows.filter((_, i) => !dropped.includes(i));
  const corrected = CONFIDENCE_LABELS.includes(review.confidenceLabel) ? review.confidenceLabel : null;
  return {
    ...synthesis,
    after: { ...synthesis.after, confidenceLabel: corrected || synthesis.after.confidenceLabel },
    confidence_label_source: corrected && corrected !== synthesis.after.confidenceLabel ? 'student_corrected' : 'derived',
    strengthened: keep(synthesis.strengthened, review.droppedStrengthened),
    weakened: keep(synthesis.weakened, review.droppedWeakened),
    unknowns: keep(synthesis.unknowns, review.droppedUnknowns),
    student_correction: String(review.note || '').trim() || null,
  };
}

export default buildSynthesis;