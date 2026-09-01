/**
 * The eight Conviction Gaps a student sees for a path.
 *
 * These are the STUDENT-FACING roster: the eight things you could still not know
 * about a career, in the order a student would sensibly work through them. They
 * are deliberately separate from the eight internal evidence areas in
 * conviction-record.js, which stay exactly as they are and keep driving Decision
 * Readiness as the hidden evidence-quality check.
 *
 * `characteristics` are work characteristic ids that already exist in
 * uncertainty-model.js (WORK_VARIABLES). Nothing new is invented here: a gap is
 * only ever a grouping of characteristics the model already knows about, so a
 * gap's state can be read off dimension readings that already exist.
 *
 * `areas` are the internal conviction-record area ids that speak to the same
 * question, used only to read state. Nothing here is written anywhere.
 */
export const CONVICTION_GAPS = [
  {
    id: 'core_work',
    label: 'Core Work',
    question: 'What are the actual day to day tasks of this career, and do you like doing them?',
    characteristics: ['problem_solving', 'analytical_intensity', 'quantitative_work', 'research', 'writing', 'creativity', 'attention_to_detail'],
    areas: ['core_work'],
  },
  {
    id: 'stress_pace',
    label: 'Stress and Pace',
    question: 'Can you live with the intensity and speed this work runs at?',
    characteristics: ['pace', 'repetitive_tolerance', 'ambiguity_tolerance'],
    areas: ['reality_vs_expectations'],
  },
  {
    id: 'skills_behaviors',
    label: 'Skills and Behaviors',
    question: 'What does this work demand of you, and do you have it?',
    characteristics: ['communication', 'persuasion', 'problem_solving', 'attention_to_detail', 'decision_making'],
    areas: ['capability'],
  },
  {
    id: 'values_fit',
    label: 'Values Fit',
    question: 'Does this work match what you actually care about?',
    characteristics: ['autonomy', 'creativity', 'risk_tolerance'],
    areas: ['comparison'],
  },
  {
    id: 'environment',
    label: 'Environment',
    question: 'Does the setting, structure and autonomy of this work suit you?',
    characteristics: ['structure', 'autonomy', 'independent_work', 'teamwork'],
    areas: ['work_environment'],
  },
  {
    id: 'lifestyle_tradeoffs',
    label: 'Lifestyle and Tradeoffs',
    question: 'What would this career cost you outside of work?',
    characteristics: ['pace', 'risk_tolerance', 'structure'],
    areas: ['tradeoffs'],
  },
  {
    id: 'people_role',
    label: 'People, Role and Interactions',
    question: 'Who would you work with, and how much of your day is spent with them?',
    characteristics: ['interpersonal', 'teamwork', 'stakeholder_conflict', 'communication', 'leadership'],
    areas: ['work_environment'],
  },
  {
    id: 'long_term',
    label: 'Long-Term Reality',
    question: 'Where does this path actually lead in five and ten years?',
    characteristics: ['leadership', 'risk_tolerance', 'decision_making', 'ambiguity_tolerance'],
    areas: ['stability', 'action_readiness'],
  },
];

export const GAP_STATES = {
  untested: { label: 'Untested', tone: 'muted' },
  tested_once: { label: 'Tested once', tone: 'info' },
  tested_more: { label: 'Tested more than once', tone: 'success' },
};

export default CONVICTION_GAPS;