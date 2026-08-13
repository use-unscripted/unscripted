/**
 * Where a student is inside a guided experiment, and what still stands between
 * them and the next step.
 *
 * Progress lives on the MissionGuides record the guide already is — no second
 * "step" entity, no duplicate experiment, mission, proof or outreach records.
 * That is what makes a refresh, a logout or a different phone land on the same
 * step: the frontend holds nothing the database does not.
 *
 * Every write here is idempotent. Completing a step twice adds one entry;
 * evidence for a step carries the key `guide-step:<guideId>:<n>` and an existing
 * record with that key is reused rather than duplicated.
 */
import { base44 } from '@/api/base44Client';
import { onceInFlight, linksForExperiment } from '@/lib/career-cycle';
import { categoryForEvidence } from '@/lib/mission-completion';

export const stepEvidenceKey = (guideId, stepNumber) => `guide-step:${guideId}:${stepNumber}`;

const nowIso = () => new Date().toISOString();
const nums = (list) => (Array.isArray(list) ? list : []).filter(n => Number.isFinite(n));

/** The progress model the whole guided flow reads. Pure, so it is safe to call on every render. */
export function readProgress(guide) {
  const steps = Array.isArray(guide?.steps) ? guide.steps : [];
  const total = steps.length;
  const completed = [...new Set(nums(guide?.completed_steps))].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);

  const byStep = {};
  for (const row of Array.isArray(guide?.step_progress) ? guide.step_progress : []) {
    if (row && Number.isFinite(row.step_number)) byStep[row.step_number] = row;
  }

  const firstOpen = steps.findIndex((_, i) => !completed.includes(i + 1));
  const allDone = total > 0 && firstOpen === -1;
  const opened = Number.isFinite(guide?.current_step) ? guide.current_step : null;
  // The exact unfinished step they left, or the earliest one still open.
  const resumeStep = allDone
    ? total
    : opened && opened >= 1 && opened <= total && !completed.includes(opened)
      ? opened
      : firstOpen + 1;

  return {
    steps,
    total,
    completed,
    byStep,
    allDone,
    resumeStep,
    pct: total ? Math.round((completed.length / total) * 100) : 0,
    started: completed.length > 0 || Boolean(guide?.progress_started_at),
    // Highest step they are allowed to jump to: anything reached before, plus
    // the one they are working on. Future steps stay closed.
    maxReachable: Math.max(resumeStep, ...completed, 1),
  };
}

function mergeStepRow(guide, stepNumber, patch) {
  const rows = Array.isArray(guide?.step_progress) ? guide.step_progress : [];
  const existing = rows.find(r => r?.step_number === stepNumber) || { step_number: stepNumber };
  const next = { ...existing, ...patch, step_number: stepNumber };
  return [...rows.filter(r => r?.step_number !== stepNumber), next].sort((a, b) => a.step_number - b.step_number);
}

/** Records that the student is on this step. Never moves progress backwards. */
export function openStep(guide, stepNumber) {
  const patch = {
    current_step: stepNumber,
    last_opened_step: stepNumber,
    progress_started_at: guide.progress_started_at || nowIso(),
    step_progress: mergeStepRow(guide, stepNumber, {
      started_at: guide.step_progress?.find(r => r?.step_number === stepNumber)?.started_at || nowIso(),
    }),
  };
  return persist(guide, patch, `guide-open:${guide.id}:${stepNumber}`);
}

/** Marks a step done. Repeated calls change nothing after the first. */
export function completeStep(guide, stepNumber) {
  const total = Array.isArray(guide.steps) ? guide.steps.length : 0;
  const completed = [...new Set([...nums(guide.completed_steps), stepNumber])].filter(n => n >= 1 && n <= total);
  const patch = {
    completed_steps: completed.sort((a, b) => a - b),
    progress_percentage: total ? Math.round((completed.length / total) * 100) : 0,
    step_progress: mergeStepRow(guide, stepNumber, {
      completed_at: guide.step_progress?.find(r => r?.step_number === stepNumber)?.completed_at || nowIso(),
    }),
  };
  if (completed.length === total && total > 0 && !guide.progress_completed_at) {
    patch.progress_completed_at = nowIso();
  }
  return persist(guide, patch, `guide-complete:${guide.id}:${stepNumber}`);
}

