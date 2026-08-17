/**
 * Reviewed performance: the system's own read of what the student actually
 * produced, scored against the criteria the experiment was designed with.
 *
 * This is the half of the ability evidence that was missing. Without it, ability
 * came only from "you finished it" and "you attached something", so a student who
 * produced strong work and one who is still developing looked identical, and the
 * ability-versus-enjoyment split had nothing solid on the ability side.
 *
 * Three rules it will not break:
 *  - It never scores an experiment with no deliverable. No work, no score, and
 *    nothing invented to fill the gap.
 *  - It never touches the student's own self-rating. Both are stored, and the
 *    distance between them stays visible.
 *  - It never mentions the career or whether it fits. It judges the work only;
 *    fit is calculated elsewhere from all the evidence together.
 */
import { base44 } from '@/api/base44Client';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';

const RUBRIC_SCHEMA = {
  type: 'object',
  properties: {
    reasoning_quality: { type: 'number' },
    execution_quality: { type: 'number' },
    overall_score: { type: 'number' },
    summary: { type: 'string' },
    rubric_results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          criterion: { type: 'string' },
          score: { type: 'number' },
          note: { type: 'string' },
        },
      },
    },
    demonstrated_strengths: { type: 'array', items: { type: 'string' } },
    improvement_areas: { type: 'array', items: { type: 'string' } },
  },
  required: ['reasoning_quality', 'execution_quality', 'overall_score', 'summary'],
};

const clamp10 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(1, Math.round(n * 10) / 10));
};

/** What the student actually handed in, as text the reviewer can read. */
function describeWork(proof) {
  return proof.map((p, i) => [
    `Deliverable ${i + 1}: ${p.title || 'Untitled'}`,
    p.category && `Type: ${p.category}`,
    p.description && `Description: ${p.description}`,
    p.completion_note && `Completion note: ${p.completion_note}`,
    p.outcome && `Outcome: ${p.outcome}`,
    p.feedback && `Feedback received: ${p.feedback}`,
    p.skills_demonstrated?.length && `Skills claimed: ${p.skills_demonstrated.join(', ')}`,
    p.external_url && `Link provided: yes`,
    p.file_url && `File attached: ${p.file_name || 'yes'}`,
  ].filter(Boolean).join('\n'));
}

/** Enough substance to review? A bare title is not work. */
const hasSubstance = (proof) => proof.some(p =>
  (p.description || '').trim().length >= 40 ||
  (p.completion_note || '').trim().length >= 40 ||
  (p.outcome || '').trim().length >= 40 ||
  p.file_url || p.external_url);

/**
 * Review the work produced for one experiment and record the result on its
 * measurement row. Returns the fields written, or null when there is nothing
 * reviewable — the caller treats null as "no evidence", never as a failure.
 */
export async function evaluateExperimentWork(exp, measurementRow) {
  if (!exp?.id || !measurementRow?.id) return null;
  if (measurementRow.system_evaluated_at) return null;

  const rows = await base44.entities.ProofOfWork
    .filter({ experiment_id: exp.id }, '-created_date', 20).catch(() => []);
  const proof = (Array.isArray(rows) ? rows : [])
    .filter(p => p.deletion_status !== 'deleted' && p.deletion_status !== 'permanently_deleted');
  if (!proof.length || !hasSubstance(proof)) return null;

  const criteria = (exp.evaluation_criteria || []).filter(Boolean);
  const fileUrls = proof.map(p => p.file_url).filter(Boolean).slice(0, 3);

  const prompt = [
    'You are reviewing work a university student produced during a short career experiment.',
    'Judge only the quality of the work in front of you. Do not comment on whether the career suits them, do not predict their future, and do not encourage or discourage the career.',
    '',
    `Experiment: ${exp.title || 'Untitled'}`,
    exp.objective && `Objective: ${exp.objective}`,
    exp.realistic_scenario && `Scenario the student was asked to work through: ${exp.realistic_scenario}`,
    exp.deliverable && `Expected deliverable: ${exp.deliverable}`,
    exp.difficulty_level && `Intended difficulty: ${exp.difficulty_level}`,
    criteria.length
      ? `Score against these criteria, one entry each, using the criterion text verbatim:\n- ${criteria.join('\n- ')}`
      : 'No explicit criteria were recorded. Score against the objective and the expected deliverable instead.',
    '',
    'What the student submitted:',
    describeWork(proof),
    '',
    'Score reasoning_quality (the thinking, judgement and analysis shown), execution_quality (how completely and carefully it was carried out) and overall_score, each 1 to 10, where 5 to 6 is what a capable beginner produces at this difficulty. Be accurate rather than kind: a thin submission should score low and strong work should score high.',
    'Where the submission is only described rather than attached, judge the described work and say in the summary that you were working from a description.',
    'summary: two sentences, plain, addressed to the student, about the work only.',
    'demonstrated_strengths and improvement_areas: up to three short specific phrases each, about skills shown in this work.',
    PLAIN_PROSE_RULES,
  ].filter(Boolean).join('\n');

  // Judges the student's work, reads whatever they attached, and writes the
  // summary printed back to them on the measurement card while they wait.
  // Same job as the simulation review, so the same tier. Verified 2026-08-17
  // against the live model: pinned gemini_3_1_pro does read attached files, so
  // don't revert the pin out of caution about that.
  // The trade is speed. Unpinned, this ran on the app default, a lightweight
  // tier that is faster than gemini_3_flash, and the student is held on a
  // blocking spinner the whole time. Taken anyway because a wrong score costs
  // more here than a slow one. See src/lib/llm.js.
  const res = unwrapLLM(await base44.integrations.Core.InvokeLLM({
    prompt,
    model: 'gemini_3_1_pro',
    response_json_schema: RUBRIC_SCHEMA,
    ...(fileUrls.length ? { file_urls: fileUrls } : {}),
  }));

  const overall = clamp10(res?.overall_score);
  const reasoning = clamp10(res?.reasoning_quality);
  const execution = clamp10(res?.execution_quality);
  if (overall === null && reasoning === null && execution === null) return null;

  const payload = {
    system_performance_score: overall ?? undefined,
    reasoning_quality: reasoning ?? undefined,
    execution_quality: execution ?? undefined,
    system_evaluation_summary: (res?.summary || '').trim() || undefined,
    system_rubric_results: Array.isArray(res?.rubric_results)
      ? res.rubric_results
          .filter(r => r?.criterion)
          .slice(0, 8)
          .map(r => ({ criterion: String(r.criterion), score: clamp10(r.score) ?? undefined, note: r.note ? String(r.note) : undefined }))
      : undefined,
    demonstrated_strengths: Array.isArray(res?.demonstrated_strengths) ? res.demonstrated_strengths.filter(Boolean).slice(0, 3).map(String) : undefined,
    improvement_areas: Array.isArray(res?.improvement_areas) ? res.improvement_areas.filter(Boolean).slice(0, 3).map(String) : undefined,
    system_evaluated_at: new Date().toISOString(),
  };
  Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

  await base44.entities.ExperimentMeasurement.update(measurementRow.id, payload);
  return payload;
}

export default evaluateExperimentWork;