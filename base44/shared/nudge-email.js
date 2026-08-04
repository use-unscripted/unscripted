/**
 * Turning one ask into one email.
 *
 * This is the only file in the stack whose output a 19 year old at Fairfield
 * reads in their inbox, and whose output a university career services buyer
 * reads when a student forwards it to ask "is this spam". Both of those are the
 * same test, so the rules are the same for both:
 *
 * - **The subject line is the ask title and nothing else.** No "Re:", no fake
 *   threading, no emoji, no "quick question". A subject line that misrepresents
 *   what is inside loses a buyer on the first forward, and it is the cheapest
 *   thing in the whole product to get wrong.
 * - **Nothing in the email comes from anywhere except the ask and the user
 *   row.** No statistic, no deadline, no name, no claim about what other
 *   students did. If it is not on one of those two objects it does not go in.
 * - **Every email ends with a plain way to stop.** We are writing to students at
 *   a school we want to sell to. There is no version of this where the opt out
 *   is missing or coy.
 * - **Nothing in the email asks for a reply.** SendEmail takes `to`, `subject`,
 *   `body` and `from_name`. There is no reply-to address to set, nothing in
 *   this app reads inbound mail, and whether the sending address reaches a
 *   person at all is unverified. So every ask, including the ones whose whole
 *   point is a sentence back, is answered on a page in the app. Asking a
 *   student to reply to an address nobody is reading is the kind of promise
 *   that loses the university, not just the student.
 * - **No date is printed anywhere on purpose.** A date is either a deadline we
 *   cannot enforce or a "3 days ago" that is wrong by the time it is read.
 *   `now` is taken as a parameter so a caller does not have to know that, and
 *   so a later version can use it without changing every call site.
 *
 * ## `text` is the email today. `html` is not sent to anybody yet.
 *
 * Base44's SendEmail takes `{to, subject, body, from_name}`, and `body` is
 * plain text. So `text` is the entire thing a student sees, and `html` goes
 * nowhere: the backend function renders it, throws it away, and never has an
 * argument to put it in. It is kept, and tested, because the copy and the
 * escaping should already be right on the day the send path can carry one, and
 * because rebuilding it later against a live sender is how a bug reaches an
 * inbox. If you are changing what a student reads today, change `text`.
 *
 * ## The two bodies say the same thing and print links differently
 *
 * Plain text has one way to give somebody a link, which is to print it, so
 * `text` prints the whole url. HTML has a better one, so `html` never prints a
 * url as words: the action is a button and the opt out is the word `settings`
 * carrying the link. A wall of query string in an inbox is the single clearest
 * tell of mail nobody designed, and this is mail a student may forward to a
 * career services office.
 *
 * ## Rules for the HTML, all of which have a client behind them
 *
 * - **Tables for layout, inline styles for everything that matters.** Outlook
 *   renders through Word, which has no flexbox, no grid and no float worth
 *   using. Gmail strips a `<style>` block in enough situations that nothing may
 *   depend on one. The block here is dark mode and one width rule, and the mail
 *   is correct without it.
 * - **One remote file, the wordmark, and no second one ever.** No tracking
 *   pixel, no open tracking, no click wrapping. We are selling to universities.
 * - **The mail has to be complete with images off**, because plenty of clients
 *   block them by default. The wordmark carries real alt text, the button is a
 *   background colour on a table cell rather than an image, and nothing else is
 *   loaded at all.
 * - **Colours are set explicitly on both the background and the text**, on
 *   every element that has either. Setting one and not the other is exactly how
 *   dark text lands on a dark card. A `prefers-color-scheme` block swaps the
 *   surfaces for the clients that honour it, and the clients that invert on
 *   their own still have two real colours to work from.
 *
 * Pure. No SDK, no clock, no network, relative and extension qualified imports
 * only, so a Deno backend function can import this file as it stands.
 */
import { internalRoute } from './nudge-response.js';

/** Where the links point when a caller does not say. The live app. */
export const DEFAULT_APP_ORIGIN = 'https://useunscripted.base44.app';

/**
 * The route the opt out line sends people to.
 *
 * This page has to carry a switch that stops these emails. It does not carry
 * one yet, so the line below is a commitment on whoever builds it.
 */
export const SETTINGS_PATH = '/settings';

