/**
 * Concrete next-test blueprints, one per work characteristic we model.
 *
 * These exist so the recommendation can name a real piece of work before any
 * model is called: the engine decides WHICH uncertainty to test, and the
 * blueprint is how that uncertainty is put to the student as a task they can
 * picture. The full scenario, instructions and deliverable are still designed by
 * the existing experiment design layer when they press start.
 *
 * `tests` is student-facing wording: plain labels, never variable ids.
 */
export const NEXT_TEST_BLUEPRINTS = {
  persuasion: {
    title: 'The Stakeholder Tradeoff',
    summary: 'Argue for one course of action to two people who each want something different, and hold the line under pushback.',
    tests: ['persuasion', 'stakeholder management', 'decision making', 'communication'],
  },
  stakeholder_conflict: {
    title: 'The Cross-Functional Priority Conflict',
    summary: 'Resolve a priority clash where engineering, sales and design each have a fair case, and defend what you cut.',
    tests: ['stakeholder management', 'conflict management', 'prioritization', 'communication'],
  },
  quantitative_work: {
    title: 'The Numbers Case',
    summary: 'Build a small model from messy figures and reach a recommendation the numbers actually support.',
    tests: ['quantitative reasoning', 'modelling', 'attention to detail', 'decision making'],
  },
  analytical_intensity: {
    title: 'The Diagnostic Deep Dive',
    summary: 'Work out why a business is losing money from the evidence in front of you, then say what you would do.',
    tests: ['analytical reasoning', 'structured thinking', 'problem solving'],
  },
  ambiguity_tolerance: {
    title: 'The Undefined Brief',
    summary: 'Take a request with no clear scope, decide yourself what the real question is, and deliver an answer to it.',
    tests: ['ambiguity tolerance', 'scoping', 'judgement', 'self-direction'],
  },
  repetitive_tolerance: {
    title: 'The Repetition Run',
    summary: 'Work a stack of similar items to a consistent standard, and notice how you feel by the end of it.',
    tests: ['tolerance for repetition', 'accuracy', 'concentration'],
  },
  attention_to_detail: {
    title: 'The Accuracy Pass',
    summary: 'Review a detailed document under time pressure and catch what is wrong before signing it off.',
    tests: ['attention to detail', 'accuracy under pressure', 'concentration'],
  },
  decision_making: {
    title: 'The Incomplete Information Call',
    summary: 'Make a real call with less information than you would like, and be explicit about what you are betting on.',
    tests: ['decision making', 'judgement', 'reasoning under uncertainty'],
  },
  creativity: {
    title: 'The Blank Page Brief',
    summary: 'Start from nothing and produce original work for a real constraint, rather than executing someone else\u2019s plan.',
    tests: ['creativity', 'originality', 'self-direction'],
  },
  teamwork: {
    title: 'The Shared Deliverable',
    summary: 'Produce something with another person where neither of you owns all of it, and see how the work feels.',
    tests: ['teamwork', 'coordination', 'communication'],
  },
  independent_work: {
    title: 'The Solo Stretch',
    summary: 'Carry a piece of work end to end with nobody checking in on you until it is finished.',
    tests: ['independent work', 'self-direction', 'follow-through'],
  },
  leadership: {
    title: 'The Delegation Call',
    summary: 'Take responsibility for work you are not doing yourself, including what happens when it slips.',
    tests: ['leadership', 'delegation', 'accountability'],
  },
  interpersonal: {
    title: 'The Client Conversation',
    summary: 'Spend real time in conversation with someone whose problem you are trying to understand, then act on it.',
    tests: ['interpersonal interaction', 'listening', 'communication'],
  },
  research: {
    title: 'The Open Question',
    summary: 'Investigate a question with no guaranteed answer and report honestly on what you could and could not establish.',
    tests: ['research', 'open-ended investigation', 'synthesis'],
  },
  writing: {
    title: 'The Written Recommendation',
    summary: 'Write the argument, not the summary: a short recommendation that has to stand on its own.',
    tests: ['writing', 'structured argument', 'communication'],
  },
  problem_solving: {
    title: 'The Unsolved Problem',
    summary: 'Sit with a problem that does not resolve quickly and work it until you have something defensible.',
    tests: ['problem solving', 'persistence', 'reasoning'],
  },
  communication: {
    title: 'Explain It To Someone Who Disagrees',
    summary: 'Present your reasoning to someone with a different view and adjust without abandoning your position.',
    tests: ['communication', 'persuasion', 'composure'],
  },
  pace: {
    title: 'The Deadline Sprint',
    summary: 'Deliver real work inside a short, fixed window and record what the pace did to your quality and energy.',
    tests: ['pace and intensity', 'prioritization', 'composure under pressure'],
  },
  structure: {
    title: 'The Process Constraint',
    summary: 'Do the work inside a defined process you did not design, and notice whether it helps or frustrates you.',
    tests: ['structure', 'process discipline', 'accuracy'],
  },
  autonomy: {
    title: 'The Self-Directed Week',
    summary: 'Set your own objective and plan for a piece of work, then answer for the direction you chose.',
    tests: ['autonomy', 'self-direction', 'planning'],
  },
  risk_tolerance: {
    title: 'The Uncertain Bet',
    summary: 'Commit to a decision where the downside is real, and record how carrying that uncertainty felt.',
    tests: ['risk tolerance', 'decision making', 'composure'],
  },
};

/** A blueprint for a variable, with a safe fallback for anything unmapped. */
export function blueprintFor(variable) {
  return NEXT_TEST_BLUEPRINTS[variable.variable] || {
    title: `A Real Test Of ${variable.label}`,
    summary: `A realistic piece of work built to show how you handle ${variable.label.toLowerCase()}.`,
    tests: [variable.label.toLowerCase()],
  };
}

export default NEXT_TEST_BLUEPRINTS;