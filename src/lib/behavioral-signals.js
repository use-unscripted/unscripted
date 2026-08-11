/**
 * Passive behavioural signals.
 *
 * These are stored in their own entity, never mixed into the self-report fields
 * on ExperimentMeasurement, and every row is stamped
 * evidence_source: passive_behavioral_signal with evidence_weight: supporting.
 * That is the whole point: how long somebody took, or that they started a third
 * finance Moment, is context around the evidence. It is never read as a
 * conclusion about what they enjoy or how able they are, and the engagement
 * number below is internal — it is never shown to a student.
 *
 * Nothing here is collected beyond what the Moment itself already involves:
 * timings of the four stages, whether the answer was changed, how much was
 * written, and whether the student chose to run another one.
 */
import { base44 } from '@/api/base44Client';

/** A tiny recorder the Moment page holds for the life of one Moment. */
export function createTracker({ careerMomentId, careerName } = {}) {
  return {
    careerMomentId,
    careerName,
    shown_at: Date.now(),
    began_at: null,
    decided_at: null,
    revisions: 0,
    changed_answer: false,
    opened_details: false,
    opened_feedback: false,
    completed: false,
  };
}

const secs = (from, to) => (from && to ? Math.round((to - from) / 1000) : undefined);

/**
 * A single 0-100 engagement number, from things the student chose to do:
 * finishing, writing an explanation, opening the feedback, and coming back for
 * another Moment in the same career. Deliberately coarse. It is supporting
 * evidence and is not surfaced in the UI.
 */
export function computeEngagement({ completed, rationaleChars = 0, openedFeedback, voluntaryContinuation, consecutiveSameCareer = 0 }) {
  let score = completed ? 45 : 10;
  if (rationaleChars > 20) score += 15;
  if (rationaleChars > 120) score += 5;
  if (openedFeedback) score += 10;
  if (voluntaryContinuation) score += 15;
  score += Math.min(consecutiveSameCareer, 3) * 5;
  return Math.min(score, 100);
}

/** Past Moments in this career, for continuation and repeat-interaction signals. */
async function careerHistory(careerName) {
  const rows = await base44.entities.CareerMoment.list('-created_date', 40).catch(() => []);
  const list = Array.isArray(rows) ? rows : [];
  const sameCareer = list.filter(r => r.career_name === careerName && r.status === 'completed');
  let consecutive = 0;
  for (const r of list.filter(x => x.status === 'completed')) {
    if (r.career_name === careerName) consecutive += 1; else break;
  }
  return { total: sameCareer.length, consecutive };
}

/** One row per Moment, written after it finishes or when it is abandoned. */
export async function recordMomentSignals({ moment, experiment, tracker, outcome = 'completed', rationale = '' }) {
  const user = await base44.auth.me().catch(() => null);
  const history = await careerHistory(moment.career_name).catch(() => ({ total: 0, consecutive: 0 }));
  const now = Date.now();
  const rationaleChars = (rationale || '').trim().length;
  const voluntary = history.total > 0;

  const payload = {
    user_id: user?.id,
    experiment_id: experiment?.id || undefined,
    career_moment_id: moment.id,
    career_hypothesis_id: moment.career_hypothesis_id || undefined,
    career_name: moment.career_name || undefined,
    tested_variable: moment.unresolved_question_id || undefined,
    tested_characteristics: moment.work_characteristics_tested || [],
    evidence_source: 'passive_behavioral_signal',
    evidence_weight: 'supporting',
    outcome,
    seconds_to_begin: secs(tracker.shown_at, tracker.began_at),
    seconds_to_decide: secs(tracker.began_at, tracker.decided_at),
    seconds_total: secs(tracker.shown_at, now),
    answer_revisions: tracker.revisions,
    changed_answer: tracker.changed_answer,
    opened_details: tracker.opened_details,
    opened_feedback: tracker.opened_feedback,
    rationale_characters: rationaleChars,
    voluntary_continuation: voluntary,
    consecutive_same_career: history.consecutive,
    same_career_moments_total: history.total,
    skipped_similar: outcome === 'abandoned',
    behavioral_engagement_signal: computeEngagement({
      completed: outcome === 'completed',
      rationaleChars,
      openedFeedback: tracker.opened_feedback,
      voluntaryContinuation: voluntary,
      consecutiveSameCareer: history.consecutive,
    }),
    occurred_at: new Date().toISOString(),
  };
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  return base44.entities.BehavioralSignal.create(payload).catch(() => null);
}