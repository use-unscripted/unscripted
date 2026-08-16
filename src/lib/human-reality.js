/**
 * Human Reality: an EXPERIMENT TYPE, not a network.
 *
 * It exists for one situation only — an uncertainty that matters to a Path and
 * that simulated work cannot honestly answer. You can simulate a valuation, a
 * brief or a client email. You cannot simulate what six straight weeks of
 * deadlines does to a person, what the hierarchy is actually like, or what
 * happens when a real client is unhappy. Those are the questions a person who
 * does the job already can answer and a task cannot.
 *
 * Rules held here:
 *  - A conversation is evidence about EXPECTATIONS, never a performance reading.
 *    It updates human exposure, the uncertainty it was aimed at, and the Path's
 *    recorded insight. It never overrides behavioural evidence.
 *  - No social network is required. A student's own contact, an alumnus, a
 *    mentor, a university careers professional, or somebody Unscripted supplies
 *    are all the same weight of evidence.
 *  - The student is never told to "talk to an investment banker". They are told
 *    what we cannot simulate, and given the questions worth asking.
 */
import { base44 } from '@/api/base44Client';

/**
 * The uncertainties that cannot realistically be simulated, each with the
 * questions worth asking. `variables` are the uncertainty-model ids the
 * recommendation engine works in; `dimensions` are the Career Decision Matrix
 * dimensions a conversation informs.
 */
export const HUMAN_REALITY_TOPICS = [
  {
    id: 'lifestyle_hours',
    label: 'Lifestyle and working hours',
    variables: ['pace'],
    dimensions: ['high_pressure_pace'],
    cannot_simulate: 'We cannot fully simulate the lifestyle and deadline pressure of this Path.',
    questions: [
      'How often do deadlines significantly change your schedule?',
      'What does a genuinely difficult week look like?',
      'Which part of the workload is hardest to understand before entering the field?',
      'What kind of person tends to tolerate this environment well?',
    ],
  },
  {
    id: 'hierarchy',
    label: 'Hierarchy and how work is reviewed',
    variables: ['structure', 'leadership'],
    dimensions: ['structured_environments', 'leadership'],
    cannot_simulate: 'We cannot simulate what it is like to work inside this field\u2019s hierarchy, or how your work gets reviewed.',
    questions: [
      'Who decides what you work on in a normal week?',
      'How is your work reviewed, and how direct is the feedback?',
      'How much say does someone at entry level actually have?',
    ],
  },
  {
    id: 'client_dynamics',
    label: 'Client and stakeholder dynamics',
    variables: ['interpersonal', 'stakeholder_conflict'],
    dimensions: ['client_interaction', 'persuasion'],
    cannot_simulate: 'We cannot simulate a real client relationship, or what happens when one goes badly.',
    questions: [
      'What does a difficult client relationship actually look like day to day?',
      'How much of your week is spent managing people rather than doing the work?',
      'What happens when a client is unhappy with something you produced?',
    ],
  },
  {
    id: 'workplace_culture',
    label: 'Workplace culture',
    variables: ['teamwork'],
    dimensions: ['teamwork', 'competition'],
    cannot_simulate: 'We cannot simulate the culture of a real team, or how competitive it is between colleagues.',
    questions: [
      'What kind of person tends to do well here, and what kind struggles?',
      'How competitive is it between people at the same level?',
      'What would you warn someone about before they joined?',
    ],
  },
  {
    id: 'career_progression',
    label: 'Career progression',
    variables: [],
    dimensions: ['long_project_cycles'],
    cannot_simulate: 'We cannot simulate what the next five years of this Path look like, or what the exits from it are.',
    questions: [
      'What does the path from your first year to your third actually look like?',
      'What do people who leave this field go on to do?',
      'What do you know now about progression that you did not believe at the start?',
    ],
  },
  {
    id: 'real_stakes',
    label: 'Real consequences and stakes',
    variables: ['risk_tolerance', 'decision_making'],
    dimensions: ['risk_tolerance'],
    cannot_simulate: 'We cannot simulate real consequences. Nothing you do in an experiment costs anybody money or trust.',
    questions: [
      'What happens when a real mistake is made, and who carries it?',
      'What is the most consequential decision someone junior is trusted with?',
      'How does carrying that responsibility feel after a few years?',
    ],
  },
];