/**
 * The route that takes a student's sentence.
 *
 * The bottom two rungs of every ladder are a question, and the answer is the
 * whole ask. There is no inbound mail to collect it, so it is collected on a
 * page instead: `/answer?nudgeId=<the StudentNudge row>`. That page has to show
 * the question, take one box of text, and let them accept or decline. Without
 * an id the bare route has to fall back to whatever ask is open on the account,
 * because a mail client can mangle a query string.
 */
export const ANSWER_PATH = '/answer';

/**
 * The line under every email, in both bodies.
 *
 * It points at the settings page because nothing here reads replies, and an opt
 * out a student cannot actually reach is worse than none at all.
 */
const STOP_SENTENCE = 'To stop these emails, turn them off in your settings:';

/**
 * The word in that sentence that carries the link in the HTML body.
 *
 * The plain text body prints the settings url after the colon because printing
 * it is the only thing plain text can do. The HTML body puts the link on this
 * word and drops the colon, because a colon introduces something and in the
 * HTML there is nothing after it to introduce. Same sentence, same promise, and
 * the HTML version is built out of the constant above rather than written out a
 * second time, so the two cannot say different things.
 */
const STOP_LINK_WORD = 'settings';

/**
 * The wordmark, and the only file this email loads from anywhere.
 *
 * Same asset the app's header uses, hosted on media.base44.com and public, so a
 * mail client can fetch it. 1024x512 in the file, drawn here at half of a
 * quarter of that, and both attributes are set because a client that has not
 * downloaded it yet needs a box to reserve. Images are off by default in plenty
 * of inboxes, so the alt text is the real header for a lot of readers and is
 * styled to look like one.
 */
const LOGO_SRC = 'https://media.base44.com/images/public/6a591b5064fe15dff1df6a81/5b5919d9f_unscripted-wordmark-transparent.png';
const LOGO_WIDTH = 200;
const LOGO_HEIGHT = 100;

/**
 * The brand, as hex, because an email cannot read a CSS variable.
 *
 * These are `docs/design.md` and `src/index.css` copied by hand: navy, gold and
 * the navy tinted neutral ramp. Gold is an accent and never body text, with the
 * one exception the brand already makes, which is a single primary button, navy
 * on gold. That button is the one below.
 *
 * The dark values are the app's own dark surfaces and the two rungs of the ramp
 * that are legible on them. They are used only inside the media query.
 */
const C = {
  page: '#F7F9FB',
  card: '#FFFFFF',
  border: '#DDE3EA',
  text: '#16202E',
  quiet: '#4C5B6F',
  navy: '#1F3A5F',
  gold: '#D6B66A',
  quote: '#F7F9FB',
  darkPage: '#050816',
  darkCard: '#07111F',
  darkQuote: '#0E1B2B',
  darkBorder: '#2E3D50',
  darkText: '#EDF1F5',
  darkQuiet: '#AEB9C6',
};

/** No web font. Two of these ship with the clients that matter and the rest are the fallback. */
const FONT = '-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif';

/**
 * The only rules that are not inline, and nothing depends on them.
 *
 * Dark mode cannot be written inline: there is no inline form of a media query.
 * So the light values are inline and correct on their own, and this block swaps
 * the surfaces underneath them in the clients that honour the query. The
 * wordmark is navy art on transparency and would vanish on a dark card, so it
 * is knocked out to white in the same breath.
 *
 * The second query is the phone. 600px of card inside 32px of padding is fine
 * on a laptop and tight on a handset, so the padding comes in and nothing else
 * moves.
 */
const EMBEDDED_CSS = [
  `:root{color-scheme:light dark;supported-color-schemes:light dark;}`,
  '@media (prefers-color-scheme:dark){',
  `.u-page{background-color:${C.darkPage}!important;}`,
  `.u-card{background-color:${C.darkCard}!important;border-color:${C.darkBorder}!important;}`,
  `.u-text{color:${C.darkText}!important;}`,
  `.u-quiet{color:${C.darkQuiet}!important;}`,
  `.u-quote{background-color:${C.darkQuote}!important;}`,
  `.u-rule{border-top-color:${C.darkBorder}!important;}`,
  `.u-link{color:${C.gold}!important;}`,
  '.u-logo{filter:brightness(0) invert(1);}',
  '}',
  '@media only screen and (max-width:620px){',
  '.u-pad{padding-left:20px!important;padding-right:20px!important;}',
  `.u-logo{width:160px!important;height:80px!important;}`,
  '}',
].join('');

