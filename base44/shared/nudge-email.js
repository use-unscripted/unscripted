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
 * ## `text` is the email. `html` is not sent to anybody.
 *
 * Base44's SendEmail takes `{to, subject, body, from_name}`, and `body` is
 * plain text. So `text` is the entire thing a student sees, and `html` goes
 * nowhere: the backend function renders it, throws it away, and never has an
 * argument to put it in. It is kept, and tested, because the copy and the
 * escaping should already be right on the day the send path can carry one, and
 * because rebuilding it later against a live sender is how a bug reaches an
 * inbox. If you are changing what a student reads, change `text`. If a test
 * below only covers `html`, it covers nothing that ships today.
 *
 * Pure. No SDK, no clock, no network, relative and extension qualified imports
 * only, so a Deno backend function can import this file as it stands.
 */

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
 * Everything interpolated into the HTML goes through here.
 *
 * Titles and bodies are model written and names are student written, so both
 * are hostile input as far as this file is concerned. Only the five characters
 * that mean something to a parser are touched: a curly apostrophe is correct
 * typography, is the house exception, and stays exactly as it is.
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

  // The HTML body, which NOTHING SENDS. See the note at the top of the file.
  // One column, inline styles, no images, no tracking pixel, no external font,
  // no CSS class, no table. No colour and no background either: a client in
  // dark mode inverts what it is given, and the fastest way to get black text
  // on a black card is to set one of the two yourself.
  const P = 'style="margin:0 0 16px;"';
  const htmlParts = [
    `<p ${P}>${escapeHtml(greeting)}</p>`,
  ];
  if (body) htmlParts.push(`<p ${P}>${escapeHtml(body)}</p>`);
  if (wantsAnswer && question) {
    htmlParts.push(`<p style="margin:0 0 16px;font-weight:600;">${escapeHtml(question)}</p>`);
  }
  htmlParts.push(
    `<p style="margin:0 0 24px;"><a href="${escapeHtml(actionUrl)}" `
    + 'style="display:inline-block;padding:10px 16px;border:1px solid currentColor;'
    + `border-radius:6px;text-decoration:none;color:inherit;">${escapeHtml(linkLabel)}</a></p>`,
  );
  htmlParts.push(`<p style="margin:0 0 16px;font-size:13px;">${escapeHtml(actionUrl)}</p>`);
  htmlParts.push(
    `<p style="margin:0;font-size:13px;">${escapeHtml(STOP_SENTENCE)} `
    + `<a href="${escapeHtml(settingsUrl)}" style="color:inherit;">${escapeHtml(settingsUrl)}</a></p>`,
  );

  const html = plainDashes(
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;'
    + 'font-size:16px;line-height:1.5;max-width:520px;margin:0 auto;padding:24px;">'
    + htmlParts.join('')
    + '</div>',
  );

  return { subject: plainDashes(title), text, html };
}