export const TOPICS_BY_ID = new Map(HUMAN_REALITY_TOPICS.map(t => [t.id, t]));

/** Where a human perspective can come from. No large network required. */
export const HUMAN_REALITY_SOURCES = [
  { id: 'own_connection', label: 'Someone you already know', note: 'A family friend, a former manager, anyone already one step from you.' },
  { id: 'alumni', label: 'An alumnus from your university', note: 'Usually the highest response rate available to a student.' },
  { id: 'mentor', label: 'A mentor', note: 'Someone already invested in your decisions.' },
  { id: 'university_professional', label: 'A university careers professional', note: 'They speak to people in this field constantly.' },
  { id: 'unscripted_professional', label: 'A professional supplied by Unscripted', note: 'When one is available for this Path.' },
  { id: 'other', label: 'Someone else', note: 'Anybody who does this work now, or did recently.' },
];

export const SOURCE_LABELS = new Map(HUMAN_REALITY_SOURCES.map(s => [s.id, s.label]));

/**
 * How far one person's account can be taken. Asked of the student rather than
 * assumed, because one professional is never the whole career.
 */
export const REPRESENTATIVENESS_OPTIONS = [
  { id: 'one_persons_perspective', label: "One person's perspective" },
  { id: 'likely_relevant', label: 'Likely relevant' },
  { id: 'strongly_relevant', label: 'Strongly relevant to this specific question' },
  { id: 'not_sure', label: 'Not sure' },
];

export const REPRESENTATIVENESS_LABELS = new Map(REPRESENTATIVENESS_OPTIONS.map(o => [o.id, o.label]));

export const CHANGED_EXPECTATION_OPTIONS = [
  { id: 'confirmed_what_i_expected', label: 'It confirmed what I expected' },
  { id: 'changed_what_i_expected', label: 'It changed what I expected' },
  { id: 'raised_a_new_concern', label: 'It raised a new concern' },
  { id: 'not_enough_information', label: 'Not enough information either way' },
];

/** The topic an uncertainty belongs to, or null when simulated work can test it. */
export function topicForVariable(variable) {
  if (!variable) return null;
  return HUMAN_REALITY_TOPICS.find(t => t.variables.includes(variable)) || null;
}

/**
 * Whether this open question is better answered by a person than by a task.
 * Returns the brief the screens render, or null.
 */
export function humanRealityFor(candidate) {
  const topic = topicForVariable(candidate?.variable);
  if (!topic) return null;
  return {
    topic_id: topic.id,
    topic_label: topic.label,
    cannot_simulate: topic.cannot_simulate,
    questions: topic.questions,
    dimensions: topic.dimensions,
    learning: candidate?.question || `What ${topic.label.toLowerCase()} is actually like in this career.`,
  };
}

