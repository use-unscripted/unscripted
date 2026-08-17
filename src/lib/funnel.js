/**
 * Signed-out funnel instrumentation.
 *
 * The question this exists to answer: how many visitors finish the intake,
 * reach the "create a free account" wall, and then leave without generating
 * anything? Nothing in the product measured that, so the wall's cost was
 * argued from guesses.
 *
 * Events go through the Base44 SDK's built-in analytics, which already runs
 * on every page load and already works for signed-out visitors (it sends
 * user_id: null plus its own anonymous session id). No new entity, no
 * row-level-security surface, no public write endpoint.
 *
 * Rules for anything added here:
 *   - Never send free text a student typed. Names, colleges, majors, notes,
 *     email addresses and every other open field stay out. Only fixed-choice
 *     values, booleans and counts.
 *   - Never let a tracking failure break the flow. Every call swallows.
 *
 * The events, in order:
 *
 *   intake_started            opened the intake (resumed: true if a draft existed)
 *   intake_step_completed     cleared a step (step_index, step_label)
 *   intake_step_blocked       hit validation and could not continue
 *   intake_early_read_shown   saw the early read between questions 5 and 6.
 *                             Carries sparse (nothing but the required clarity
 *                             answer, so the screen said so), directions_count
 *                             and reflection_count. Counts of lines on a
 *                             screen, never the lines: everything on that
 *                             screen is text the student typed.
 *   paths_intake_reached      answered every question and reached the review
 *                             screen. Named for the old intake, where path
 *                             selection was the final step; it is the first
 *                             four questions now, so the name says "reached
 *                             path selection" and the event means "finished
 *                             the intake". Carries intake_version, which is
 *                             how a dashboard tells the two shapes apart.
 *   paths_selected            picked a path and moved on
 *   wall_reached              ── THE DENOMINATOR ── saw the account wall, signed out
 *   wall_signup_clicked       took the wall's main CTA
 *   wall_login_clicked        already had an account (not a drop-off)
 *   wall_edit_paths_clicked   went back to change their answers (not a drop-off)
 *   register_code_sent        email/password accepted, verification code sent
 *   register_provider_started left for a provider (Google)
 *   account_created           verified the code — password sign-ups only
 *   claim_started             came back signed in to claim the draft
 *   paths_generated           ── THE NUMERATOR ── the model call actually ran
 *   claim_failed              claim or generation blew up (stage only)
 *
 * Drop-off at the wall = wall_reached minus paths_generated, less the people
 * who left by the two non-abandonment exits.
 *
 * Known gap: account_created does not fire for Google sign-ups, because the
 * provider redirect tears down the page mid-flow. claim_started covers those
 * visitors, so the wall-to-generation funnel is still complete; only the
 * password-vs-Google split is partial.
 */

import { base44 } from '@/api/base44Client';
import { loadDraft } from '@/lib/guest-draft';

const ONCE_PREFIX = 'unscripted_funnel_once_';

/** The opaque per-visitor id the guest draft already generates. Not PII. */
function guestSessionId() {
  try {
    return loadDraft()?.guest_session_id || null;
  } catch {
    return null;
  }
}

/**
 * Fire a funnel event. Safe to call from render paths and effects.
 */
export function trackFunnel(eventName, properties = {}) {
  try {
    base44.analytics.track({
      eventName,
      properties: { guest_session_id: guestSessionId(), ...properties },
    });
  } catch {
    // Measurement is never worth an exception in the user's path.
  }
}

/**
 * Fire a funnel event at most once per browser tab session.
 *
 * Mount effects run twice under React StrictMode in dev, and a visitor can
 * reload the wall or bounce between it and path selection. Without this the
 * counts would inflate and the drop-off number would be wrong in the
 * direction that flatters the wall.
 */
export function trackFunnelOnce(key, eventName, properties = {}) {
  try {
    const storageKey = ONCE_PREFIX + key;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, '1');
  } catch {
    // No sessionStorage (private mode, blocked storage) — still send it once
    // per page load rather than dropping the visitor from the count.
  }
  trackFunnel(eventName, properties);
}
