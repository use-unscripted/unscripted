/**
 * The Northgate sprint: one hand written work simulation, in git, static.
 *
 * Every string below is fixed and identical for every student. Nothing here
 * calls a model and nothing here takes a student's own data as input, which is
 * what keeps the scenario the same thing twice and what lets the whole
 * simulation run while the integration limit is in force. If a future change
 * needs the scenario to differ per student, that is a new simulation with a new
 * key, not an interpolation into this one.
 *
 * The tedium is deliberate. People leave careers over the meetings, the waiting
 * and the tenth revision, so the read-in is dull on purpose and the revision in
 * step 4 undoes work the student has already done.
 *
 * `backlog.items[].points`, `backlog.capacity` and `revision.revised_points` are
 * the inputs to the arithmetic check in work-sim-checks.js, and
 * `spec.headings[].label` is what that module matches the non-goals check on.
 * Changing either without changing the checks breaks the scoring quietly, so
 * bump `version` if you touch them.
 */

export const SIMULATION_KEY = 'northgate_pm_triage_v1';
export const SIMULATION_VERSION = 1;

/** The heading id the non-goals check reads. Kept as a constant so the check
 *  and the content cannot drift apart. */
export const NON_GOALS_HEADING_ID = 'not_doing';

const READ_IN = [
  {
    id: 'support_thread',
    kind: 'support',
    from: 'Support queue',
    subject: 'Duplicate jobs, 11 tickets since Friday',
    summary:
      'Eleven tickets in four days, all about the same thing: a job showing up twice on a technician schedule. Three are below in full. The other eight say roughly what these say.',
    tickets: [
      {
        ref: '#4471',
        from: 'Ridgeline Plumbing (office)',
        subject: 'duplicate jobs again',
        body:
          'hi so this is happening again on tuesday, carlos had the same job twice on his phone and once on the tablet and he drove out there twice. the second one wasnt on my screen at all when i looked. we did what we normally do and rebooked it. is there a way to stop it doing that. also the tablet one said 10:15 and the other said 10am, not sure if thats related. thanks',
      },
      {
        ref: '#4478',
        from: 'Harbor Point Heating and Air',
        subject: 'job showing twice',
        body:
          'Job 88214 is on the schedule two times for Wednesday. I deleted one and then both of them went away, so I put it back in by hand and now the customer has had two confirmation texts. Please advise. We are a 6 truck shop and we cannot keep doing this every week.',
      },
      {
        ref: '#4483',
        from: 'Vance Electric',
        subject: 'not sure if bug',
        body:
          'Following up, my ticket from last week got closed and nobody replied. Same issue. Sometimes when I edit a job that Sam already has open on his end it makes a second one. Might be us doing something wrong. It did not do this before the update though. Our dispatcher thinks it started around the 14th but she is not certain.',
      },
    ],
  },
  {
    id: 'sales_email',
    kind: 'email',
    from: 'Mark Deshpande, Sales',
    subject: 'Calder Mechanical, 60 seats',
    body:
      'Talked to Calder again this morning. 60 seats, and they run maintenance contracts, so nearly everything they book repeats on a schedule. They asked me outright whether we do recurring jobs and I told them it was on the roadmap. Can we get this by Q3, they are asking.',
  },
  {
    id: 'engineering_capacity',
    kind: 'message',
    from: 'Priya Raman, Engineering lead',
    subject: 'sprint capacity',
    body:
      'Before you plan anything: Tomas is out with flu, back Monday at the earliest. That puts us at 6 points this sprint instead of 10. I would rather you cut the sprint down than we take the whole thing on and miss it.',
  },
  {
    id: 'monthly_numbers',
    kind: 'numbers',
    from: 'Weekly ops report',
    subject: 'Jobs area, last month',
    rows: [
      { label: 'Job creation attempts', value: '8,412' },
      { label: 'Failed', value: '331' },
      { label: 'Duplicate rate', value: '3.9%' },
      { label: 'Duplicate rate in March', value: '2.1%' },
    ],
    body: 'These come out every Monday. Nobody has looked at the change since March.',
  },
  {
    id: 'ceo_forward',
    kind: 'email',
    from: 'Dana Whitfield, CEO',
    subject: 'Fwd: What is new at Servicebook',
    body:
      'Forwarded with nothing written on it. The link goes to a competitor changelog. The top entry reads: "Recurring jobs. Set any job to repeat weekly, monthly, or on a schedule you define. Rolling out to all plans this month."',
  },
  {
    id: 'calendar',
    kind: 'calendar',
    from: 'Your calendar',
    subject: 'Tuesday',
    rows: [
      { label: '9:30', value: 'Standup, 15 minutes' },
      { label: '10:15', value: 'Calder call. Mark added you last night.' },
      { label: '11:30', value: 'Design review, 45 minutes' },
    ],
    body: 'You blocked 9:00 to 12:30 this morning to work on the sprint. All three landed inside it.',
  },
];

