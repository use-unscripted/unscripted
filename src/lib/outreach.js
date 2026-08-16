/**
 * Outreach: the step between "a person could answer this" and "here is what I
 * learned". Not a CRM.
 *
 * A contact is never evidence. It is the address of somebody who might answer
 * one open question on one Path. The evidence is the conversation record, and
 * the contact exists only to carry the Path, the unknown and the dimensions
 * forward so the student never has to reconnect them by hand.
 *
 * Reuses the legacy OutreachContacts entity rather than inventing a second
 * contact system: its name, role, company, profile_url, suggested_message and
 * questions_to_ask fields are the same fields this flow needs, and historical
 * records keep reading.
 */
import { base44 } from '@/api/base44Client';
import { TOPICS_BY_ID } from '@/lib/human-reality';

export const OUTREACH_STATUSES = [
  { id: 'identified', label: 'Identified', note: 'You know who could answer this.' },
  { id: 'outreach_drafted', label: 'Outreach drafted', note: 'A message is ready to send.' },
  { id: 'contacted', label: 'Contacted', note: 'You have reached out.' },
  { id: 'responded', label: 'Responded', note: 'They replied.' },
  { id: 'conversation_scheduled', label: 'Conversation scheduled', note: 'A time is set.' },
  { id: 'conversation_completed', label: 'Conversation completed', note: 'Ready to turn into evidence.' },
  { id: 'no_response', label: 'No response', note: 'It happens more often than not.' },
  { id: 'archived', label: 'Archived', note: 'Set aside.' },
];

export const STATUS_LABELS = new Map(OUTREACH_STATUSES.map(s => [s.id, s.label]));

/** The forward path a student clicks through. */
export const NEXT_STATUS = {
  identified: 'contacted',
  outreach_drafted: 'contacted',
  contacted: 'responded',
  responded: 'conversation_scheduled',
  conversation_scheduled: 'conversation_completed',
};

export const HOW_KNOWN = [
  { id: 'own_connection', label: 'Someone I already know' },
  { id: 'alumni', label: 'An alumnus from my university' },
  { id: 'mentor', label: 'A mentor' },
  { id: 'professor', label: 'A professor with industry experience' },
  { id: 'university_professional', label: 'A university careers professional' },
  { id: 'unscripted_professional', label: 'A professional supplied by Unscripted' },
  { id: 'event_or_panel', label: 'Someone I met at an event or panel' },
  { id: 'cold_outreach', label: 'Someone I found and reached out to' },
  { id: 'other', label: 'Someone else' },
];

export const HOW_KNOWN_LABELS = new Map(HOW_KNOWN.map(h => [h.id, h.label]));

/** How the student and the professional actually interacted. */
export const INTERACTION_TYPES = [
  { id: 'direct_conversation', label: 'A direct conversation', level: 'direct_conversation' },
  { id: 'informational_interview', label: 'An informational interview', level: 'direct_conversation' },
  { id: 'alumni_meeting', label: 'An alumni meeting', level: 'direct_conversation' },
  { id: 'mentor_conversation', label: 'A conversation with a mentor', level: 'direct_conversation' },
  { id: 'advisor_conversation', label: 'A conversation with an advisor', level: 'direct_conversation' },
  { id: 'professional_event', label: 'An interaction at a professional event', level: 'human_exposure' },
  { id: 'panel_or_presentation', label: 'A panel, presentation or office visit', level: 'human_exposure' },
  { id: 'verified_perspective', label: 'A verified professional perspective I read or watched', level: 'verified_perspective' },
  { id: 'other', label: 'Another kind of human interaction', level: 'direct_conversation' },
];

export const INTERACTION_LABELS = new Map(INTERACTION_TYPES.map(i => [i.id, i.label]));

/** Which of the three Human Reality levels an interaction sits at. */
export function exposureLevelFor(interactionType) {
  return INTERACTION_TYPES.find(i => i.id === interactionType)?.level || 'direct_conversation';
}

export const OUTREACH_FORMATS = [
  { id: 'linkedin', label: 'LinkedIn message', limit: 'Keep it under about 900 characters.' },
  { id: 'email', label: 'Email', limit: 'Short enough to read on a phone.' },
  { id: 'alumni_network', label: 'Alumni-network message', limit: 'Lead with the shared university.' },
];

/**
 * The message, written from what we already know: this student, this Path, this
 * unknown, this person's role, and why they in particular were asked.
 *
 * Deliberately templated rather than generated. The failure mode of a generated
 * note is "Can I pick your brain?", and a student sending a stranger something
 * vague on our advice is worse than sending nothing.
 */
