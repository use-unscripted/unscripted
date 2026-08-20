/**
 * The intake's questions, in one place.
 *
 * The assumption this flow is built on: THE STUDENT DOES NOT NEED TO KNOW WHAT
 * CAREER THEY WANT. Naming a career is optional everywhere here. The required
 * answers are the clarity baseline and the three identity fields, because the
 * first is the thing we measure change against and the other three are used in
 * the student's own outreach.
 *
 * Provenance is in the field names on purpose, because the evidence layer must
 * never mistake any of this for demonstrated behaviour:
 *   self_reported_energizers / self_reported_drains  → stated preference
 *   prior_experiences                                → reported prior experience
 *   a drain answered "never_experienced"             → no exposure, not a dislike
 *   major_uncertainties                              → an unproven assumption to test
 * Behaviour demonstrated inside Unscripted is written elsewhere, as
 * BehavioralSignal / ExperimentMeasurement rows, and only those count as
 * evidence.
 *
 * Every key written here is read by src/pages/ClaimOnboarding.jsx when the
 * profile row is created. Do not add a question nothing downstream reads.
 */

export const DECISIONS = [
  'Choosing or changing my major',
  'Finding an internship',
  'A recruiting timeline',
  'Graduate school',
  'Which industry to aim at',
  'My first job after graduation',
];

export const ENERGIZERS = [
  'Solving difficult problems', 'Working with people', 'Building things',
  'Persuading people', 'Presenting', 'Researching', 'Analyzing numbers',
  'Writing', 'Leading', 'Helping others', 'Competing', 'Creating something new',
  'Working independently', 'Working in teams', 'Making decisions',
  'Dealing with ambiguity',
];

export const DRAINS = [
  'Repetitive detail work', 'Long stretches of solitary work', 'Constant meetings',
  'High-pressure deadlines', 'Unstructured environments', 'Heavy quantitative work',
  'Constant client interaction', 'Selling', 'Public speaking',
  'Slow-moving organizations',
];

export const DRAIN_RESPONSES = [
  { value: 'like', label: 'Like it' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'unsure', label: 'Unsure' },
  { value: 'dislike', label: 'Dislike it' },
  { value: 'never_experienced', label: 'Never experienced this' },
];

export const VALUES = [
  'Compensation', 'Work-life balance', 'Geographic flexibility', 'Stability',
  'Prestige', 'Autonomy', 'Mission or social impact', 'Creativity', 'Learning',
  'Leadership', 'Entrepreneurship', 'Team environment',
];

export const VALUE_LEVELS = [
  { value: 1, label: 'Not important' },
  { value: 2, label: 'Nice to have' },
  { value: 3, label: 'Important' },
  { value: 4, label: 'Essential' },
];

export const WORK_SETTINGS = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'in_person', label: 'In person' },
  { value: 'unsure', label: 'Not sure yet' },
];

export const EXPERIENCE_KINDS = [
  'A job', 'An internship', 'A club or organization', 'Coursework', 'A project',
  'Sports', 'Volunteering', 'Research', 'A leadership role',
  'A personal project', 'A conversation with a professional',
];

export const UNKNOWNS = [
  'What kind of work I enjoy',
  'What industry interests me',
  'Whether I like quantitative work',
  'Whether I enjoy working with clients',
  'Whether I want a competitive environment',
  'Whether I enjoy ambiguity',
  'Whether I prefer building or advising',
  'Whether I want a large company or a startup',
  'Whether lifestyle outweighs compensation',
  'Whether I actually like the careers I am considering',
];

export const SCHOOL_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad student'];

export const GRAD_YEARS = (() => {
  const now = new Date().getFullYear();
  return [now, now + 1, now + 2, now + 3, now + 4].map(String);
})();

const asOptions = (values) => values.map(v => ({ value: v, label: v }));

/**
 * One question per screen. `kind` picks the control in
 * src/components/onboarding/OnboardingFields.jsx. Anything without `required`
 * is skippable and says so on the question itself.
 */
