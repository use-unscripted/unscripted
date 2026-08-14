/**
 * The seven sections of the end-of-experiment reflection.
 *
 * This is the SAME reflection system that already existed — one row per
 * experiment in WeeklyReflections, written by saveConclusion — restructured so
 * its purpose is explicit: update the career hypothesis from evidence.
 *
 * Sections 1, 2, 4, 5 and 6 are questions. Section 3 (expectation versus
 * reality) and section 7 (the synthesis) are not asked as free text: they are
 * displayed from data the student already produced, with one question each.
 */

/** Free-text questions, in order, grouped into sections. */
export const REFLECTION_SECTIONS = [
  {
    id: 'what_happened',
    number: 1,
    title: 'What happened?',
    lead: 'The facts first, before any interpretation of them.',
    questions: [
      { key: 'did', label: 'What did you actually do?', required: true, rows: 4, placeholder: 'The work itself, step by step.' },
      { key: 'realistic', label: 'What felt most realistic?', rows: 3, placeholder: 'The part that felt closest to the real job.' },
      { key: 'surprises', label: 'What surprised you?', rows: 3, placeholder: 'Anything that did not match what you expected going in.' },
    ],
  },
  {
    id: 'how_it_felt',
    number: 2,
    title: 'How did it feel?',
    lead: 'Energy and avoidance are evidence. Finding something hard is not the same as disliking it.',
    questions: [
      { key: 'energy', label: 'What gave you energy?', rows: 3, placeholder: 'The parts you lost track of time in.' },
      { key: 'drains', label: 'What drained you?', rows: 3, placeholder: 'The parts that cost you more than they gave.' },
      { key: 'enjoyed', label: 'What did you enjoy?', rows: 3, placeholder: 'Not the same question as what you were good at.' },
      { key: 'avoided', label: 'What did you avoid?', rows: 3, placeholder: 'What you put off, skipped or rushed.' },
      { key: 'again', label: 'What would you voluntarily do again?', rows: 3, placeholder: 'With nobody asking you to.' },
    ],
  },
  {
    id: 'expectation_reality',
    number: 3,
    title: 'Expectation vs reality',
    lead: 'Your own answers from before and after this experiment, placed side by side.',
    questions: [
      { key: 'expectationsWrong', label: 'Where were your expectations wrong?', rows: 3, placeholder: 'Point at the numbers above if they moved.' },
    ],
  },
  {
    id: 'about_you',
    number: 4,
    title: 'What did this teach you about yourself?',
    lead: 'Only the decision dimensions this experiment actually tested.',
    questions: [],
  },
  {
    id: 'about_career',
    number: 5,
    title: 'What did this teach you about the career?',
    lead: 'About the work and the field, not about how the experiment went.',
    questions: [
      { key: 'moreAppealing', label: 'What became more appealing?', rows: 3, placeholder: 'What you would want more of.' },
      { key: 'lessAppealing', label: 'What became less appealing?', rows: 3, placeholder: 'What you would want less of.' },
      { key: 'misconception', label: 'Which misconception changed?', rows: 3, placeholder: 'What you believed before, and what you believe now.' },
      { key: 'unresolved', label: 'What remains unresolved?', rows: 3, placeholder: 'What you still cannot answer about this direction.' },
    ],
  },
  {
    id: 'evidence_review',
    number: 6,
    title: 'Evidence review',
    lead: 'What this experiment produced.',
    questions: [],
  },
];

/** Every free-text key, plus the structured answers held alongside them. */
export const EMPTY_ANSWERS = {
  did: '', realistic: '', surprises: '',
  energy: '', drains: '', enjoyed: '', avoided: '', again: '',
  expectationsWrong: '',
  dimensionNotes: {},
  moreAppealing: '', lessAppealing: '', misconception: '', unresolved: '',
  influentialEvidenceId: '', influentialEvidence: '',
  interest: '', interestNote: '', clarity: null, references: [],
};

/** Answers restored from an already-saved reflection row. */
export function answersFromReflection(r) {
  if (!r) return null;
  const notes = {};
  (r.dimension_notes || []).forEach(d => { if (d?.dimension) notes[d.dimension] = d.note || ''; });
  return {
    ...EMPTY_ANSWERS,
    did: r.what_i_did || r.lessons || '',
    realistic: r.most_realistic || '',
    surprises: r.surprises || '',
    energy: r.energy_sources || '',
    drains: r.energy_drains || '',
    enjoyed: r.enjoyed_most || '',
    avoided: r.avoided_work || '',
    again: r.would_do_again || '',
    expectationsWrong: r.expectations_wrong || '',
    dimensionNotes: notes,
    moreAppealing: r.more_appealing || '',
    lessAppealing: r.less_appealing || '',
    misconception: r.misconception_changed || r.assumptions_changed || '',
    unresolved: r.still_unresolved || '',
    influentialEvidenceId: r.most_influential_evidence_id || '',
    influentialEvidence: r.most_influential_evidence || '',
    interest: r.interest_direction || '',
    interestNote: '',
    clarity: typeof r.clarity_score === 'number' ? r.clarity_score : null,
    references: r.referenced_experiment_ids || [],
  };
}

/** The first unanswered requirement, or null when the reflection can be saved. */
export function blockingAnswer(answers) {
  if (!String(answers.did || '').trim()) return 'Answer the first question: what you actually did.';
  if (!answers.interest) return 'Say whether you are more or less interested in this direction.';
  if (answers.clarity == null) return 'Set your current career-clarity score.';
  return null;
}

/** The reflection fields, mapped onto the entity. Nothing is invented here. */
export function reflectionFields(answers, dimensions = []) {
  const t = (v) => String(v || '').trim() || undefined;
  const notes = dimensions
    .map(d => ({ dimension: d.dimension, label: d.dimension_label, note: String(answers.dimensionNotes?.[d.dimension] || '').trim() }))
    .filter(d => d.note);
  return {
    what_i_did: t(answers.did),
    // `lessons` stays populated: the evidence extractor already reads it, and it
    // is the same words the student wrote about the work.
    lessons: t(answers.did),
    most_realistic: t(answers.realistic),
    surprises: t(answers.surprises),
    energy_sources: t(answers.energy),
    energy_drains: t(answers.drains),
    enjoyed_most: t(answers.enjoyed),
    avoided_work: t(answers.avoided),
    would_do_again: t(answers.again),
    expectations_wrong: t(answers.expectationsWrong),
    dimension_notes: notes.length ? notes : undefined,
    more_appealing: t(answers.moreAppealing),
    less_appealing: t(answers.lessAppealing),
    misconception_changed: t(answers.misconception),
    assumptions_changed: t(answers.misconception),
    still_unresolved: t(answers.unresolved),
    most_influential_evidence: t(answers.influentialEvidence),
    most_influential_evidence_id: t(answers.influentialEvidenceId),
    supporting_evidence: t(answers.influentialEvidence),
  };
}