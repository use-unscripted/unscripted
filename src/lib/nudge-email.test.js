import { describe, it, expect } from 'vitest';
import { renderNudgeEmail, DEFAULT_APP_ORIGIN } from './nudge-email.js';
import { LADDERS, fillRung } from './nudge-ladder.js';
import { readPulse } from './student-pulse.js';
import { chooseAsk } from './nudge.js';

const DAY = 86400000;
const BASE = Date.parse('2026-06-01T12:00:00.000Z');
const NOW = new Date(BASE).toISOString();
const at = (d) => new Date(BASE + d * DAY).toISOString();

const ORIGIN = 'https://useunscripted.base44.app';

// The subject types student-pulse attaches to each kind, so a rendered rung
// reads the way a real one will rather than falling back to a generic noun.
const TYPE_FOR = {
  no_path_selected: 'path',
  path_without_experiment: 'path',
  experiment_without_guide: 'experiment',
  guide_never_acted_on: 'experiment',
  mission_planned_stale: 'mission',
  outreach_never_sent: 'outreach',
  outreach_no_followup: 'outreach',
  experiment_no_proof: 'experiment',
  reflection_overdue: 'experiment',
  dormant_account: 'account',
};

const NAME_FOR = {
  experiment: 'Complete a virtual simulation',
  mission: 'Email two analysts',
  outreach: 'Ada Reyes',
  path: 'Product analyst',
  account: '',
};

function stallFor(kind) {
  const subjectType = TYPE_FOR[kind];
  return {
    kind,
    severity: 50,
    subjectId: 'row1',
    subjectName: NAME_FOR[subjectType],
    subjectType,
    pathName: 'Product analyst',
    label: 'Something is stuck.',
    sinceISO: at(-10),
    days: 10,
  };
}

/** Every rung of every ladder, as the ask object chooseAsk would have built. */
function askFor(kind, rungIndex) {
  const rung = LADDERS[kind][rungIndex];
  const stall = stallFor(kind);
  const filled = fillRung(rung, stall);
  return {
    user_id: 'u1',
    pass_number: 1,
    generated_at: NOW,
    stall_kind: kind,
    subject_type: stall.subjectType,
    subject_id: stall.subjectId,
    rung: rungIndex,
    rung_key: filled.key,
    size: filled.size,
    ask_title: filled.title,
    ask_body: filled.body,
    action_kind: filled.action_kind,
    action_target: filled.target,
    question: filled.question,
    status: 'pending',
    delivered_channel: 'none',
    pulse_summary: 'A student who has not started.',
    deletion_status: 'active',
  };
}

const EVERY_ASK = Object.entries(LADDERS).flatMap(([kind, ladder]) => (
  ladder.map((_, i) => ({ kind, rung: i, ask: askFor(kind, i) }))
));

const user = { id: 'u1', email: 'sam@student.fairfield.edu', full_name: 'Sam Okafor', created_date: at(-40) };

const render = (ask, over = {}) => renderNudgeEmail({
  ask, user, appOrigin: ORIGIN, now: NOW, ...over,
});

describe('every rung renders', () => {
  it('produces a subject, a text body and an html body for all of them', () => {
    for (const { kind, rung, ask } of EVERY_ASK) {
      const email = render(ask);
      const where = `${kind}.r${rung}`;
      expect(email.subject.length, where).toBeGreaterThan(0);
      expect(email.text.length, where).toBeGreaterThan(0);
      expect(email.html.startsWith('<div'), where).toBe(true);
      expect(email.html.endsWith('</div>'), where).toBe(true);
    }
  });

  it('puts the ask title in the subject and nothing else', () => {
    for (const { kind, rung, ask } of EVERY_ASK) {
      expect(email(ask).subject, `${kind}.r${rung}`).toBe(ask.ask_title);
    }
    function email(a) { return render(a); }
  });

  it('quotes a subject that is a whole sentence, and leaves a name bare', () => {
    // The subject line went out reading `Get the steps for Complete a virtual
    // simulation`, because an experiment title is a sentence and it ran into
    // ours. A contact's name is not a sentence and quoting it reads as scare
    // quotes, so the two are treated differently on purpose.
    expect(render(askFor('experiment_without_guide', 0)).subject)
      .toBe('Get the steps for “Complete a virtual simulation”');
    expect(render(askFor('mission_planned_stale', 0)).subject)
      .toBe('Run “Email two analysts” this week');
    expect(render(askFor('outreach_never_sent', 0)).subject)
      .toBe('Send the note to Ada Reyes');
    expect(render(askFor('path_without_experiment', 0)).subject)
      .toBe('Set up the first experiment for Product analyst');
  });

  it('never dresses the subject up', () => {
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { subject } = render(ask);
      const where = `${kind}.r${rung}`;
      expect(subject.startsWith('Re:'), where).toBe(false);
      expect(subject.startsWith('Fwd:'), where).toBe(false);
      expect(subject.includes('!'), where).toBe(false);
      // Any emoji, in any of the blocks a subject line bait would come from.
      expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(subject), where).toBe(false);
    }
  });
});

