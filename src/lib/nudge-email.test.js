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
      expect(email.html.startsWith('<!doctype html>'), where).toBe(true);
      expect(email.html.endsWith('</html>'), where).toBe(true);
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
    // The two bodies say the same sentence and hand over the link differently.
    // Plain text can only print a url, so it prints the whole one. The html
    // puts the link on the word `settings` and drops the colon, because a colon
    // introduces something and there is nothing after it there to introduce.
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { text, html } = render(ask);
      const where = `${kind}.r${rung}`;
      expect(text.includes('To stop these emails, turn them off in your settings:'), where).toBe(true);
      expect(text.includes(`${ORIGIN}/settings`), where).toBe(true);
      expect(html.includes('To stop these emails, turn them off in your '), where).toBe(true);
      expect(html.includes(`href="${ORIGIN}/settings"`), where).toBe(true);
      expect(/href="[^"]*\/settings"[^>]*>settings<\/a>/.test(html), where).toBe(true);
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
    // The one img in the mail is the wordmark. The one in the name is not.
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('onerror');
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

// NOTHING SENDS THE HTML BODY YET. SendEmail takes plain text only, so the
// backend function renders `html` and drops it. These tests are what stops it
// being rebuilt from scratch, badly, against a live sender on the day one
// arrives. What a student receives today is `text`, above.

const LOGO = 'https://media.base44.com/images/public/6a591b5064fe15dff1df6a81/5b5919d9f_unscripted-wordmark-transparent.png';

/** Every tag in the document, so one attribute can be looked at on its own. */
const tagsOf = (html) => html.match(/<[^>]*>/g) || [];

/**
 * A tag with its quoted values emptied, leaving the attribute names.
 *
 * `onmouseover=` sitting inside `href="…"` is a string. `onmouseover=` sitting
 * next to `href` is a handler. The difference is the quoting, so the quoting
 * comes off before anything looks for a handler, and a separate assertion
 * checks the quotes are balanced in the first place.
 */
const tagSkeleton = (tag) => tag.replace(/"[^"]*"/g, '""');

