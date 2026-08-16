/**
 * Human Reality and Outreach, as funnel events.
 *
 * Same rule as the decision funnel: ids, counts and fixed-choice values only,
 * never a word a student typed, and never a contact's name or address. Internal
 * and test accounts are separated downstream by the account classification the
 * funnel already applies, so nothing here needs to know who is real.
 */
import { trackPilotEvent } from '@/lib/pilot-metrics';

const emit = (name, { pathId, cycleId, experimentId, stage, value } = {}, keyExtra = '') =>
  trackPilotEvent(name, {
    path_id: pathId || undefined,
    cycle_id: cycleId || undefined,
    experiment_id: experimentId || undefined,
    stage: stage || undefined,
    value: typeof value === 'number' ? value : undefined,
    dedupe_key: `${pathId || 'account'}:${stage || name}${keyExtra ? `:${keyExtra}` : ''}`,
  });

/** A conversation was put forward as the best next test. */
export const humanRealityRecommended = (p) => emit('human_reality_recommended', p);

/** The student opened the outreach step for this unknown. */
export const outreachStarted = (p) => emit('outreach_started', p);

/** A message was prepared for them. */
export const outreachDrafted = (p) => emit('outreach_drafted', p);

/** A contact record was created. Never carries who it is. */
export const contactLogged = (p) => emit('contact_logged', p);

export const professionalContacted = (p) => emit('professional_contacted', p);
export const responseReceived = (p) => emit('response_received', p);
export const conversationScheduled = (p) => emit('conversation_scheduled', p);

/** The human evidence form was opened, and then submitted. */
export const humanEvidenceStarted = (p) => emit('human_evidence_started', p);
export const humanEvidenceSubmitted = (p) => emit('human_evidence_submitted', p);

/** Reflection read the conversation, and the matrix took it as a source. */
export const humanEvidenceReflected = (p) => emit('human_evidence_reflected', p);
export const humanEvidenceMatrixUpdated = (p) => emit('human_evidence_matrix_updated', p);