/** The student's own working notes for a step. Kept when they move backwards. */
export function saveStepNote(guide, stepNumber, note) {
  return persist(
    guide,
    { step_progress: mergeStepRow(guide, stepNumber, { note }) },
    `guide-note:${guide.id}:${stepNumber}:${note.length}`,
  );
}

async function persist(guide, patch, key) {
  const saved = await onceInFlight(key, () => base44.entities.MissionGuides.update(guide.id, patch));
  return { ...guide, ...patch, ...(saved || {}) };
}

/**
 * Evidence for one step, filed against the same cycle → path → experiment →
 * mission chain everything else uses, so the student never maps it by hand.
 */
export function saveStepEvidence({ guide, stepNumber, step, experiment, mission, path, evidence, keySuffix }) {
  // A suffix is how the last step can file a second, additional piece of
  // evidence without overwriting the step's own record.
  const key = stepEvidenceKey(guide.id, stepNumber) + (keySuffix ? `:${keySuffix}` : '');
  return onceInFlight(`guide-evidence:${key}`, async () => {
    const links = await linksForExperiment(experiment, mission);
    const payload = {
      ...links,
      path_id: links.path_id || path?.id,
      submission_key: key,
      title: evidence.title || step?.title || `Step ${stepNumber}`,
      category: categoryForEvidence(evidence.type),
      path_tested: experiment?.path_name || path?.path_name,
      description: evidence.description || undefined,
      completion_note: evidence.description || undefined,
      external_url: evidence.external_url || undefined,
      file_url: evidence.file?.file_url,
      file_name: evidence.file?.file_name,
      file_size: evidence.file?.file_size,
      mime_type: evidence.file?.mime_type,
      completed_at: new Date().toISOString().split('T')[0],
    };
    const rows = await base44.entities.ProofOfWork.filter({ submission_key: key }, '-created_date', 5).catch(() => []);
    const found = (Array.isArray(rows) ? rows : []).find(r => r.deletion_status !== 'deleted');
    if (found) return base44.entities.ProofOfWork.update(found.id, payload);
    return base44.entities.ProofOfWork.create(payload);
  });
}

const OUTREACH_RE = /\b(email|message|reach out|contact|speak|talk|interview|conversation|call|follow[- ]up)\b/i;

/** Does this step involve talking to a professional? */
export function isOutreachStep(step) {
  if (!step) return false;
  if (['email', 'message'].includes(step.artifact?.kind)) return true;
  return OUTREACH_RE.test(`${step.title || ''} ${step.description || ''}`);
}

/** True when the step asks the student to keep something as proof. */
export function needsEvidence(step) {
  return Boolean(step?.proof_capture && String(step.proof_capture).trim());
}

/**
 * What still stands between this step and the next, in plain language. An empty
 * list means the student can continue.
 */
export function stepBlockers(step, { note, evidence, contacts }) {
  const out = [];
  if (needsEvidence(step) && !evidence && !String(note || '').trim()) {
    out.push('Upload or describe what you completed before moving to the next step.');
  }
  if (isOutreachStep(step) && (contacts || []).length === 0) {
    out.push('Add the person (or the role) you contacted before continuing.');
  }
  return out;
}

/** Minutes actually spent, from the step timestamps we recorded. Null when unknown. */
export function minutesSpent(guide) {
  const rows = Array.isArray(guide?.step_progress) ? guide.step_progress : [];
  let total = 0;
  for (const r of rows) {
    if (!r?.started_at || !r?.completed_at) continue;
    const diff = new Date(r.completed_at) - new Date(r.started_at);
    if (Number.isFinite(diff) && diff > 0) total += diff / 60000;
  }
  return total >= 1 ? Math.round(total) : null;
}