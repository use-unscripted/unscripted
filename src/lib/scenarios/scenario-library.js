/**
 * The scenario library, held in code.
 *
 * Scenarios are content, not student data, so they live here rather than in a
 * table a student's account has to be seeded with: a returning student and a
 * brand new one see the same library, and an answer stored last month still
 * points at the option it was given for.
 *
 * Two kinds only, and they are never mixed:
 *   workstyle       — plausible options, no correct answer, produces dimension
 *                     signals capped at "moderate" however emphatic the choice.
 *   performance_*   — one right answer or an accepted range, scored, and feeding
 *                     task performance rather than career fit.
 *
 * Every scenario carries what it does NOT tell us, because that sentence is what
 * keeps the product honest when a student reads their own results.
 */

const workstyle = (s) => ({
  scenario_type: 'workstyle',
  version: 1,
  validation_status: 'published',
  active_status: 'active',
  source_type: 'onet',
  ...s,
  id: s.scenario_key,
});

// ── 1. Onboarding: broad, career-free, five of them ─────────────────────────
export const ONBOARDING_SCENARIOS = [
  workstyle({
    scenario_key: 'ob_incomplete_information',
    context_type: 'onboarding',
    difficulty: 'introductory',
    title: 'Half the information you wanted',
    scenario_text: 'You have been asked for a recommendation by Friday. About half the information you wanted is missing and nobody can get it to you in time.',
    dimensions_intended: ['ambiguity_tolerance', 'analytical_depth', 'structured_environments'],
    what_this_does_not_tell_us: 'Whether the student can actually work well without complete information, only how they say they would start.',
    options: [
      { id: 'a', option_text: 'Start with what you have and adjust as you learn more.', dimension_signal_mapping: [{ dimension: 'ambiguity_tolerance', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'b', option_text: 'Ask the two questions that would change your answer most.', dimension_signal_mapping: [{ dimension: 'analytical_depth', signal_direction: 'draws_toward', signal_strength: 'weak' }, { dimension: 'ambiguity_tolerance', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'c', option_text: 'Write down exactly what is missing before going any further.', dimension_signal_mapping: [{ dimension: 'structured_environments', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'ambiguity_tolerance', signal_direction: 'draws_away', signal_strength: 'weak' }] },
      { id: 'd', option_text: 'Find how a similar situation was handled before and work from that.', dimension_signal_mapping: [{ dimension: 'research', signal_direction: 'draws_toward', signal_strength: 'weak' }, { dimension: 'structured_environments', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
    ],
  }),
  workstyle({
    scenario_key: 'ob_group_project',
    context_type: 'onboarding',
    difficulty: 'introductory',
    title: 'A piece of work with three other people',
    scenario_text: 'A piece of work has to be finished in a week, with three other people involved. How would you rather it ran?',
    dimensions_intended: ['teamwork', 'independent_work', 'leadership'],
    what_this_does_not_tell_us: 'How the student behaves once a real group is disagreeing in front of them.',
    options: [
      { id: 'a', option_text: 'Split it up so each person owns a piece and works alone.', dimension_signal_mapping: [{ dimension: 'independent_work', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'teamwork', signal_direction: 'draws_away', signal_strength: 'weak' }] },
      { id: 'b', option_text: 'Work through the hard parts together, out loud.', dimension_signal_mapping: [{ dimension: 'teamwork', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'c', option_text: 'Set the plan yourself, then check in on each part.', dimension_signal_mapping: [{ dimension: 'leadership', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'structured_environments', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'd', option_text: 'Take the piece nobody else wants and get on with it.', dimension_signal_mapping: [{ dimension: 'independent_work', signal_direction: 'draws_toward', signal_strength: 'weak' }, { dimension: 'operational_execution', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
    ],
  }),
  workstyle({
    scenario_key: 'ob_analysis_or_persuasion',
    context_type: 'onboarding',
    difficulty: 'introductory',
    title: 'Two days on the same decision',
    scenario_text: 'You have two days before a decision is made and can spend them however you like.',
    dimensions_intended: ['analytical_depth', 'persuasion', 'presenting'],
    what_this_does_not_tell_us: 'Whether the student is good at either, only which one they are drawn to spending time on.',
    options: [
      { id: 'a', option_text: 'Go deep into the numbers until the answer is clear to you.', dimension_signal_mapping: [{ dimension: 'analytical_depth', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'quantitative_intensity', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'b', option_text: 'Talk to the people affected and bring them round.', dimension_signal_mapping: [{ dimension: 'persuasion', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'client_interaction', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'c', option_text: 'Build the clearest possible way to present the choice.', dimension_signal_mapping: [{ dimension: 'presenting', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'writing', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'd', option_text: 'Test a small version of it and see what happens.', dimension_signal_mapping: [{ dimension: 'building_orientation', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'short_feedback_loops', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
    ],
  }),
  workstyle({
    scenario_key: 'ob_speed_or_precision',
    context_type: 'onboarding',
    difficulty: 'introductory',
    title: 'Good enough today, or exact on Monday',
    scenario_text: 'Your work can go out today at roughly ninety percent right, or on Monday fully checked. Nobody has told you which they want.',
    dimensions_intended: ['high_pressure_pace', 'detail_orientation', 'short_feedback_loops'],
    what_this_does_not_tell_us: 'How the student holds precision over weeks of real work, which only a longer experiment shows.',
    options: [
      { id: 'a', option_text: 'Send it today and flag what still needs checking.', dimension_signal_mapping: [{ dimension: 'high_pressure_pace', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'detail_orientation', signal_direction: 'draws_away', signal_strength: 'weak' }] },
      { id: 'b', option_text: 'Hold it until every number has been checked twice.', dimension_signal_mapping: [{ dimension: 'detail_orientation', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'high_pressure_pace', signal_direction: 'draws_away', signal_strength: 'weak' }] },
      { id: 'c', option_text: 'Send the part you are sure of now, the rest on Monday.', dimension_signal_mapping: [{ dimension: 'short_feedback_loops', signal_direction: 'draws_toward', signal_strength: 'weak' }, { dimension: 'ambiguity_tolerance', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'd', option_text: 'Ask which of the two they would rather have.', dimension_signal_mapping: [{ dimension: 'client_interaction', signal_direction: 'draws_toward', signal_strength: 'weak' }, { dimension: 'structured_environments', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
    ],
  }),
  workstyle({
    scenario_key: 'ob_build_or_advise',
    context_type: 'onboarding',
    difficulty: 'introductory',
    title: 'The thing itself, or the thinking about it',
    scenario_text: 'A small organisation has a problem you can see clearly. You can spend a month on it.',
    dimensions_intended: ['building_orientation', 'client_interaction', 'research'],
    what_this_does_not_tell_us: 'Whether the student enjoys the month itself, which is what an experiment is for.',
    options: [
      { id: 'a', option_text: 'Build the thing that fixes it and hand it over working.', dimension_signal_mapping: [{ dimension: 'building_orientation', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'b', option_text: 'Work out what they should do and make the case for it.', dimension_signal_mapping: [{ dimension: 'building_orientation', signal_direction: 'draws_away', signal_strength: 'weak' }, { dimension: 'client_interaction', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'c', option_text: 'Study how the problem came about before touching it.', dimension_signal_mapping: [{ dimension: 'research', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'analytical_depth', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'd', option_text: 'Run the day-to-day yourself for a while and fix it as you go.', dimension_signal_mapping: [{ dimension: 'operational_execution', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'building_orientation', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
    ],
  }),
];

// ── 2. Role-relevant scenarios, used inside experiments ─────────────────────
export const ROLE_SCENARIOS = [
  // Investment banking. Discrepancy first: it is the one worth asking earliest.
  workstyle({
    scenario_key: 'role_discrepancy_before_deadline',
    context_type: 'career_specific',
    career_title: 'Investment Banking Analyst',
    match_terms: ['investment banking', 'banking analyst', 'capital markets', 'private equity', 'corporate development', 'm&a'],
    difficulty: 'moderate',
    title: 'A small discrepancy, two hours before it goes out',
    scenario_text: 'Two hours before the deck goes to the client you find a small discrepancy between two of your inputs. It probably moves the headline number very little.',
    dimensions_intended: ['detail_orientation', 'high_pressure_pace', 'client_interaction'],
    what_this_does_not_tell_us: 'How the student holds up doing this at two in the morning in a real deal week.',
    options: [
      { id: 'a', option_text: 'Fix it now, even if the rest has to be rushed.', dimension_signal_mapping: [{ dimension: 'detail_orientation', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'b', option_text: 'Send it up the chain immediately and let them decide.', dimension_signal_mapping: [{ dimension: 'client_interaction', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'autonomy', signal_direction: 'draws_away', signal_strength: 'weak' }] },
      { id: 'c', option_text: 'Size the impact first, then decide whether it can wait.', dimension_signal_mapping: [{ dimension: 'analytical_depth', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'high_pressure_pace', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'd', option_text: 'Note it on the page and raise it after it has gone out.', dimension_signal_mapping: [{ dimension: 'high_pressure_pace', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'detail_orientation', signal_direction: 'draws_away', signal_strength: 'weak' }] },
    ],
  }),
  workstyle({
    scenario_key: 'role_conflicting_company_information',
    context_type: 'career_specific',
    career_title: 'Investment Banking Analyst',
    match_terms: ['investment banking', 'banking analyst', 'equity research', 'corporate development', 'm&a'],
    difficulty: 'moderate',
    title: 'Two filings, two different numbers',
    scenario_text: 'The company\u2019s own filing and its investor presentation give different revenue figures for the same quarter. Both look deliberate.',
    dimensions_intended: ['analytical_depth', 'detail_orientation', 'research'],
    what_this_does_not_tell_us: 'Whether the student can actually reconcile the two, which the performance question tests instead.',
    options: [
      { id: 'a', option_text: 'Work out which definition each figure uses before doing anything else.', dimension_signal_mapping: [{ dimension: 'analytical_depth', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'research', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'b', option_text: 'Use the filing and note the difference in a footnote.', dimension_signal_mapping: [{ dimension: 'detail_orientation', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'c', option_text: 'Ask someone senior which one the team normally uses.', dimension_signal_mapping: [{ dimension: 'teamwork', signal_direction: 'draws_toward', signal_strength: 'weak' }, { dimension: 'autonomy', signal_direction: 'draws_away', signal_strength: 'weak' }] },
      { id: 'd', option_text: 'Run the analysis both ways and show the range.', dimension_signal_mapping: [{ dimension: 'quantitative_intensity', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'ambiguity_tolerance', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
    ],
  }),
  // Strategy and advisory work.
  workstyle({
    scenario_key: 'role_incomplete_client_information',
    context_type: 'career_specific',
    career_title: 'Management Consultant',
    match_terms: ['consult', 'strategy', 'advisory', 'business analyst'],
    difficulty: 'moderate',
    title: 'The client cannot get you the data',
    scenario_text: 'The client agreed to send three years of cost data. Two days before the working session they tell you it does not exist in one place.',
    dimensions_intended: ['ambiguity_tolerance', 'client_interaction', 'analytical_depth'],
    what_this_does_not_tell_us: 'How the student handles the room when the client pushes back in person.',
    options: [
      { id: 'a', option_text: 'Build an estimate from what does exist and label the assumptions.', dimension_signal_mapping: [{ dimension: 'ambiguity_tolerance', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'analytical_depth', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'b', option_text: 'Sit with their team and reconstruct it together.', dimension_signal_mapping: [{ dimension: 'client_interaction', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'teamwork', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'c', option_text: 'Narrow the question to what the available data can answer.', dimension_signal_mapping: [{ dimension: 'structured_environments', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'd', option_text: 'Move the session and get the data properly first.', dimension_signal_mapping: [{ dimension: 'detail_orientation', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'high_pressure_pace', signal_direction: 'draws_away', signal_strength: 'weak' }] },
    ],
  }),
  workstyle({
    scenario_key: 'role_competing_approaches',
    context_type: 'career_specific',
    career_title: 'Management Consultant',
    match_terms: ['consult', 'strategy', 'advisory'],
    difficulty: 'moderate',
    title: 'Two defensible answers',
    scenario_text: 'Your analysis supports one recommendation. A colleague\u2019s supports a different one. Both hold up.',
    dimensions_intended: ['persuasion', 'teamwork', 'analytical_depth'],
    what_this_does_not_tell_us: 'What the student does when the disagreement carries on for weeks.',
    options: [
      { id: 'a', option_text: 'Find the test that would separate the two and run it.', dimension_signal_mapping: [{ dimension: 'analytical_depth', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'b', option_text: 'Put both to the client with the tradeoffs laid out.', dimension_signal_mapping: [{ dimension: 'presenting', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'client_interaction', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'c', option_text: 'Argue your case and try to bring your colleague round.', dimension_signal_mapping: [{ dimension: 'persuasion', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'competition', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'd', option_text: 'Work with them to build one recommendation from both.', dimension_signal_mapping: [{ dimension: 'teamwork', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
    ],
  }),
  // Product work.
  workstyle({
    scenario_key: 'role_feature_prioritization',
    context_type: 'career_specific',
    career_title: 'Product Manager',
    match_terms: ['product manag', 'product owner', 'program manag', 'startup founder', 'operator'],
    difficulty: 'moderate',
    title: 'Room for one of the three',
    scenario_text: 'Three things are asked for this quarter and there is room for one: a fix a few large customers want, a change most users would notice, or work that makes the next six months faster.',
    dimensions_intended: ['analytical_depth', 'client_interaction', 'long_project_cycles'],
    what_this_does_not_tell_us: 'Whether the student can hold that decision once the people who lost it are unhappy.',
    options: [
      { id: 'a', option_text: 'The fix the largest customers are asking for.', dimension_signal_mapping: [{ dimension: 'client_interaction', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'b', option_text: 'The change most users would feel straight away.', dimension_signal_mapping: [{ dimension: 'short_feedback_loops', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'c', option_text: 'The work that makes everything after it faster.', dimension_signal_mapping: [{ dimension: 'long_project_cycles', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'analytical_depth', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'd', option_text: 'Whichever the data says moves the metric you are judged on.', dimension_signal_mapping: [{ dimension: 'quantitative_intensity', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
    ],
  }),
  workstyle({
    scenario_key: 'role_stakeholder_disagreement',
    context_type: 'career_specific',
    career_title: 'Product Manager',
    match_terms: ['product manag', 'product owner', 'operator', 'startup founder'],
    difficulty: 'moderate',
    title: 'What users need, what can be built',
    scenario_text: 'Users clearly need something. Engineering says the version users need takes three months, and a smaller version takes two weeks.',
    dimensions_intended: ['teamwork', 'client_interaction', 'building_orientation'],
    what_this_does_not_tell_us: 'How the student holds the relationship when the smaller version disappoints people.',
    options: [
      { id: 'a', option_text: 'Ship the two-week version and learn from it.', dimension_signal_mapping: [{ dimension: 'short_feedback_loops', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'building_orientation', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'b', option_text: 'Sit with engineering and look for a third option.', dimension_signal_mapping: [{ dimension: 'teamwork', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'c', option_text: 'Make the case for the three months to the people above you.', dimension_signal_mapping: [{ dimension: 'persuasion', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'd', option_text: 'Go back to users and check which part they need first.', dimension_signal_mapping: [{ dimension: 'research', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'client_interaction', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
    ],
  }),
  // Founding and early operating.
  workstyle({
    scenario_key: 'role_speed_vs_validation',
    context_type: 'career_specific',
    career_title: 'Startup Founder and Early Operator',
    match_terms: ['founder', 'entrepreneur', 'startup', 'business owner', 'operator'],
    difficulty: 'moderate',
    title: 'Six weeks, or six conversations',
    scenario_text: 'You believe a product would work. Building a rough version takes six weeks. Talking to twenty potential customers takes two.',
    dimensions_intended: ['risk_tolerance', 'building_orientation', 'research'],
    what_this_does_not_tell_us: 'Whether the student keeps going when either route stops being exciting.',
    options: [
      { id: 'a', option_text: 'Build the rough version and put it in front of people.', dimension_signal_mapping: [{ dimension: 'building_orientation', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'risk_tolerance', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'b', option_text: 'Have the twenty conversations first.', dimension_signal_mapping: [{ dimension: 'research', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'client_interaction', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'c', option_text: 'Sell it before it exists and build only if people pay.', dimension_signal_mapping: [{ dimension: 'persuasion', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'risk_tolerance', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'd', option_text: 'Work out the numbers that would have to be true first.', dimension_signal_mapping: [{ dimension: 'quantitative_intensity', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'analytical_depth', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
    ],
  }),
  workstyle({
    scenario_key: 'role_customer_feedback_conflict',
    context_type: 'career_specific',
    career_title: 'Startup Founder and Early Operator',
    match_terms: ['founder', 'entrepreneur', 'startup', 'business owner', 'operator'],
    difficulty: 'moderate',
    title: 'Your best customers want opposite things',
    scenario_text: 'Your two happiest customers want the product taken in opposite directions. You have resources for one direction.',
    dimensions_intended: ['ambiguity_tolerance', 'client_interaction', 'autonomy'],
    what_this_does_not_tell_us: 'How the student handles telling one of them no.',
    options: [
      { id: 'a', option_text: 'Pick the direction you believe in and say so plainly.', dimension_signal_mapping: [{ dimension: 'autonomy', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'risk_tolerance', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'b', option_text: 'Find which direction more future customers would want.', dimension_signal_mapping: [{ dimension: 'research', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
      { id: 'c', option_text: 'Get both of them in one conversation with you.', dimension_signal_mapping: [{ dimension: 'client_interaction', signal_direction: 'draws_toward', signal_strength: 'moderate' }, { dimension: 'teamwork', signal_direction: 'draws_toward', signal_strength: 'weak' }] },
      { id: 'd', option_text: 'Do a smaller piece of both and wait for a clearer signal.', dimension_signal_mapping: [{ dimension: 'ambiguity_tolerance', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
    ],
  }),
];

// ── 3. Performance questions. Scored, and never about fit ───────────────────
export const PERFORMANCE_QUESTIONS = [
  {
    id: 'perf_enterprise_value',
    scenario_key: 'perf_enterprise_value',
    scenario_type: 'performance_objective',
    context_type: 'experiment_embedded',
    version: 1,
    validation_status: 'published',
    active_status: 'active',
    source_type: 'industry_research',
    career_title: 'Investment Banking Analyst',
    match_terms: ['investment banking', 'banking analyst', 'equity research', 'corporate development', 'm&a', 'private equity'],
    title: 'Enterprise value',
    scenario_text: 'A company has equity value of 800, total debt of 250, cash of 50 and no other adjustments. What is its enterprise value?',
    dimensions_intended: ['quantitative_intensity'],
    what_this_does_not_tell_us: 'Anything about whether this work suits the student. It is one calculation, scored on its own.',
    accepted_answer_range: { low: 1000, high: 1000, unit: 'millions' },
    answer_explanation: 'Enterprise value is equity value plus debt less cash: 800 + 250 - 50 = 1000.',
    evaluation_version: 'objective-v1',
    options: [],
  },
  {
    id: 'perf_runway_months',
    scenario_key: 'perf_runway_months',
    scenario_type: 'performance_objective',
    context_type: 'experiment_embedded',
    version: 1,
    validation_status: 'published',
    active_status: 'active',
    source_type: 'industry_research',
    career_title: 'Startup Founder and Early Operator',
    match_terms: ['founder', 'entrepreneur', 'startup', 'business owner', 'operator'],
    title: 'Months of runway',
    scenario_text: 'You hold 240,000 in the bank. You spend 50,000 a month and collect 20,000 a month in revenue. How many months of runway do you have?',
    dimensions_intended: ['quantitative_intensity'],
    what_this_does_not_tell_us: 'Whether the student would enjoy running a company. It checks one calculation.',
    accepted_answer_range: { low: 8, high: 8, unit: 'months' },
    answer_explanation: 'Net burn is 50,000 - 20,000 = 30,000 a month, so 240,000 / 30,000 = 8 months.',
    evaluation_version: 'objective-v1',
    options: [],
  },
];

export const ALL_SCENARIOS = [...ONBOARDING_SCENARIOS, ...ROLE_SCENARIOS, ...PERFORMANCE_QUESTIONS];

const BY_KEY = new Map(ALL_SCENARIOS.map(s => [s.scenario_key, s]));

export const scenarioByKey = (key) => BY_KEY.get(key) || null;

const matches = (scenario, name) => {
  const n = String(name || '').toLowerCase();
  return n && (scenario.match_terms || []).some(t => n.includes(t));
};

/**
 * Role-relevant scenarios for a career, falling back to the broad onboarding set
 * so an experiment on a career the library does not cover still asks something
 * honest rather than nothing.
 */
export function scenariosForCareer(careerName, { limit = 2 } = {}) {
  const matched = ROLE_SCENARIOS.filter(s => matches(s, careerName));
  return (matched.length ? matched : ONBOARDING_SCENARIOS).slice(0, limit);
}

/** The scored question for this career, or null when there isn't one. */
export function performanceForCareer(careerName) {
  return PERFORMANCE_QUESTIONS.find(q => matches(q, careerName)) || null;
}

/**
 * Scenarios that touch one decision dimension, career-relevant ones first. This
 * is what lets an untested dimension be probed cheaply before an experiment is
 * chosen.
 */
export function scenariosForDimension(dimension, { careerName, limit = 1 } = {}) {
  const touches = (s) => (s.dimensions_intended || []).includes(dimension)
    || (s.options || []).some(o => (o.dimension_signal_mapping || []).some(m => m.dimension === dimension));
  const role = ROLE_SCENARIOS.filter(s => touches(s) && matches(s, careerName));
  const broad = ONBOARDING_SCENARIOS.filter(touches);
  const rest = ROLE_SCENARIOS.filter(s => touches(s) && !matches(s, careerName));
  return [...role, ...broad, ...rest].slice(0, limit);
}