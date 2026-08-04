/**
 * The only sanctioned way to put a nudge email into somebody's inbox.
 *
 * WHY THIS FILE EXISTS
 *
 * The weekly pass already refuses to mail anyone outside an allowlist, and that
 * gate has been attacked hard and holds. But the gate only protects mail that
 * goes through the pass. While previewing these emails we called the send
 * integration directly, which skipped the gate entirely: what kept those nine
 * messages off a student's inbox was one hardcoded address in a throwaway
 * script. That is a weaker guarantee than it looked, and it is the kind that
 * fails the one time somebody is in a hurry.
 *
 * So the recipient check now lives next to the renderer, on the shortest path
 * anybody takes to send one of these. Rendering a nudge and sending it are one
 * call, and that call refuses an address that is not on the list. A preview
 * script, a one off, a backend job and a future cron all go through here.
 *
 * WHAT THIS DOES NOT DO
 *
 * It cannot stop somebody calling the raw send integration themselves. Nothing
 * in a client library can. What it does is make the wrong thing require you to
 * deliberately reimplement the right thing, rather than being the shorter path.
 *
 * TO ALLOW A REAL STUDENT TO RECEIVE ONE OF THESE
 *
 * Change ALLOWED_RECIPIENTS below, and change nothing else, and understand that
 * you are turning on outbound mail to real 19 year olds at a university we are
 * selling to. The weekly pass has its own separate gate on top of this one and
 * loosening this file alone does not open that.
 */

/**
 * Everyone who may receive a nudge email. Exactly one address, on purpose.
 * This is not a config value, an environment variable, or a request parameter.
 * It is a constant in source so that changing it is a reviewable diff.
 */
export const ALLOWED_RECIPIENTS = ['drew.lynch1@student.fairfield.edu'];

/** Normalised for comparison. Addresses arrive with stray case and whitespace. */
function normalise(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** True when this address may receive a nudge email. */
export function isAllowedRecipient(address) {
  const to = normalise(address);
  if (!to) return false;
  return ALLOWED_RECIPIENTS.map(normalise).includes(to);
}

/**
 * Throws unless the address may receive a nudge email.
 *
 * Throwing rather than returning false is deliberate. A caller that ignores a
 * return value sends the mail anyway; a caller that ignores an exception does
 * not exist. The message deliberately does not name the allowed address, so a
 * stack trace in a log does not hand anybody the answer.
 */
export function assertAllowedRecipient(address) {
  if (!isAllowedRecipient(address)) {
    throw new Error(
      'Refusing to send a nudge email: that address is not on the allowed list. '
      + 'These messages are not switched on for students yet.',
    );
  }
}

/**
 * Render a nudge and send it, or refuse.
 *
 * `client` is a base44 client (or `base44.asServiceRole`). `render` is
 * `renderNudgeEmail` from nudge-email.js, passed in rather than imported so
 * this file has no dependency of its own and can be read in one sitting.
 */
export async function sendNudgeEmail({ client, render, to, ask, user, appOrigin, now, format = 'html' }) {
  assertAllowedRecipient(to);
  const mail = render({ ask, user, appOrigin, now });
  // The send integration types `body` as plain text and offers no html field,
  // so for a while nothing sent the html half and students would have received
  // a wall of unformatted text. It turns out the integration renders html in
  // `body` regardless: verified 2026-08-04 by sending all seven rungs to a real
  // inbox and looking at them. Wordmark, button and footer link all arrived.
  //
  // `format: 'text'` still sends the plain version, which is a real email in its
  // own right and is what to fall back to if a client ever chokes on the html.
  await client.integrations.Core.SendEmail({
    to,
    subject: mail.subject,
    body: format === 'html' ? mail.html : mail.text,
  });
  return mail;
}
