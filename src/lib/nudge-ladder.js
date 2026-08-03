/**
 * Nudge ladders: for every stall kind student-pulse can report, an ordered set
 * of asks from the honest full one down to a single sentence.
 *
 * The rule the whole file exists for: **when they do not do it, ask smaller.**
 * 252 experiments with no steps is not a writing problem. "Run a 30 day
 * experiment" is too big to start, so the answer to a refusal is a smaller ask,
 * not the same ask worded more gently. Every middle rung costs less real time
 * than the one above it and says the time cost out loud, because "ten minutes"
 * is the entire point of a middle rung.
 *
 * Every ladder ends the same way. The second to last rung is one sentence,
 * because answering a question is the smallest proof of work there is and the
 * cheapest reason a 19 year old has to come back. The last rung offers to rule
 * the thing out. There is nowhere else in this product to say "I tried it and I
 * do not want it," and that is the most useful result an experiment produces, so
 * the copy has to mean it rather than guilt them out of it.
 *
 * Four rungs is the standard shape (large, then one genuinely smaller action,
 * then one sentence, then rule out). It is four and not five so that a student
 * who ignores the same thing three passes running lands on a question they can
 * answer in one sentence, rather than on a fourth thing to go do.
 *
 * Pure data plus copy. No SDK import, no clock, no network, relative imports
 * only, so a Deno backend function can import this file as it stands.
 */

/** Sizes from largest ask to smallest. A ladder never goes back up this list. */
export const RUNG_SIZES = ['large', 'medium', 'small', 'one_line'];

/** Longest an `ask_title` may be, filled. The entity says under 60. */
export const MAX_TITLE_CHARS = 59;

/** Routes, kept in one place so a rename in App.jsx is one edit here. */
const R = {
  paths: '/paths',
  newExperiment: '/experiments/new',
  experiments: '/experiments',
  journey: '/journey',
  outreach: '/evidence?tab=outreach',
  proof: '/evidence?tab=proof',
  reflect: '/evidence?tab=reflect',
};

/**
 * The screen for one experiment. `guide_never_acted_on` and
 * `experiment_without_guide` both carry the experiment id as the subject, not
 * the guide id, so /guide?id= cannot be built from a stall.
 */
const expRoute = (stall) => (stall && stall.subjectId
  ? `/experiment?experimentId=${encodeURIComponent(String(stall.subjectId))}`
  : R.experiments);

/**
 * The ladders, keyed by the `kind` field student-pulse puts on a stall.
 *
 * `title` and `body` may use {subject} and {path}, or {Subject} and {Path} at
 * the start of a sentence. `fillRung` substitutes them.
 */
