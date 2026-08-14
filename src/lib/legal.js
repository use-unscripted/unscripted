/* ──────────────────────────────────────────────────────────────────────────
   Single source of truth for everything the legal + company pages assert.

   These strings appear on Privacy, Terms, About, Contact and in the footer.
   Change them here, not in the pages.

   ⚠️ There is no registered legal entity yet. The pages say so plainly rather
   than naming an LLC that does not exist — a university's counsel will check.
   When one is formed, set ENTITY and ENTITY_NOTE and the pages update
   everywhere at once.
   ────────────────────────────────────────────────────────────────────────── */

export const PRODUCT = 'Unscripted';

/** Registered entity, once there is one. Null means "operated by the team behind it". */
export const ENTITY = null;

/** Who the policies name as responsible for the service. */
export const OPERATOR = ENTITY || 'Unscripted';

/**
 * How the pages refer to the people behind the product.
 *
 * No individual names, deliberately. The team is bigger than any list we'd
 * keep current, and a stale name on a policy page is worse than none.
 */
export const TEAM = 'a small team';

export const CONTACT_EMAIL = 'useunscripted@gmail.com';

/** Last substantive revision. Update whenever the terms actually change. */
export const EFFECTIVE_DATE = 'July 31, 2026';

/**
 * Last amendment to the Privacy Policy specifically.
 *
 * Separate from EFFECTIVE_DATE because the two dates answer different
 * questions and Section 16 promises the Last Updated date tracks amendments.
 * Corrections to what the Policy describes move this; they don't restart the
 * date the Policy took effect.
 */
export const PRIVACY_LAST_UPDATED = 'August 14, 2026';

/** Minimum age to hold an account. 13–17 requires a parent or guardian's permission. */
export const MIN_AGE = 13;

/** Where disputes are handled. Revisit when the entity is formed. */
export const GOVERNING_STATE = 'Connecticut';

/** Third parties that touch student data, listed on the privacy page. */
export const SUBPROCESSORS = [
  {
    name: 'Base44',
    role: 'Hosts the app, stores your account and everything you save in it, and handles sign-in.',
  },
  {
    name: 'Google',
    role: 'Only if you choose "Continue with Google". Google confirms your identity and shares your name, email address and profile picture with us.',
  },
  {
    name: 'AI model providers (OpenAI, Google, Anthropic)',
    role: 'Receive the answers you type when we generate your paths, experiments, mission guides and outreach drafts.',
  },
];