export const STEPS = [
  {
    key: 'clarity',
    kind: 'clarity',
    required: true,
    question: 'How clear are you on what you want to do?',
    hint: 'A low number is fine. We measure your progress against it.',
  },
  {
    key: 'current_careers_considered',
    kind: 'tags',
    question: 'Any careers you are already considering?',
    hint: 'Leave it empty if nothing comes to mind.',
    placeholder: 'e.g. Investment banking',
  },
  {
    key: 'careers_ruled_out',
    kind: 'tags',
    question: 'Anything you have already ruled out?',
    hint: 'We will not suggest these back to you.',
    placeholder: 'e.g. Law school',
  },
  {
    key: 'pressure',
    kind: 'pressure',
    question: 'Is anything being pushed on you, or quietly pulling at you?',
    hint: 'Both answers change what we suggest.',
  },
  {
    key: 'current_decision_pressure',
    kind: 'chips',
    question: 'What are you deciding right now?',
    hint: 'Whatever is actually in front of you this term.',
    options: asOptions(DECISIONS),
    noteKey: 'current_decision_pressure_note',
    noteLabel: 'Something else you are deciding',
    notePlaceholder: 'In your own words',
  },
  {
    key: 'self_reported_energizers',
    kind: 'chips',
    question: 'Which of these give you energy?',
    hint: 'A starting guess, not a label. Your tests decide.',
    options: asOptions(ENERGIZERS),
  },
  {
    key: 'self_reported_drains',
    kind: 'matrix',
    question: 'And how do you feel about these?',
    hint: 'If you have never done one, say so.',
  },
  {
    key: 'values',
    kind: 'values',
    question: 'What matters to you in the work itself?',
    hint: 'Several can be essential.',
  },
  {
    key: 'willingness',
    kind: 'toggles',
    question: 'Which of these are true for you?',
    hint: 'Tap any that fit. Skip if neither does.',
  },
  {
    key: 'prior_experiences',
    kind: 'experiences',
    question: 'What have you actually done so far?',
    hint: 'Tap what applies.',
  },
  {
    key: 'major_uncertainties',
    kind: 'chips',
    question: 'What are you still trying to figure out?',
    hint: 'These become the questions your tests answer.',
    options: asOptions(UNKNOWNS),
    noteKey: 'major_uncertainties_other',
    noteLabel: 'Something else you are trying to figure out',
    notePlaceholder: 'In your own words',
  },
  {
    key: 'available_hours_per_week',
    kind: 'choice',
    question: 'How many hours a week can you really give this?',
    hint: 'A focused 6 hours beats an imaginary 20.',
    options: [
      { value: 4, label: '2-4 hours', desc: 'A couple of evenings' },
      { value: 8, label: '5-8 hours', desc: 'Where most students land' },
      { value: 12, label: '9-12 hours', desc: 'A serious block of your week' },
      { value: 16, label: '13+ hours', desc: 'You have real room' },
    ],
  },
  {
    key: 'fixed_commitments',
    kind: 'text',
    question: 'What is already locked into your week?',
    hint: 'So your plan works around it instead of over it.',
    options: asOptions([
      'A job or internship', 'Athletics', 'Clubs or orgs',
      'Family responsibilities', 'A long commute', 'A heavy course load',
    ]),
    customLabel: 'Anything else',
    placeholder: 'e.g. 6am practice Mon/Wed/Fri',
  },
  {
    key: 'biggest_blocker',
    kind: 'text',
    question: 'What is keeping you stuck?',
    hint: 'Nobody else sees this.',
    options: asOptions([
      'I have no idea what I would be good at',
      'I know what I want but not how to start',
      'Everyone around me expects one thing',
      'I am scared of picking wrong',
      'I do not know anyone in the field',
    ]),
    customLabel: 'Or say it in your own words',
    placeholder: 'What keeps you stuck?',
  },
  {
    /* Four short situations, one at a time. Not a personality test: each one
       produces at most an initial signal, and no label comes out the other end. */
    key: 'scenario_answers',
    kind: 'scenarios',
    question: 'How do you tend to decide?',
    hint: 'No right answers. Every option is something reasonable people do.',
  },
  {
    key: 'about',
    kind: 'about',
    required: true,
    question: 'Last one. Who are you?',
    hint: 'Your guides and messages go out in your name.',
  },
];

