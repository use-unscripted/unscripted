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
 * - **No date is printed anywhere on purpose.** A date is either a deadline we
 *   cannot enforce or a "3 days ago" that is wrong by the time it is read.
 *   `now` is taken as a parameter so a caller does not have to know that, and
 *   so a later version can use it without changing every call site.
 *
 * Pure. No SDK, no clock, no network, relative and extension qualified imports
 * only, so a Deno backend function can import this file as it stands.
 */

/** Where the links point when a caller does not say. The live app. */
export const DEFAULT_APP_ORIGIN = 'https://useunscripted.base44.app';

/** The route the opt out line sends people to. */
export const SETTINGS_PATH = '/settings';

/**
 * The line under every email, in both bodies.
 *
 * Written against what actually exists today. There is no "weekly emails off"
 * switch in settings yet, so promising one would be a lie in an email we are
 * asking a school to trust. A reply is a mechanism that works right now, and
 * honouring it is the one obligation this line puts on whoever builds the
 * reply handling.
 */
const STOP_SENTENCE = 'To stop getting these, reply with the word stop and we will stop sending them.';
const SETTINGS_SENTENCE = 'Your account settings are at';

/**
 * The rungs that want a sentence back rather than a click.
 *
 * Size is the field that says so, but `rule_out` rungs are the ones that matter
 * most here and the ladder could grow one at another size, so the action kind is
 * checked too. Getting this wrong sends a student a link when we asked them a
 * question, and the question is the entire ask on those rungs.
 */
const REPLY_ACTIONS = ['answer_question', 'rule_out'];

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
 * @param {{ask: object, user?: object|null, appOrigin?: string, now?: any}} input
 * @returns {{subject: string, text: string, html: string}}
 */
export function renderNudgeEmail(input = {}) {
  const { ask, user = null, appOrigin } = input || {};
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

  // A reply rung asks for a sentence. A rung with no link to send them to has
  // nothing else it could ask for, so it asks for a sentence too.
  const url = absoluteUrl(origin, a.action_target);
  const wantsReply = size === 'one_line' || REPLY_ACTIONS.includes(actionKind) || !url;

  const linkLabel = LINK_LABELS[actionKind] || DEFAULT_LINK_LABEL;

  // ── Plain text. This is the body that has to read perfectly: it is what the
  // SDK's SendEmail actually carries, and it is what a plain text client shows.
  const textParts = [greeting];
  if (body) textParts.push(body);
  if (wantsReply) {
    textParts.push('Reply to this email with one sentence.');
    if (question) textParts.push(question);
  } else {
    textParts.push(`${linkLabel}:`, url);
  }
  textParts.push(`${STOP_SENTENCE} ${SETTINGS_SENTENCE} ${settingsUrl}`);
  const text = plainDashes(textParts.join('\n\n'));

  // ── HTML. One column, inline styles, no images, no tracking pixel, no
  // external font, no CSS class, no table. No colour and no background either:
  // a client in dark mode inverts what it is given, and the fastest way to get
  // black text on a black card is to set one of the two yourself.
  const P = 'style="margin:0 0 16px;"';
  const htmlParts = [
    `<p ${P}>${escapeHtml(greeting)}</p>`,
  ];
  if (body) htmlParts.push(`<p ${P}>${escapeHtml(body)}</p>`);
  if (wantsReply) {
    htmlParts.push(`<p ${P}>${escapeHtml('Reply to this email with one sentence.')}</p>`);
    if (question) htmlParts.push(`<p style="margin:0 0 24px;font-weight:600;">${escapeHtml(question)}</p>`);
  } else {
    htmlParts.push(
      `<p style="margin:0 0 24px;"><a href="${escapeHtml(url)}" `
      + 'style="display:inline-block;padding:10px 16px;border:1px solid currentColor;'
      + `border-radius:6px;text-decoration:none;color:inherit;">${escapeHtml(linkLabel)}</a></p>`,
    );
    htmlParts.push(`<p style="margin:0 0 16px;font-size:13px;">${escapeHtml(url)}</p>`);
  }
  htmlParts.push(
    `<p style="margin:0;font-size:13px;">${escapeHtml(STOP_SENTENCE)} `
    + `${escapeHtml(SETTINGS_SENTENCE)} `
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