const BACKLOG_ITEMS = [
  {
    id: 'duplicate_jobs',
    title: 'Stop duplicate jobs landing on technician schedules',
    points: 2,
    requested_by: 'Support',
    note: 'Priya gave the estimate in standup, quickly, without looking at anything.',
  },
  {
    id: 'recurring_jobs',
    title: 'Recurring jobs',
    points: 8,
    requested_by: 'Mark Deshpande, Sales',
    note: 'The Calder deal, and the thing in the competitor changelog.',
  },
  {
    id: 'bulk_reschedule',
    title: 'Move a whole day of jobs at once',
    points: 3,
    requested_by: 'Two dispatchers, separately',
    note: 'Today they open each job and change the date by hand, one at a time.',
  },
  {
    id: 'job_export',
    title: 'Export a month of jobs to a spreadsheet',
    points: 2,
    requested_by: 'Office manager at Ridgeline Plumbing',
    note: 'She has asked three times. She copies the screen into Excel at the moment.',
  },
  {
    id: 'save_error_copy',
    title: 'Rewrite the error people see when a job will not save',
    points: 1,
    requested_by: 'Support',
    note: 'It currently says "Request could not be completed (400)." Support explains it about twice a day.',
  },
  {
    id: 'van_photos',
    title: 'Let technicians attach a photo to a job from their phone',
    points: 2,
    requested_by: 'Dana Whitfield, CEO',
    note: 'Mentioned once, in passing, after a customer dinner. Not raised since.',
  },
  {
    id: 'late_booking_date',
    title: 'Jobs booked after 8pm show on the wrong day for Arizona accounts',
    points: 1,
    requested_by: 'One customer, twice',
    note: 'Four accounts are affected. All four are small.',
  },
];

const SPEC_HEADINGS = [
  { id: 'problem', label: 'The problem', hint: 'What is going wrong, for whom, and how you know.' },
  { id: 'audience', label: 'Who it is for', hint: 'Which people at which kind of company.' },
  { id: 'doing', label: 'What we are doing', hint: 'The change itself, in plain terms.' },
  { id: NON_GOALS_HEADING_ID, label: 'What we are not doing', hint: 'The things a reader would otherwise assume are included.' },
  { id: 'success', label: 'How we will know it worked', hint: 'What you would look at, and when.' },
];

const RUBRIC = [
  {
    id: 'problem_not_feature',
    criterion: 'The problem statement names a problem, not a feature.',
    scored_by: 'model',
  },
  {
    id: 'plan_fits_capacity',
    criterion: 'The final plan fits the revised capacity.',
    scored_by: 'checks',
  },
  {
    id: 'non_goals_present',
    criterion: 'The spec says what is not being done.',
    scored_by: 'checks',
  },
  {
    id: 'honest_reply',
    criterion: 'The reply to sales is honest without being a dodge, and gives no date it cannot keep.',
    scored_by: 'model',
  },
  {
    id: 'revision_changed_plan',
    criterion: 'The revision changed the plan rather than restating it.',
    scored_by: 'checks',
  },
];

const STEPS = [
  {
    number: 1,
    id: 'read_in',
    title: 'The read-in',
    minutes: 3,
    blurb: 'Six things that arrived overnight. Read them. There is nothing to answer yet.',
  },
  {
    number: 2,
    id: 'cut',
    title: 'Cut the list',
    minutes: 8,
    blurb:
      'Seven things people want, 19 points of work, 6 points of capacity. Write one line saying what the problem is, choose what goes in, and for everything you cut, write the line you would send to the person who asked for it.',
  },
  {
    number: 3,
    id: 'spec',
    title: 'Write the spec',
    minutes: 9,
    blurb:
      'A short document under five headings. Aim for 150 to 250 words. Nobody is going to tell you whether it is right.',
  },
  {
    number: 4,
    id: 'revision',
    title: 'The revision',
    minutes: 7,
    blurb: 'Priya has read it. Your first version stays on screen while you rework it.',
  },
  {
    number: 5,
    id: 'reply',
    title: 'The reply',
    minutes: 3,
    blurb: 'Write the message to Mark. Under 80 words.',
  },
];

export const NORTHGATE_PM = {
  key: SIMULATION_KEY,
  version: SIMULATION_VERSION,
  title: 'The Northgate sprint',
  career_name: 'Product Manager',
  estimated_minutes: 30,
  role: 'Product manager, Jobs area',

  /** Shown before anything starts. The framing has to be here, not only in the
   *  read-out: a student who begins believing this is a verdict on their chosen
   *  path has already been misled. */
  entry_note:
    'This is about 30 minutes of one kind of product work at a company that does not exist. It will show you how you reacted to that work. It will not tell you whether you would be good at the job, whether you would like the job, or whether you should do it.',

  setup:
    'Northgate sells scheduling software to home services companies: plumbers, electricians, heating and air. About 40 people. You are the product manager for the Jobs area, which is where a company books work, puts a technician on it, and moves it when something changes. It is Tuesday, 9:12 in the morning.',

  objective:
    'Decide what the Jobs team builds this sprint, write the spec for it, and tell the people who asked for the rest.',

  deliverable: 'A short product spec, a revised plan, and a reply to sales',

  steps: STEPS,
  read_in: READ_IN,

  backlog: {
    capacity: 6,
    capacity_note: 'Six points this sprint, because Tomas is out.',
    items: BACKLOG_ITEMS,
    cut_note_prompt: 'What are you going to tell the person who asked for it?',
  },

  spec: {
    headings: SPEC_HEADINGS,
    word_target: 'Aim for 150 to 250 words. There is no minimum and nothing is blocked.',
  },

  revision: {
    /** Fixed text. No model, no branching on what the student wrote. */
    from: 'Priya Raman, Engineering lead',
    message:
      'Two things before you send that round. The duplicate fix is 5 points, not 2. It touches the sync job and that is not a small change, I should have flagged it earlier. So your sprint does not fit. Also I have Mark from sales in my DMs asking what to tell his prospect. What do you want me to say?',
    revised_points: { duplicate_jobs: 5 },
    question: 'What do you want Priya to tell Mark?',
    instruction: 'Rework the spec below. Your first version stays above it.',
  },

  reply: {
    to: 'Mark Deshpande, Sales',
    prompt: 'Write the message you are actually sending Mark.',
    word_limit: 80,
  },

  rubric: RUBRIC,
};

export default NORTHGATE_PM;