export const REVIEW = STEPS.length;

/** Which stretch of the intake each question belongs to. */
const SECTIONS = [
  { until: 5, label: 'Where you are now' },
  { until: 7, label: 'What gives and takes energy' },
  { until: 9, label: 'What matters to you' },
  { until: 10, label: 'What you have done' },
  { until: 11, label: 'What you are still figuring out' },
  { until: 14, label: 'Your week' },
  { until: 15, label: 'How you decide' },
  { until: 16, label: 'About you' },
];

export const sectionFor = (i) =>
  (SECTIONS.find(s => i < s.until) || SECTIONS[SECTIONS.length - 1]).label;

const list = (v) => (Array.isArray(v) ? v : []);

/** What a completed step reads as on the review screen. */
export function summarise(step, data) {
  switch (step.kind) {
    case 'clarity':
      return data.baseline_career_clarity
        ? `Clarity ${data.baseline_career_clarity}/10${data.baseline_confidence ? ` · Confidence ${data.baseline_confidence}/10` : ''}`
        : '';
    case 'tags':
      return list(data[step.key]).join(', ');
    case 'pressure':
      return [
        data.pressured_path ? `Pushed toward ${data.pressured_path}` : '',
        data.curious_path ? `Curious about ${data.curious_path}` : '',
      ].filter(Boolean).join(' · ');
    case 'chips':
      return [list(data[step.key]).join(', '), (data[step.noteKey] || '').trim()]
        .filter(Boolean).join(' · ');
    case 'matrix': {
      const answered = list(data.self_reported_drains).filter(d => d.response);
      const never = answered.filter(d => d.response === 'never_experienced').length;
      if (!answered.length) return '';
      return `${answered.length} answered${never ? `, ${never} never experienced` : ''}`;
    }
    case 'values': {
      const essential = list(data.values_importance).filter(v => v.importance === 4).map(v => v.factor);
      const setting = WORK_SETTINGS.find(s => s.value === data.work_setting_preference)?.label;
      return [essential.length ? `Essential: ${essential.join(', ')}` : '', setting]
        .filter(Boolean).join(' · ');
    }
    case 'toggles': {
      const on = [
        data.willing_financial_risk ? 'Will take financial risk' : '',
        data.willing_long_hours ? 'Will work long hours early' : '',
      ].filter(Boolean);
      return on.join(' · ');
    }
    case 'experiences': {
      const kinds = list(data.prior_experiences).map(e => e.kind);
      return kinds.join(', ');
    }
    case 'choice':
      return step.options.find(o => o.value === data[step.key])?.label || '';
    case 'scenarios': {
      const answered = list(data.scenario_answers).length;
      return answered ? `${answered} scenario${answered === 1 ? '' : 's'} answered` : '';
    }
    case 'about':
      return [data.name, data.college, data.major, data.school_year, data.graduation_year]
        .filter(Boolean).join(' · ');
    default:
      return (data[step.key] || '').toString().trim();
  }
}

export const missingOnAbout = (data) =>
  ['name', 'college', 'major'].filter(f => !String(data[f] || '').trim());

/** Empty string when the student may continue, otherwise what is missing. */
export function blockedReason(step, data) {
  if (!step?.required) return '';
  if (step.kind === 'about') {
    return missingOnAbout(data).length
      ? 'We need your name, college and major before we can build this.'
      : '';
  }
  if (step.kind === 'clarity') {
    return data.baseline_career_clarity ? '' : 'Pick a number. Any number, including 1.';
  }
  return '';
}