export function draftOutreach({ format = 'linkedin', contact = {}, pathName = '', topicId = '', question = '', studentName = '', university = '' } = {}) {
  const topic = TOPICS_BY_ID.get(topicId);
  const role = (contact.role || 'your role').trim();
  const org = (contact.company || '').trim();
  const field = pathName || 'this field';
  const learning = (question || topic?.label || 'what this work is actually like').replace(/\?$/, '');
  const because = org
    ? `your experience as ${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role} at ${org}`
    : `your experience as ${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role}`;
  const focus = topic ? topic.label.toLowerCase() : 'the day-to-day reality of the work';
  const asks = suggestedQuestions({ topicId }).slice(0, 2);
  const sign = studentName ? `\n\nThank you,\n${studentName}` : '';
  const whoAmI = university ? `I am a student at ${university}` : 'I am a student';

  const body = [
    `I am currently testing whether ${field.toLowerCase()} is work I would genuinely enjoy, and ${because} seemed particularly relevant.`,
    `The part I cannot work out on my own is ${focus}. ${topic ? topic.cannot_simulate.replace(/^We cannot/, 'No exercise I can set myself can') : 'Reading about it only goes so far.'}`,
    asks.length ? `If you had ten minutes, I would mostly want to ask: ${asks.map(q => `"${q}"`).join(' and ')}` : '',
    'No obligation at all if the timing is wrong, and I am happy to work around your schedule.',
  ].filter(Boolean);

  if (format === 'email') {
    return {
      subject: `Ten minutes on the reality of ${field.toLowerCase()}?`,
      body: `Hello${contact.name ? ` ${contact.name.split(' ')[0]}` : ''},\n\n${whoAmI} trying to understand ${learning.toLowerCase()} before committing to it. ${body.join('\n\n')}${sign}`,
    };
  }
  if (format === 'alumni_network') {
    return {
      subject: `A ${university || 'fellow'} student testing ${field.toLowerCase()}`,
      body: `Hello${contact.name ? ` ${contact.name.split(' ')[0]}` : ''},\n\nI found you through the${university ? ` ${university}` : ''} alumni network. ${body.join('\n\n')}${sign}`,
    };
  }
  return {
    subject: '',
    body: `Hello${contact.name ? ` ${contact.name.split(' ')[0]}` : ''},\n\n${body.slice(0, 3).join('\n\n')}${sign}`,
  };
}

/**
 * What to ask. Tied to the unknown, and deliberately nothing a search engine
 * answers: every question here asks for lived experience.
 */
export function suggestedQuestions({ topicId } = {}) {
  const topic = TOPICS_BY_ID.get(topicId);
  return topic ? topic.questions.slice(0, 4) : [];
}

/* ── Records ──────────────────────────────────────────────────────────────── */

const live = (r) => r && r.deletion_status !== 'deleted' && r.deletion_status !== 'permanently_deleted';

/** This student's contacts, newest first. Owner-scoped by RLS. */
export async function loadContacts() {
  const rows = await base44.entities.OutreachContacts.list('-updated_date', 200).catch(() => []);
  return (Array.isArray(rows) ? rows : []).filter(live);
}

const fire = (name, props) => import('@/lib/analytics/human-reality-events')
  .then(m => m[name]?.(props))
  .catch(() => {});

/**
 * Save a contact against the Path and unknown that produced it. Passing an
 * existing id updates that record instead of creating a second one, which is
 * what makes the same professional reusable for a later, different question.
 */
export async function saveContact(fields, { id } = {}) {
  const payload = { ...fields, outreach_status: fields.outreach_status || 'identified' };
  if (id) {
    const updated = await base44.entities.OutreachContacts.update(id, payload);
    return updated;
  }
  const created = await base44.entities.OutreachContacts.create(payload);
  fire('contactLogged', { pathId: fields.path_id, stage: fields.topic_id });
  return created;
}

/** Move a contact along the outreach path, keeping the legacy status in step. */
export async function setOutreachStatus(contact, status) {
  const legacy = {
    contacted: 'sent',
    responded: 'responded',
    conversation_scheduled: 'call_scheduled',
    conversation_completed: 'completed',
    no_response: 'no_response',
    archived: 'closed',
  }[status];
  const patch = { outreach_status: status };
  if (legacy) patch.response_status = legacy;
  if (status === 'contacted') patch.date_contacted = patch.last_contacted_date = new Date().toISOString().slice(0, 10);
  if (status === 'conversation_scheduled') patch.call_scheduled = true;

  const updated = await base44.entities.OutreachContacts.update(contact.id, patch);
  const props = { pathId: contact.path_id, stage: contact.topic_id };
  if (status === 'contacted') fire('professionalContacted', props);
  if (status === 'responded') fire('responseReceived', props);
  if (status === 'conversation_scheduled') fire('conversationScheduled', props);
  return updated;
}

export default OUTREACH_STATUSES;