describe('the way out is on every single one', () => {
  it('tells them how to stop, in both bodies, on every rung', () => {
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { text, html } = render(ask);
      const where = `${kind}.r${rung}`;
      expect(text.includes('To stop these emails, turn them off in your settings:'), where).toBe(true);
      expect(html.includes('To stop these emails, turn them off in your settings:'), where).toBe(true);
      expect(text.includes(`${ORIGIN}/settings`), where).toBe(true);
      expect(html.includes(`${ORIGIN}/settings`), where).toBe(true);
    }
  });

  it('never asks anybody to reply, because nothing reads replies', () => {
    // SendEmail has no reply_to, nothing in this repo reads inbound mail, and
    // the sending address is not known to reach a person. Any wording that
    // points a student at their reply button is a promise we cannot keep.
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { subject, text, html } = render(ask);
      const where = `${kind}.r${rung}`;
      for (const body of [subject, text, html]) {
        expect(/repl(y|ies|ying)/i.test(body), where).toBe(false);
        expect(/write back|email us|get back to us|respond to this/i.test(body), where).toBe(false);
      }
    }
  });

  it('keeps the settings link on the origin it was given', () => {
    const { text, html } = render(askFor('dormant_account', 0), { appOrigin: 'https://staging.example.com/' });
    expect(text).toContain('https://staging.example.com/settings');
    expect(html).toContain('https://staging.example.com/settings');
    expect(text).not.toContain(ORIGIN);
  });

  it('falls back to the live app when no origin is given', () => {
    const { text } = renderNudgeEmail({ ask: askFor('dormant_account', 0), user, now: NOW });
    expect(text).toContain(`${DEFAULT_APP_ORIGIN}/settings`);
  });
});

describe('a rung that wants a sentence back', () => {
  const oneLine = askFor('experiment_without_guide', 2);

  it('prints the question on its own line and links to the page that takes it', () => {
    const { text } = render(oneLine);
    expect(text.split('\n\n')).toContain(oneLine.question);
    expect(text).toContain('Answer in one sentence:');
    expect(text).toContain(`${ORIGIN}/answer`);
  });

  it('puts the row id on the link so the page opens on the right question', () => {
    const { text, html } = render(oneLine, { nudgeId: 'nudge-42' });
    expect(text).toContain(`${ORIGIN}/answer?nudgeId=nudge-42`);
    expect(html).toContain(`href="${ORIGIN}/answer?nudgeId=nudge-42"`);
  });

  it('falls back to the bare route when there is no row id', () => {
    const { text } = render(oneLine);
    expect(text).toContain(`${ORIGIN}/answer\n`);
    expect(text).not.toContain('nudgeId=');
  });

  it('does not send them to the to-do screen instead', () => {
    const { text, html } = render(oneLine);
    expect(html).not.toContain('<a href="https://useunscripted.base44.app/experiment');
    expect(text).not.toContain('/experiment?');
    // The answer link and the settings link, and nothing else.
    expect((html.match(/<a /g) || []).length).toBe(2);
  });

  it('does the same on a rule out rung, which also wants words back', () => {
    const ruleOut = askFor('experiment_without_guide', 3);
    expect(ruleOut.action_kind).toBe('rule_out');
    // This rung carries a target as well as a question. The question wins.
    expect(ruleOut.action_target.length).toBeGreaterThan(0);
    const { text } = render(ruleOut, { nudgeId: 'n7' });
    expect(text).toContain(ruleOut.question);
    expect(text).toContain(`${ORIGIN}/answer?nudgeId=n7`);
    expect(text).not.toContain(`${ORIGIN}${ruleOut.action_target}`);
  });

  it('escapes a row id rather than letting it build its own url', () => {
    const { text, html } = render(oneLine, { nudgeId: 'a b&c"d' });
    expect(text).toContain(`${ORIGIN}/answer?nudgeId=a%20b%26c%22d`);
    expect(html).toContain('nudgeId=a%20b%26c%22d');
    expect(html).not.toContain('nudgeId=a b&c"d');
  });
});