export const LADDERS = {
  no_path_selected: [
    {
      key: 'no_path_selected.r0',
      size: 'large',
      action_kind: 'pick_path',
      title: 'Pick the path you want to test first',
      body: 'You have paths sitting there and none of them is picked. Pick the one you '
        + 'would most regret never finding out about. Picking one does not commit you to '
        + 'it. You are choosing one thing to test and you can stop the test whenever you want.',
      target: R.paths,
    },
    {
      key: 'no_path_selected.r1',
      size: 'small',
      action_kind: 'pick_path',
      title: 'Two minutes: cross off the one you want least',
      body: 'Two minutes. Open the comparison and drop the path you are least interested '
        + 'in. You do not have to pick a winner today. Getting rid of the one you already '
        + 'know is wrong makes the real choice smaller.',
      target: R.paths,
    },
    {
      key: 'no_path_selected.r2',
      size: 'one_line',
      action_kind: 'answer_question',
      title: 'One sentence on what is stopping the pick',
      body: 'One sentence back is enough. It stays on your account, and it is what we use '
        + 'to make the next thing we send you worth reading.',
      question: 'What is making it hard to pick one of these paths?',
      target: '',
    },
    {
      key: 'no_path_selected.r3',
      size: 'one_line',
      action_kind: 'rule_out',
      title: 'Say these are the wrong paths',
      body: 'If none of these is close, say so and we will throw the set out and build a '
        + 'new one from what you tell us. Wrong paths are worth finding out about early, '
        + 'and nothing on your account is lost by saying it.',
      question: 'What is wrong with these paths?',
      target: R.paths,
    },
  ],

  path_without_experiment: [
    {
      key: 'path_without_experiment.r0',
      size: 'large',
      action_kind: 'start_experiment',
      title: 'Set up the first experiment for {path}',
      body: 'You picked {path} and there is nothing under it to actually do. An experiment '
        + 'is the part that tells you whether the path is right for you. Set one up and '
        + 'give it a date you will start.',
      target: R.newExperiment,
    },
    {
      key: 'path_without_experiment.r1',
      size: 'small',
      action_kind: 'start_experiment',
      title: 'Five minutes: name one experiment',
      body: 'Five minutes. Open the setup, write the title of the thing you would test '
        + 'about {path}, and leave the rest blank. Once it has a name you can come back to '
        + 'it. Right now there is nothing to come back to.',
      target: R.newExperiment,
    },
    {
      key: 'path_without_experiment.r2',
      size: 'one_line',
      action_kind: 'answer_question',
      title: 'One sentence about {path}',
      body: 'Answer in one sentence. That is the whole ask this week.',
      question: 'What would you need to see about {path} to know it is worth your time?',
      target: '',
    },
    {
      key: 'path_without_experiment.r3',
      size: 'one_line',
      action_kind: 'rule_out',
      title: 'Close out {path}',
      body: 'If {path} has gone cold, close it and pick something else. Deciding against a '
        + 'path on purpose is a real result, and it is worth more than leaving it open for '
        + 'another month.',
      question: 'What put you off {path}?',
      target: R.paths,
    },
  ],

  // The 237 stall case. This is the ladder that matters most.
  experiment_without_guide: [
    {
      key: 'experiment_without_guide.r0',
      size: 'large',
      action_kind: 'generate_guide',
      title: 'Get the steps for {subject}',
      body: '{Subject} has no steps yet, so there is nothing to start on. Generating them '
        + 'gives you the real sequence: who to write to and what counts as done. Do the '
        + 'first step this week.',
      target: expRoute,
    },
    {
      key: 'experiment_without_guide.r1',
      size: 'medium',
      action_kind: 'generate_guide',
      title: 'Five minutes: read the steps',
      body: 'Five minutes. Generate the steps for {subject} and read them. You do not have '
        + 'to do anything after that. Reading step one is how you find out whether this is '
        + 'the experiment you actually want.',
      target: expRoute,
    },
    {
      key: 'experiment_without_guide.r2',
      size: 'one_line',
      action_kind: 'answer_question',
      title: 'One sentence on what is in the way',
      body: 'One sentence back. Nobody else reads it, and it decides what we send you next.',
      question: 'What is in the way of starting {subject}?',
      target: '',
    },
    {
      key: 'experiment_without_guide.r3',
      size: 'one_line',
      action_kind: 'rule_out',
      title: 'Call {subject} done and move on',
      body: 'If you do not want to run {subject}, close it. Ruling an experiment out is a '
        + 'real answer about the path, and it beats carrying a dead one around. Tell us '
        + 'what put you off and we will set up something else.',
      question: 'What made you drop {subject}?',
      target: R.experiments,
    },
  ],

  guide_never_acted_on: [
    {
      key: 'guide_never_acted_on.r0',
      size: 'large',
      action_kind: 'open_guide',
      title: 'Do step one of {subject}',
      body: 'You have the steps for {subject} and none of them has been run. Step one is '
        + 'the only one that matters right now. Do it this week. The rest of the steps make '
        + 'more sense once you have run the first one.',
      target: expRoute,
    },
    {
      key: 'guide_never_acted_on.r1',
      size: 'medium',
      action_kind: 'open_guide',
      title: 'Twenty minutes on step one',
      body: 'Twenty minutes, then stop, finished or not. Open {subject} and work on the '
        + 'first step until the twenty minutes are up. Stopping on time is part of the ask.',
      target: expRoute,
    },
    {
      key: 'guide_never_acted_on.r2',
      size: 'one_line',
      action_kind: 'answer_question',
      title: 'One sentence on which step is stuck',
      body: 'One sentence back. We will use it to change what the steps ask of you.',
      question: 'Which step of {subject} is the one you keep not doing?',
      target: '',
    },
    {
      key: 'guide_never_acted_on.r3',
      size: 'one_line',
      action_kind: 'rule_out',
      title: 'Close out {subject}',
      body: 'If these steps are not what you want to spend your time on, close them out. '
        + 'Deciding you do not want to do the work is an answer about the path, and it is '
        + 'worth writing down.',
      question: 'What made you stop on {subject}?',
      target: R.experiments,
    },
  ],

  mission_planned_stale: [
    {
      key: 'mission_planned_stale.r0',
      size: 'large',
      action_kind: 'open_guide',
      title: 'Run {subject} this week',
      body: '{Subject} has been on your list a while and has not been started. Pick a day '
        + 'this week and run it. A mission is sized to be done in one sitting.',
      target: R.journey,
    },
    {
      key: 'mission_planned_stale.r1',
      size: 'small',
      action_kind: 'open_guide',
      title: 'Ten minutes on {subject}',
      body: 'Ten minutes on {subject}, then stop. If ten minutes is not enough, stop '
        + 'anyway. Knowing how far you got beats not starting.',
      target: R.journey,
    },
    {
      key: 'mission_planned_stale.r2',
      size: 'one_line',
      action_kind: 'answer_question',
      title: 'One sentence on {subject}',
      body: 'One sentence is the whole ask.',
      question: 'What would make {subject} easy enough to actually do?',
      target: '',
    },
    {
      key: 'mission_planned_stale.r3',
      size: 'one_line',
      action_kind: 'rule_out',
      title: 'Take {subject} off the list',
      body: 'If {subject} is not going to happen, take it off. Taking it off keeps your '
        + 'list down to the things you will actually run. Tell us why and the next mission '
        + 'we write will be smaller.',
      question: 'Why is {subject} not happening?',
      target: R.journey,
    },
  ],

  outreach_never_sent: [
    {
      key: 'outreach_never_sent.r0',
      size: 'large',
      action_kind: 'send_outreach',
      title: 'Send the note to {subject}',
      body: 'You saved {subject} and never sent anything. The draft is already written. '
        + 'Change anything that does not sound like you and send it today.',
      target: R.outreach,
    },
    {
      key: 'outreach_never_sent.r1',
      size: 'small',
      action_kind: 'send_outreach',
      title: 'Two minutes: read the draft',
      body: 'Two minutes. Open the draft for {subject} and read it. If a line does not '
        + 'sound like you, rewrite that line. You do not have to send it today.',
      target: R.outreach,
    },
    {
      key: 'outreach_never_sent.r2',
      size: 'one_line',
      action_kind: 'answer_question',
      title: 'One sentence on what stops the send',
      body: 'One sentence back. If the draft is the problem we will rewrite it. If the '
        + 'person is the problem we will find you someone else to write to.',
      question: 'What stops you from sending the note to {subject}?',
      target: '',
    },
    {
      key: 'outreach_never_sent.r3',
      size: 'one_line',
      action_kind: 'rule_out',
      title: 'Drop {subject} from the list',
      body: 'If writing to {subject} is not going to happen, drop the contact. Cold '
        + 'outreach is not the only way to test a path and it is a bad fit for plenty of '
        + 'people. Say so and we will suggest a different way in.',
      question: 'Why is writing to {subject} not going to happen?',
      target: R.outreach,
    },
  ],

  outreach_no_followup: [
    {
      key: 'outreach_no_followup.r0',
      size: 'large',
      action_kind: 'send_outreach',
      title: 'Follow up with {subject}',
      body: 'You wrote to {subject} and heard nothing. A short follow up is standard '
        + 'practice. Two sentences on top of the original, sent today.',
      target: R.outreach,
    },
    {
      key: 'outreach_no_followup.r1',
      size: 'small',
      action_kind: 'send_outreach',
      title: 'One minute: forward the original',
      body: 'One minute. Forward your original note to {subject} with one line on top '
        + 'saying you are still interested and happy to work around their schedule.',
      target: R.outreach,
    },
    {
      key: 'outreach_no_followup.r2',
      size: 'one_line',
      action_kind: 'answer_question',
      title: 'One sentence: chase or leave it',
      body: 'One sentence back and we will stop asking about this one either way.',
      question: 'Do you want to write to {subject} again, or leave it there?',
      target: '',
    },
    {
      key: 'outreach_no_followup.r3',
      size: 'one_line',
      action_kind: 'rule_out',
      title: 'Mark {subject} as closed',
      body: 'Silence is the most common outcome in cold outreach. Close the contact out so '
        + 'it stops sitting in your list, and we will find you someone else to ask.',
      question: 'What do you want to do instead of chasing {subject}?',
      target: R.outreach,
    },
  ],

  experiment_no_proof: [
    {
      key: 'experiment_no_proof.r0',
      size: 'large',
      action_kind: 'log_proof',
      title: 'Log what you have made on {subject}',
      body: '{Subject} has been open a while with nothing logged against it. Whatever you '
        + 'have made, however rough, put it in. What you log is what you can show someone '
        + 'later.',
      target: R.proof,
    },
    {
      key: 'experiment_no_proof.r1',
      size: 'small',
      action_kind: 'log_proof',
      title: 'Five minutes: log the rough version',
      body: 'Five minutes. Upload the roughest thing you have from {subject}, or a '
        + 'screenshot of it, and write two sentences about what it is. Nobody sees it '
        + 'unless you make it public.',
      target: R.proof,
    },
    {
      key: 'experiment_no_proof.r2',
      size: 'one_line',
      action_kind: 'answer_question',
      title: 'One sentence on what you have done',
      body: 'One sentence back. If the answer is nothing yet, say that. It is still a '
        + 'useful answer.',
      question: 'What have you actually done on {subject} so far?',
      target: '',
    },
    {
      key: 'experiment_no_proof.r3',
      size: 'one_line',
      action_kind: 'rule_out',
      title: 'Close {subject} out',
      body: 'If nothing came of {subject}, close it. An experiment that went nowhere is '
        + 'still an answer about the path, and closing it makes room for one you will '
        + 'actually run.',
      question: 'What happened with {subject}?',
      target: R.experiments,
    },
  ],

  reflection_overdue: [
    {
      key: 'reflection_overdue.r0',
      size: 'large',
      action_kind: 'write_reflection',
      title: 'Write down what {subject} is teaching you',
      body: '{Subject} has been running for over a week and there is nothing written down '
        + 'about it. Write it while you still remember the detail. In three weeks you will '
        + 'have the shape of it and none of the specifics.',
      target: R.reflect,
    },
    {
      key: 'reflection_overdue.r1',
      size: 'small',
      action_kind: 'write_reflection',
      title: 'Five minutes: one paragraph',
      body: 'Five minutes. One paragraph on what surprised you about {subject}. Skip the '
        + 'rest of the prompts.',
      target: R.reflect,
    },
    {
      key: 'reflection_overdue.r2',
      size: 'one_line',
      action_kind: 'answer_question',
      title: 'One sentence on {subject}',
      body: 'One sentence back and we will write it into your reflection for you.',
      question: 'What has {subject} taught you that you did not expect?',
      target: '',
    },
    {
      key: 'reflection_overdue.r3',
      size: 'one_line',
      action_kind: 'rule_out',
      title: 'Call {subject} finished',
      body: 'If {subject} has run its course, call it finished and say what you decided. A '
        + 'clear no is a result you can use.',
      question: 'What did {subject} tell you about the path?',
      target: R.experiments,
    },
  ],

  // Short on purpose. A student who has done nothing for two weeks does not
  // need a graded set of options, they need one honest ask and a way out.
  dormant_account: [
    {
      key: 'dormant_account.r0',
      size: 'large',
      action_kind: 'start_experiment',
      title: 'Pick this back up',
      body: 'You set things up and then nothing happened. Twenty minutes this week gets you '
        + 'to the first real step. If the plan you made no longer fits your semester, '
        + 'change it rather than starting over.',
      target: R.journey,
    },
    {
      key: 'dormant_account.r1',
      size: 'one_line',
      action_kind: 'answer_question',
      title: 'One sentence and we will work with it',
      body: 'One sentence is all we want. It decides whether we send you something smaller '
        + 'or stop sending anything.',
      question: 'What would have to be different for you to pick this back up?',
      target: '',
    },
    {
      key: 'dormant_account.r2',
      size: 'one_line',
      action_kind: 'rule_out',
      title: 'Tell us to stop',
      body: 'If this is not the semester for it, say so and we will stop sending these. '
        + 'Your account stays where it is and you can come back to it whenever.',
      question: 'Do you want us to stop for now?',
      target: R.journey,
    },
  ],
};