/**
 * The rungs whose ask is a question rather than a click.
 *
 * Size is the field that says so, but `rule_out` rungs are the ones that matter
 * most here and the ladder could grow one at another size, so the action kind is
 * checked too. Getting this wrong sends a student to a to-do screen when we
 * asked them a question, and the question is the entire ask on those rungs.
 */
const ANSWER_ACTIONS = ['answer_question', 'rule_out'];

/** What the answer link says above the url. */
const ANSWER_LABEL = 'Answer in one sentence';

/** The short line above the link, per action kind. Says what the link is for. */
const LINK_LABELS = {
  generate_guide: 'Generate the steps',
  open_guide: 'Open the steps',
  send_outreach: 'Open the draft',
  log_proof: 'Log what you have',
  write_reflection: 'Write it down',
  pick_path: 'Compare the paths',
  start_experiment: 'Set it up',
};
const DEFAULT_LINK_LABEL = 'Open it';

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

/**
 * House rule, enforced at the last possible moment.
 *
 * Our own copy has no em or en dash in it. A student's experiment title and a
 * contact's name are free text, and one of them will have a dash in it sooner
 * or later. Between two digits it is a range and becomes a hyphen. Anywhere
 * else it is doing the job of a comma, so it becomes one.
 */
function plainDashes(value) {
  return String(value)
    .replace(/(\d)\s*[—–]\s*(\d)/g, '$1-$2')
    .replace(/\s*[—–]\s*/g, ', ');
}

/**
 * Everything interpolated into a text node of the HTML goes through here.
 *
 * Titles and bodies are model written and names are student written, so both
 * are hostile input as far as this file is concerned. Only the five characters
 * that mean something to a parser are touched: a curly apostrophe is correct
 * typography, is the house exception, and stays exactly as it is.
 *
 * `"` and `'` do not strictly need escaping between two tags. They are escaped
 * anyway so that one function is safe in both places and a value that later
 * moves into an attribute does not quietly become an injection.
 */
function escapeText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Everything interpolated into an attribute goes through here instead.
 *
 * An attribute is not a text node and the difference is not academic. Inside
 * `href="…"` a bare `"` ends the value and the rest of the string becomes
 * attributes, so a title with a quote in it can write `onmouseover=`. And a
 * url parser drops tab, newline and carriage return before it parses, so those
 * characters can hide a scheme from a check that ran before the parser did:
 * they are removed rather than escaped, because there is no attribute here they
 * belong in.
 */
function escapeAttr(value) {
  return escapeText(String(value).replace(/[\t\n\r\f\v\0]/g, ''));
}

/**
 * The href an anchor is allowed to carry, or '' for no link at all.
 *
 * Every url this file builds is the origin followed by a route, so the only way
 * an off origin one reaches here is an ask whose `action_target` was already
 * absolute. `text` prints whatever it was given, because a printed url is
 * inert. An href is not inert, so it has to be ours: the origin, then a route
 * `internalRoute` accepts. That is the same guard the answer page navigates
 * through, imported rather than restated so the two cannot drift apart.
 */
function safeHref(origin, url) {
  const value = str(url);
  const base = str(origin);
  if (!base || !value.startsWith(`${base}/`)) return '';
  return internalRoute(value.slice(base.length)) ? value : '';
}

/**
 * An absolute link, or '' when there is nothing to link to.
 *
 * A target that is already absolute is left alone. Anything else is hung off
 * the origin, which is where the student's session is.
 */