describe('a rung that wants a click', () => {
  const linked = askFor('experiment_without_guide', 0);

  it('prints one absolute url that starts with the origin', () => {
    const { text, html } = render(linked);
    const url = `${ORIGIN}${linked.action_target}`;
    expect(linked.action_target.startsWith('/')).toBe(true);
    expect(text).toContain(url);
    expect(html).toContain(`href="${url}"`);
  });

  it('prints an absolute url on every non one_line rung of every ladder', () => {
    for (const { kind, rung, ask } of EVERY_ASK) {
      if (ask.size === 'one_line') continue;
      const { text } = render(ask);
      const where = `${kind}.r${rung}`;
      expect(ask.action_target.length, where).toBeGreaterThan(0);
      expect(text.includes(`${ORIGIN}${ask.action_target}`), where).toBe(true);
    }
  });

  it('sends them to the thing itself, not to the answer page', () => {
    const { text } = render(linked, { nudgeId: 'n1' });
    expect(text).not.toContain('/answer');
    expect(text).toContain('Generate the steps:');
  });
});

describe('hostile text does not escape into the html', () => {
  // A student's own name and a model written experiment title. Both are free
  // text and both end up inside a mail client that will run what it is given.
  const nasty = {
    ...askFor('experiment_without_guide', 0),
    ask_title: 'Get the steps for <script>alert("x")</script> & "friends"',
    ask_body: "Tom's <script>alert(1)</script> <b>bold</b> plan & a curly ’ apostrophe",
    question: 'What about <em>this</em> & that?',
    action_target: '/experiment?experimentId=a"b&c',
  };
  const nastyUser = { id: 'u1', email: 'x@y.edu', full_name: '<img src=x onerror=alert(1)> Sam' };

  it('escapes the five characters that mean something to a parser', () => {
    const { html } = renderNudgeEmail({ ask: nasty, user: nastyUser, appOrigin: ORIGIN, now: NOW });
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&#39;');
    // The url goes into an attribute, so its quote and ampersand have to go too.
    expect(html).toContain('experimentId=a&quot;b&amp;c');
  });

  it('throws away a name that is not a name rather than escaping it into view', () => {
    const { text, html } = renderNudgeEmail({ ask: nasty, user: nastyUser, appOrigin: ORIGIN, now: NOW });
    expect(text.startsWith('Hi,')).toBe(true);
    expect(html).toContain('>Hi,<');
  });

  it('leaves the subject exactly as the ask wrote it, because it is not markup', () => {
    const { subject } = renderNudgeEmail({ ask: nasty, user: nastyUser, appOrigin: ORIGIN, now: NOW });
    expect(subject).toBe(nasty.ask_title);
  });

  it('leaves a curly apostrophe alone, because it is correct and safe', () => {
    const { html, text } = renderNudgeEmail({ ask: nasty, user: nastyUser, appOrigin: ORIGIN, now: NOW });
    expect(html).toContain('curly ’ apostrophe');
    expect(text).toContain('curly ’ apostrophe');
  });

  it('leaves the plain text body unescaped, because it is not markup', () => {
    const { text } = renderNudgeEmail({ ask: nasty, user: nastyUser, appOrigin: ORIGIN, now: NOW });
    expect(text).toContain('<b>bold</b>');
    expect(text).not.toContain('&amp;');
  });
});