/** Every conversation this student has recorded, newest first. */
export async function loadConversations() {
  const rows = await base44.entities.HumanRealityConversation.list('-recorded_at', 200).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

const held = (c) => ['conversation_held', 'human_evidence_recorded'].includes(c.evidence_status);

/**
 * Human exposure: how much of what this student believes about their Paths has
 * been checked against somebody who actually does the work. Counted separately
 * from behavioural evidence on purpose.
 */
export function humanExposure(conversations = []) {
  const done = conversations.filter(held);
  const paths = new Set(done.map(c => c.path_id).filter(Boolean));
  const topics = new Set(done.map(c => c.topic_id).filter(Boolean));
  const changed = done.filter(c => c.changed_expectation === 'changed_what_i_expected' || c.changed_expectation === 'raised_a_new_concern');
  return {
    conversations: done.length,
    paths: paths.size,
    topics: topics.size,
    changed_expectations: changed.length,
    level: done.length === 0 ? 'none' : done.length === 1 ? 'initial' : done.length < 4 ? 'some' : 'broad',
    /* Named the way the matrix says it out loud. Deliberately a description of
       exposure, never of fit: four conversations and no completed work is broad
       exposure and no behavioural evidence at all. */
    band: done.length === 0 ? 'None yet' : done.length === 1 ? 'Developing' : done.length < 4 ? 'Developing' : 'Established',
    label: done.length === 0 ? 'No human perspective yet'
      : done.length === 1 ? 'One conversation'
      : `${done.length} conversations`,
  };
}

/**
 * Human evidence per matrix dimension. Deliberately its own reading, with its
 * own words: "Human perspective" is never merged into a behavioural level.
 */
export function humanEvidenceByDimension(conversations = []) {
  const out = new Map();
  conversations.filter(held).forEach(c => {
    (c.decision_dimension_ids || []).forEach(dim => {
      const row = out.get(dim) || { dimension: dim, count: 0, learnings: [], changed: 0 };
      row.count += 1;
      if (c.key_learning) {
        row.learnings.push({
          text: c.key_learning,
          source: c.professional_role ? `${c.professional_role}${c.professional_organisation ? `, ${c.professional_organisation}` : ''}` : SOURCE_LABELS.get(c.source_type) || 'A professional',
          occurred_at: c.conversation_date || c.recorded_at,
          path_name: c.path_name || null,
        });
      }
      if (c.changed_expectation === 'changed_what_i_expected' || c.changed_expectation === 'raised_a_new_concern') row.changed += 1;
      out.set(dim, row);
    });
  });
  [...out.values()].forEach(row => {
    row.label = row.count === 1 ? 'Human Perspective' : `Human Perspective \u00d7 ${row.count}`;
    row.statement = row.count === 1
      ? 'One person who does this work has described what this is actually like. That is context about the field, not a reading of how you work.'
      : `${row.count} people who do this work have described what this is actually like. That is context about the field, not a reading of how you work.`;
  });
  return out;
}

/**
 * Record the conversation.
 *
 * Writes the human evidence, then appends the learning to the Path as an
 * insight. It deliberately does not touch fit scores, confidence or any
 * behavioural reading: a conversation changes what the student EXPECTS, and
 * only their own work changes what we have observed.
 */
export async function saveConversation(payload, { path, contact } = {}) {
  const record = await base44.entities.HumanRealityConversation.create({
    ...payload,
    evidence_status: 'human_evidence_recorded',
    recorded_at: new Date().toISOString(),
  });

  /* The contact is the source, not the evidence. It only records that this
     conversation happened, so the same person can be asked something else
     later without a second contact record being created. */
  if (contact?.id) {
    await base44.entities.OutreachContacts.update(contact.id, {
      outreach_status: 'conversation_completed',
      response_status: 'completed',
    }).catch(() => {});
  }

  import('@/lib/analytics/human-reality-events')
    .then(m => m.humanEvidenceSubmitted?.({ pathId: payload.path_id, cycleId: payload.cycle_id, stage: payload.topic_id }))
    .catch(() => {});

  if (path?.id && payload.key_learning) {
    const insights = [...(path.human_reality_insights || []), {
      insight: payload.key_learning,
      source: payload.professional_role
        ? `${payload.professional_role} (${SOURCE_LABELS.get(payload.source_type) || 'professional'})`
        : SOURCE_LABELS.get(payload.source_type) || 'A professional',
    }].slice(-12);
    await base44.entities.PathRecommendations.update(path.id, { human_reality_insights: insights }).catch(() => {});
  }

  import('@/lib/analytics/decision-funnel-events')
    .then(m => m.professionalConversationCompleted?.({ pathId: payload.path_id, cycleId: payload.cycle_id }))
    .catch(() => {});

  return record;
}

export default HUMAN_REALITY_TOPICS;