/** What a reader actually sees: no markup, no style block, entities turned back. */
function visibleText(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

/** The same five replacements the renderer makes, so a fixture can be compared. */
const esc = (s) => String(s)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

/** The url the plain text body prints for the action, taken from the text itself. */
function actionUrlOf(text) {
  const blocks = text.split('\n\n');
  return blocks[blocks.length - 2];
}

const WANTS_ANSWER = ['answer_question', 'rule_out'];
const wantsQuestion = (ask) => ask.size === 'one_line' || WANTS_ANSWER.includes(ask.action_kind);

describe('the html body, which is not sent to anybody today', () => {
  it('carries the wordmark, with alt text and a box reserved for it', () => {
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { html } = render(ask);
      const where = `${kind}.r${rung}`;
      const imgs = tagsOf(html).filter((t) => t.startsWith('<img'));
      expect(imgs.length, where).toBe(1);
      expect(imgs[0].includes(`src="${LOGO}"`), where).toBe(true);
      // Alt text, and a real word rather than an empty attribute: this is the
      // header for every reader whose client blocks images, which is a lot of
      // them, so it has to degrade to the brand name and not to nothing.
      const alt = imgs[0].match(/\salt="([^"]*)"/);
      expect(alt, where).toBeTruthy();
      expect(alt[1].trim().length, where).toBeGreaterThan(0);
      expect(alt[1], where).toBe('Unscripted');
      // Both intrinsic attributes, or the client has no aspect ratio to hold
      // space with and the whole mail jumps when the image lands.
      expect(/\swidth="\d+"/.test(imgs[0]), where).toBe(true);
      expect(/\sheight="\d+"/.test(imgs[0]), where).toBe(true);
    }
  });

  it('is still a complete email with every image blocked', () => {
    // Nothing but the wordmark is an image, so with images off a reader still
    // has the greeting, the ask, the button (a background colour on a table
    // cell, which no client blocks) and the way out.
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { html } = render(ask, { nudgeId: 'n1' });
      const where = `${kind}.r${rung}`;
      expect((html.match(/<img/g) || []).length, where).toBe(1);
      expect(html.includes('background-image'), where).toBe(false);
      const seen = visibleText(html);
      expect(seen.includes('Hi Sam,'), where).toBe(true);
      expect(seen.includes(ask.ask_body), where).toBe(true);
      expect(seen.includes('To stop these emails'), where).toBe(true);
    }
  });

  it('puts the action in an href and never prints a url as words', () => {
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { text, html } = render(ask, { nudgeId: 'n1' });
      const where = `${kind}.r${rung}`;
      const url = actionUrlOf(text);
      expect(url.startsWith(ORIGIN), where).toBe(true);
      expect(html.includes(`href="${esc(url)}"`), where).toBe(true);
      // Nothing a reader can see is a url. Not the action, not the settings
      // link, not a bare origin. A wall of query string in an inbox is the
      // clearest tell there is of mail nobody designed.
      const seen = visibleText(html);
      expect(seen.includes('http'), where).toBe(false);
      expect(seen.includes(ORIGIN), where).toBe(false);
      expect(seen.includes('/settings'), where).toBe(false);
      expect(seen.includes(url), where).toBe(false);
    }
  });

  it('gives every rung one button, and the question only to the rungs that ask one', () => {
    // Deliberate: a question rung gets the question AND the button. The button
    // is the only way to reach the answer page once the html stops printing
    // urls, so dropping it there would leave the twenty rungs whose whole ask is
    // a sentence with no way to send one.
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { html } = render(ask, { nudgeId: 'n1' });
      const where = `${kind}.r${rung}`;
      // The bulletproof button: a table cell with its own background, padding
      // Word honours, and the label inside it. One per rung, never zero.
      expect((html.match(/mso-padding-alt/g) || []).length, where).toBe(1);
      expect(html.includes('bgcolor="#D6B66A"'), where).toBe(true);
      // The button and the settings link. No third anchor, and no url printed.
      expect((html.match(/<a /g) || []).length, where).toBe(2);

      const asksQuestion = wantsQuestion(ask);
      expect(html.includes('border-left:4px solid'), where).toBe(asksQuestion);
      if (asksQuestion) {
        expect(ask.question.length, where).toBeGreaterThan(0);
        expect(html.includes(esc(ask.question)), where).toBe(true);
        // Visually distinct from the body copy, not another paragraph of it.
        expect(/font-size:18px;line-height:1.5;font-weight:600/.test(html), where).toBe(true);
      } else {
        expect(ask.question, where).toBe('');
      }
    }
  });

  it('leaves the question off a rung that wants a click, the way the text does', () => {
    // An ask can carry a target and a question at once. On a rung that wants
    // the click the click wins, and both bodies have to agree about that or a
    // student reads one ask in the preview pane and a different one in the mail.
    const both = { ...askFor('experiment_without_guide', 0), question: 'Which part is stuck?' };
    const { text, html } = render(both, { nudgeId: 'n1' });
    expect(text).not.toContain('Which part is stuck?');
    expect(html).not.toContain('Which part is stuck?');
    expect(html).not.toContain('border-left:4px solid');
  });

  it('reads at 16px with room to breathe', () => {
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { html } = render(ask);
      const where = `${kind}.r${rung}`;
      expect(html.includes('font-size:16px;line-height:1.6'), where).toBe(true);
      // Nothing a student reads is under 13px, and 13px is the footer only.
      for (const size of html.match(/font-size:(\d+)px/g) || []) {
        expect(Number(size.match(/\d+/)[0]), `${where} ${size}`).toBeGreaterThanOrEqual(13);
      }
      expect(html.includes('max-width:600px'), where).toBe(true);
    }
  });

  it('sets both halves of the contrast, in light and in dark', () => {
    // A background with no colour on it, or a colour with no background under
    // it, is how dark text lands on a dark card. Both are set, in both modes.
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { html } = render(ask);
      const where = `${kind}.r${rung}`;
      expect(html.includes('name="color-scheme" content="light dark"'), where).toBe(true);
      expect(html.includes('color-scheme:light dark'), where).toBe(true);
      expect(html.includes('background-color:#F7F9FB'), where).toBe(true);
      expect(html.includes('background-color:#FFFFFF'), where).toBe(true);
      expect(html.includes('color:#16202E'), where).toBe(true);
      expect(html.includes('@media (prefers-color-scheme:dark)'), where).toBe(true);
      expect(html.includes('.u-page{background-color:#050816!important;}'), where).toBe(true);
      expect(html.includes('.u-card{background-color:#07111F!important'), where).toBe(true);
      expect(html.includes('.u-text{color:#EDF1F5!important;}'), where).toBe(true);
      // The dark block has to have something to act on, so the hooks it names
      // are on the document too.
      for (const hook of ['u-page', 'u-card', 'u-text', 'u-quiet', 'u-logo']) {
        expect(html.includes(`class="${hook}`) || html.includes(` ${hook}"`), `${where} ${hook}`).toBe(true);
      }
    }
  });

  it('is laid out in tables with inline styles, because Outlook is', () => {
    const { html } = render(askFor('experiment_without_guide', 0));
    expect(html).toContain('<table role="presentation"');
    expect(html).not.toContain('display:flex');
    expect(html).not.toContain('display:grid');
    expect(html).not.toContain('position:absolute');
  });

  it('loads one file, the wordmark, and nothing else at all', () => {
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { html } = render(ask, { nudgeId: 'n1' });
      const where = `${kind}.r${rung}`;
      expect((html.match(/src="/g) || []).length, where).toBe(1);
      expect(html.includes('<link'), where).toBe(false);
      expect(html.includes('@import'), where).toBe(false);
      expect(html.includes('url('), where).toBe(false);
      expect(html.includes('<iframe'), where).toBe(false);
      // No tracking pixel and no click wrapping: every remote address in the
      // document is the wordmark or a link back into our own app.
      for (const found of html.match(/https?:\/\/[^"' )]+/g) || []) {
        expect(found === LOGO || found.startsWith(ORIGIN), `${where} ${found}`).toBe(true);
      }
    }
  });

  it('runs nothing, on any rung', () => {
    for (const { kind, rung, ask } of EVERY_ASK) {
      const { html } = render(ask, { nudgeId: 'n1' });
      const where = `${kind}.r${rung}`;
      expect(html.includes('<script'), where).toBe(false);
      expect(html.includes('javascript:'), where).toBe(false);
      expect(html.includes('onerror'), where).toBe(false);
      for (const tag of tagsOf(html)) {
        expect(/\son[a-z]+\s*=/i.test(tagSkeleton(tag)), `${where} ${tag}`).toBe(false);
      }
    }
  });
});

describe('hostile text cannot break out of the html, in either context', () => {
  // Two different escapes, because they are two different jobs. Between two
  // tags a `<` starts a tag. Inside `href="…"` a `"` ends the value and
  // everything after it becomes attributes, which is how a title with a quote
  // in it writes an event handler.
  const benign = askFor('experiment_without_guide', 2);

  const textAttack = {
    ...benign,
    ask_body: '</td></tr></table><script>alert(1)</script><td>',
    question: '</table><img src=x onerror=alert(1)><table>',
  };
  const attrAttack = {
    ...askFor('experiment_without_guide', 0),
    ask_body: 'a quote " and then onmouseover=alert(1) x="',
    ask_title: 'Title with " and & and <b>',
    action_target: '/experiment?experimentId=1" onmouseover="alert(1)',
  };
  const attackUser = { id: 'u1', email: 'x@y.edu', full_name: '"><script>alert(1)</script>' };

  const rendered = (ask, u = user) => renderNudgeEmail({
    ask, user: u, appOrigin: ORIGIN, now: NOW, nudgeId: 'n1',
  }).html;

  it('opens no tag of its own from a text node', () => {
    // The strongest form of this: hostile input adds no tags at all. Same
    // document shape as a clean render, character for character in structure.
    const clean = tagsOf(rendered(benign));
    const dirty = tagsOf(rendered(textAttack, attackUser));
    expect(dirty.length).toBe(clean.length);
    const html = rendered(textAttack, attackUser);
    expect(html).not.toContain('<script');
    // `onerror` survives as the four words a reader sees. It is inert there:
    // what would make it a handler is a tag, and the input opened none.
    for (const tag of dirty) expect(/\son[a-z]+\s*=/i.test(tagSkeleton(tag)), tag).toBe(false);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;/table&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('opens no attribute of its own from inside an attribute', () => {
    const html = rendered(attrAttack, attackUser);
    for (const tag of tagsOf(html)) {
      // Every attribute value is closed. An odd number of quotes in a tag means
      // one of them came from the input and ended a value early.
      expect((tag.match(/"/g) || []).length % 2, tag).toBe(0);
      expect(/\son[a-z]+\s*=/i.test(tagSkeleton(tag)), tag).toBe(false);
    }
    expect(html).toContain('experimentId=1&quot; onmouseover=&quot;alert(1)');
    expect(html).not.toContain('experimentId=1" onmouseover="alert(1)');
  });

  it('strips the characters a url parser drops before it parses', () => {
    // A url parser removes tab, newline and carriage return and only then looks
    // for a scheme, so those characters can hide one from a check that ran
    // first. There is no attribute here they belong in, so they go.
    const sneaky = { ...benign, action_target: '/answer\t?x=1' };
    const html = renderNudgeEmail({ ask: sneaky, user, appOrigin: ORIGIN, now: NOW, nudgeId: 'n1' }).html;
    expect(html).not.toContain('\t');
    expect(html).not.toContain('\n');
  });

  it('links nothing that is not our own app', () => {
    // The only way an off origin url reaches the renderer is an ask whose
    // target was already absolute. Plain text prints whatever it was handed,
    // because a printed url is inert. An href is not.
    for (const target of ['https://evil.example.com/x', 'http://evil.example.com']) {
      const html = renderNudgeEmail({
        ask: { ...askFor('experiment_without_guide', 0), action_target: target },
        user, appOrigin: ORIGIN, now: NOW,
      }).html;
      expect(html).not.toContain('evil.example.com');
      for (const found of html.match(/https?:\/\/[^"' )]+/g) || []) {
        expect(found === LOGO || found.startsWith(ORIGIN), found).toBe(true);
      }
    }
  });

  it('has no em dash and no en dash in the html either, however it got in', () => {
    const dashed = {
      ...benign,
      ask_body: 'Shadow an analyst — for a week, days 1–3.',
      question: 'What is in the way — really?',
    };
    const html = renderNudgeEmail({ ask: dashed, user, appOrigin: ORIGIN, now: NOW }).html;
    // The two characters on this line are inside the rule that bans them.
    expect(/[—–]/.test(html)).toBe(false);
    // A dash between two digits is a range and becomes a hyphen. Anywhere else
    // it was doing the job of a comma, so it becomes one.
    expect(html).toContain('Shadow an analyst, for a week, days 1-3.');
    expect(html).toContain('What is in the way, really?');
  });
});