describe('the house rule on dashes holds even when the input breaks it', () => {
  it('has no em dash and no en dash in any rendered output', () => {
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { subject, text, html } = render(ask);
      // The two characters on this line are the only ones in the file and they
      // are inside the rule that bans them. Same exception as PLAIN_PROSE_RULES.
      const dashes = /[—–]/;
      expect(dashes.test(subject), `${kind}.r${rung} subject`).toBe(false);
      expect(dashes.test(text), `${kind}.r${rung} text`).toBe(false);
      expect(dashes.test(html), `${kind}.r${rung} html`).toBe(false);
    }
  });

  it('takes one out of a student written title rather than passing it on', () => {
    const ask = {
      ...askFor('experiment_without_guide', 0),
      ask_title: 'Shadow an analyst — for a week',
      ask_body: 'Days 1–3 are the ones that matter.',
    };
    const { subject, text } = renderNudgeEmail({ ask, user, appOrigin: ORIGIN, now: NOW });
    expect(subject).toBe('Shadow an analyst, for a week');
    expect(text).toContain('Days 1-3 are the ones that matter.');
  });
});

describe('the greeting', () => {
  it('uses the first name when there is one', () => {
    expect(render(askFor('dormant_account', 0)).text.startsWith('Hi Sam,')).toBe(true);
  });

  it('greets without a name rather than leaving a hole', () => {
    for (const u of [null, {}, { id: 'u1', full_name: '   ' }, { id: 'u1', full_name: 'sam@x.edu' }]) {
      const { text } = renderNudgeEmail({ ask: askFor('dormant_account', 0), user: u, appOrigin: ORIGIN, now: NOW });
      expect(text.startsWith('Hi,')).toBe(true);
    }
  });
});

describe('nothing in the email came from outside the ask', () => {
  it('prints no date, no number of students, and no deadline', () => {
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { text } = render(ask);
      const where = `${kind}.r${rung}`;
      expect(/\b20\d\d-\d\d-\d\d\b/.test(text), where).toBe(false);
      expect(/\bby (Friday|Monday|tomorrow)\b/i.test(text), where).toBe(false);
      expect(/other students/i.test(text), where).toBe(false);
    }
  });

  it('renders an ask that came out of the real engine, not a fixture', () => {
    // End to end through stage 1 and stage 2, so a change to either that makes
    // an unrenderable ask fails here rather than in somebody's inbox.
    const pulse = readPulse({
      now: NOW,
      user,
      paths: [{ id: 'p1', path_name: 'Product analyst', is_primary_focus: true, status: 'active', created_date: at(-40) }],
      experiments: [{ id: 'e1', title: 'Shadow a product analyst', path_id: 'p1', status: 'planned', created_date: at(-30) }],
    });
    const ask = chooseAsk({ pulse, history: [], now: NOW, passNumber: 1, userId: 'u1' });
    expect(ask).toBeTruthy();
    const { subject, text } = renderNudgeEmail({ ask, user, appOrigin: ORIGIN, now: NOW });
    expect(subject).toBe(ask.ask_title);
    expect(text).toContain(ask.ask_body);
    expect(text).toContain('To stop these emails, turn them off in your settings:');
  });
});

// NOTHING SENDS THE HTML BODY. SendEmail takes plain text only, so the backend
// function renders `html` and drops it. These tests keep the escaping and the
// dark mode handling honest for the day a provider can carry one. None of them
// covers anything a student receives today: that is `text`, above.
describe('the html body, which is not sent to anybody today', () => {
  const { html } = render(askFor('experiment_without_guide', 0));

  it('loads nothing from anywhere', () => {
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('@import');
    expect(html).not.toContain('class=');
    expect(html).not.toContain('<table');
  });

  it('sets no colour and no background, so a dark client can invert it', () => {
    // A hard coded colour is how black text ends up on a black card. The two
    // colours the file does set are `inherit` and `currentColor`, which are the
    // client's own.
    expect(html).not.toContain('background');
    expect(/color:(?!inherit)/.test(html.replace(/currentColor/g, ''))).toBe(false);
  });
});