function absoluteUrl(appOrigin, target) {
  const path = str(target);
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const origin = (str(appOrigin) || DEFAULT_APP_ORIGIN).replace(/\/+$/, '');
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * A name is a letter followed by letters, a hyphen or an apostrophe. Anything
 * else in the field is not a first name.
 */
const LOOKS_LIKE_A_NAME = /^\p{L}[\p{L}'’-]*$/u;

/**
 * What to call them.
 *
 * First name only, and only when the field holds something that is actually a
 * name. `full_name` on these rows has held an email address, a blank, and a
 * pasted string with markup in it. Escaping makes all three safe and none of
 * them readable, and "Hi <img," in the first line of an email to a student is
 * worse than no name at all.
 */
function firstNameOf(user) {
  const source = user && typeof user === 'object'
    ? (str(user.first_name) || str(user.full_name) || str(user.name))
    : '';
  const first = source.split(/\s+/)[0] || '';
  return LOOKS_LIKE_A_NAME.test(first) ? first : '';
}

/**
 * One ask, as an email.
 *
 * `nudgeId` is the id of the StudentNudge row this ask was written to, so the
 * answer page can open on the right question. The backend function creates the
 * row first and passes the id here.
 *
 * The returned `html` is not sent anywhere today. See the note at the top of
 * the file: `text` is the email.
 *
 * @param {{ask: object, user?: object|null, appOrigin?: string, now?: any,
 *   nudgeId?: string}} input
 * @returns {{subject: string, text: string, html: string}}
 */
export function renderNudgeEmail(input = {}) {
  const { ask, user = null, appOrigin, nudgeId } = input || {};
  const a = ask && typeof ask === 'object' ? ask : {};

  const title = str(a.ask_title);
  const body = str(a.ask_body);
  const question = str(a.question);
  const actionKind = str(a.action_kind);
  const size = str(a.size);

  const name = firstNameOf(user);
  const greeting = name ? `Hi ${name},` : 'Hi,';

  const origin = (str(appOrigin) || DEFAULT_APP_ORIGIN).replace(/\/+$/, '');
  const settingsUrl = `${origin}${SETTINGS_PATH}`;

  // A question rung is answered on the answer page. A rung with no link of its
  // own has nothing else to offer, so it goes there too.
  const url = absoluteUrl(origin, a.action_target);
  const wantsAnswer = size === 'one_line' || ANSWER_ACTIONS.includes(actionKind) || !url;

  const rowId = str(nudgeId) || str(a.id);
  const answerUrl = rowId
    ? `${origin}${ANSWER_PATH}?nudgeId=${encodeURIComponent(rowId)}`
    : `${origin}${ANSWER_PATH}`;

  // The link the email actually prints, and the line above it.
  const actionUrl = wantsAnswer ? answerUrl : url;
  const linkLabel = wantsAnswer ? ANSWER_LABEL : (LINK_LABELS[actionKind] || DEFAULT_LINK_LABEL);

  // Plain text. This is the body that has to read perfectly: it is the whole
  // email, because SendEmail carries `body` and nothing else.
  //
  // The question is printed above the link rather than left on the page, so a
  // student knows what they are being asked before they decide to click.
  const textParts = [greeting];
  if (body) textParts.push(body);
  if (wantsAnswer && question) textParts.push(question);
  textParts.push(`${linkLabel}:`, actionUrl);
  textParts.push(`${STOP_SENTENCE} ${settingsUrl}`);
  const text = plainDashes(textParts.join('\n\n'));

  // The HTML body. NOTHING SENDS IT YET. See the note at the top of the file.
  const html = plainDashes(renderHtml({
    greeting, body, question: wantsAnswer ? question : '', linkLabel,
    actionHref: safeHref(origin, actionUrl), settingsHref: safeHref(origin, settingsUrl),
  }));

  return { subject: plainDashes(title), text, html };
}

/** One table cell of body copy, at the size and rhythm the whole mail reads at. */
const BODY_CELL = `font-family:${FONT};font-size:16px;line-height:1.6;color:${C.text};`;

/**
 * The action, as a button somebody can actually hit with a thumb.
 *
 * The table is not decoration. Outlook renders through Word, which ignores
 * padding on an inline element, so an `<a>` styled to look like a button
 * collapses there to underlined words. Padding on the `<td>` is the part Word
 * honours, and `bgcolor` is the part it fills, which is why the colour is set
 * twice in two syntaxes. Navy on gold, which is the one place in the brand
 * where gold carries text.
 *
 * With images off this still looks exactly the same. A background colour is not
 * an image and no client blocks one.
 */
function buttonHtml(href, label) {
  if (!href) return '';
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">'
    + `<tr><td align="center" bgcolor="${C.gold}" style="background-color:${C.gold};border-radius:8px;`
    + 'padding:15px 30px;mso-padding-alt:15px 30px;">'
    + `<a href="${escapeAttr(href)}" style="display:inline-block;font-family:${FONT};font-size:16px;`
    + `line-height:20px;font-weight:700;letter-spacing:0.01em;color:${C.navy};text-decoration:none;">`
    + `${escapeText(label)}</a></td></tr></table>`;
}

/**
 * The opt out line, with the link on the word rather than printed after it.
 *
 * Built by finding `settings` inside the sentence the plain text body uses, so
 * the wording has exactly one source. If that word ever leaves the sentence
 * this falls back to linking the whole line, because a rung with no way out of
 * it is the one thing this file may never produce.
 */
function stopHtml(href) {
  const sentence = STOP_SENTENCE.replace(/\s*:\s*$/, '');
  const at = sentence.lastIndexOf(STOP_LINK_WORD);
  const link = (inner) => (href
    ? `<a class="u-link" href="${escapeAttr(href)}" style="color:${C.navy};text-decoration:underline;">${inner}</a>`
    : inner);
  if (at < 0) return `${link(escapeText(sentence))}.`;
  return escapeText(sentence.slice(0, at))
    + link(escapeText(STOP_LINK_WORD))
    + escapeText(sentence.slice(at + STOP_LINK_WORD.length))
    + '.';
}

/**
 * The whole document, top to bottom.
 *
 * Wordmark, greeting, the ask, the question when there is one, the button, a
 * rule, the way out. A full document rather than a fragment because the head is
 * where `color-scheme` and the dark mode block have to live, and both of those
 * are the difference between a mail that survives a dark client and one that
 * goes invisible in it.
 */
function renderHtml({ greeting, body, question, linkLabel, actionHref, settingsHref }) {
  const rows = [];

  rows.push(
    `<tr><td align="center" class="u-pad" style="padding:36px 32px 16px;">`
    + `<img src="${escapeAttr(LOGO_SRC)}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="Unscripted" `
    + `class="u-logo" border="0" style="display:block;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;`
    + `max-width:100%;border:0;outline:none;text-decoration:none;font-family:${FONT};font-size:22px;`
    + `font-weight:700;letter-spacing:0.14em;color:${C.navy};"></td></tr>`,
  );

  const copy = [`<p style="margin:0 0 20px;">${escapeText(greeting)}</p>`];
  if (body) copy.push(`<p style="margin:0 0 20px;">${escapeText(body)}</p>`);
  rows.push(
    `<tr><td class="u-pad u-text" style="padding:0 32px 4px;${BODY_CELL}">${copy.join('')}</td></tr>`,
  );

  // The question is the entire ask on the rung it appears on, so it is not
  // another paragraph. Bigger, heavier, on its own tinted panel behind a gold
  // rule, and it reads as a question before anything else on the screen does.
  if (question) {
    rows.push(
      '<tr><td class="u-pad" style="padding:4px 32px 8px;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">'
      + `<tr><td class="u-quote u-text" style="padding:18px 22px;background-color:${C.quote};`
      + `border-left:4px solid ${C.gold};border-radius:0 8px 8px 0;font-family:${FONT};font-size:18px;`
      + `line-height:1.5;font-weight:600;color:${C.navy};">${escapeText(question)}</td></tr>`
      + '</table></td></tr>',
    );
  }

  const button = buttonHtml(actionHref, linkLabel);
  if (button) rows.push(`<tr><td align="center" class="u-pad" style="padding:12px 32px 4px;">${button}</td></tr>`);

  rows.push(
    '<tr><td class="u-pad" style="padding:28px 32px 34px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">'
    + `<tr><td class="u-rule u-quiet" style="border-top:1px solid ${C.border};padding-top:20px;`
    + `font-family:${FONT};font-size:13px;line-height:1.6;color:${C.quiet};">${stopHtml(settingsHref)}`
    + '</td></tr></table></td></tr>',
  );

  return '<!doctype html>'
    + '<html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="color-scheme" content="light dark">'
    + '<meta name="supported-color-schemes" content="light dark">'
    + `<style>${EMBEDDED_CSS}</style></head>`
    + `<body class="u-page" style="margin:0;padding:0;width:100%;background-color:${C.page};">`
    + '<table role="presentation" class="u-page" width="100%" cellpadding="0" cellspacing="0" border="0" '
    + `style="width:100%;background-color:${C.page};">`
    + '<tr><td align="center" style="padding:24px 12px;">'
    + '<table role="presentation" class="u-card" width="600" cellpadding="0" cellspacing="0" border="0" '
    + `style="width:100%;max-width:600px;background-color:${C.card};border:1px solid ${C.border};`
    + 'border-radius:16px;">'
    + rows.join('')
    + '</table></td></tr></table></body></html>';
}