/** The ladder for a stall kind, or an empty array for a kind we have no copy for. */
export function ladderFor(kind) {
  const ladder = typeof kind === 'string' ? LADDERS[kind] : null;
  return Array.isArray(ladder) ? ladder : [];
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

/**
 * What to call the thing a stall is about, when the stall does not say.
 * Generic, but written so a sentence built around it still reads.
 */
const GENERIC_SUBJECT = {
  experiment: 'your experiment',
  mission: 'that mission',
  outreach: 'the person you saved',
  path: 'the path you picked',
  account: 'your account',
};

/**
 * Pulling the subject's name back out of a stall label.
 *
 * A Stall carries `subjectId` and a written `label`, and no name field, so the
 * name has to come from the label. These patterns mirror the sentences
 * student-pulse writes today. If that wording changes these stop matching and
 * the copy falls back to the generic noun above, which is the right failure: a
 * slightly vaguer email, not a broken one.
 *
 * The real fix is for a stall to carry the name. `subjectName` is read first for
 * exactly that reason, so a caller that already has the rows in hand (the
 * weekly pass does) can set it and skip all of this.
 */
const LABEL_PATTERNS = [
  /[“"]([^“”"]+)[”"]/,
  /^You picked (.+?) and there is still no experiment under it/,
  /^You saved (.+?) \d+ days? ago/,
  /^You wrote to (.+?) and have not heard back/,
];

/** Names student-pulse writes when it has no name. Worse than the generic noun. */
const PLACEHOLDER_NAMES = ['someone', 'a mission', 'an experiment'];

function subjectFor(stall) {
  const s = stall && typeof stall === 'object' ? stall : {};
  const type = GENERIC_SUBJECT[s.subjectType] ? s.subjectType : 'account';

  const given = str(s.subjectName) || str(s.subject);
  if (given) return { text: given, quoted: false };

  const label = str(s.label);
  for (const pattern of LABEL_PATTERNS) {
    const hit = label.match(pattern);
    const found = hit ? str(hit[1]) : '';
    if (!found || PLACEHOLDER_NAMES.includes(found.toLowerCase())) continue;
    // A quoted title is a title and reads better kept in its quotes. A name
    // lifted out of running prose is a name and does not.
    return { text: found, quoted: pattern === LABEL_PATTERNS[0] };
  }
  return { text: GENERIC_SUBJECT[type], quoted: false };
}

function pathFor(stall, subject) {
  const s = stall && typeof stall === 'object' ? stall : {};
  const given = str(s.pathName);
  if (given) return { text: given, quoted: false };
  if (s.subjectType === 'path') return subject;
  return { text: GENERIC_SUBJECT.path, quoted: false };
}

/** Shortens a string to `max` characters, keeping whole words where it can. */
function clip(value, max) {
  if (value.length <= max) return value;
  const cut = value.slice(0, Math.max(1, max - 1));
  const space = cut.lastIndexOf(' ');
  const kept = space > max / 2 ? cut.slice(0, space) : cut;
  return `${kept.trimEnd()}…`;
}

function render(subject, budget) {
  const body = Number.isFinite(budget) ? clip(subject.text, budget) : subject.text;
  return subject.quoted ? `“${body}”` : body;
}

/** Uppercases the first letter, stepping over an opening quote. */
function capitalize(value) {
  const at = value.search(/[a-zA-Z]/);
  if (at < 0) return value;
  return value.slice(0, at) + value[at].toUpperCase() + value.slice(at + 1);
}

function substitute(template, subjectText, pathText) {
  return String(template)
    .replaceAll('{Subject}', capitalize(subjectText))
    .replaceAll('{subject}', subjectText)
    .replaceAll('{Path}', capitalize(pathText))
    .replaceAll('{path}', pathText);
}

/**
 * A title has a hard length limit and a name can be any length, so the name is
 * shortened until the finished title fits rather than the title being chopped
 * mid word.
 */
function fillTitle(template, subject, path) {
  const full = substitute(template, render(subject), render(path));
  if (full.length <= MAX_TITLE_CHARS) return full;
  for (let budget = 36; budget >= 8; budget -= 4) {
    const tighter = substitute(template, render(subject, budget), render(path, budget));
    if (tighter.length <= MAX_TITLE_CHARS) return tighter;
  }
  return clip(substitute(template, render(subject, 8), render(path, 8)), MAX_TITLE_CHARS);
}

/**
 * One rung with its placeholders filled and its route resolved.
 *
 * @param {object} rung a member of one of the LADDERS arrays
 * @param {object} stall the Stall from readPulse this rung answers
 * @param {object} [pulse] the whole pulse, for targets that need more than the stall
 * @returns {{key:string,size:string,action_kind:string,title:string,body:string,question:string,target:string}}
 */
export function fillRung(rung, stall, pulse) {
  if (!rung || typeof rung !== 'object') {
    return { key: '', size: 'one_line', action_kind: 'answer_question', title: '', body: '', question: '', target: '' };
  }
  const subject = subjectFor(stall);
  const path = pathFor(stall, subject);
  const subjectText = render(subject);
  const pathText = render(path);

  let target = rung.target;
  if (typeof target === 'function') {
    try {
      target = target(stall, pulse);
    } catch {
      target = '';
    }
  }

  return {
    key: str(rung.key),
    size: str(rung.size) || 'one_line',
    action_kind: str(rung.action_kind) || 'answer_question',
    title: fillTitle(rung.title || '', subject, path),
    body: substitute(rung.body || '', subjectText, pathText),
    question: rung.question ? substitute(rung.question, subjectText, pathText) : '',
    target: str(target),
  };
}
