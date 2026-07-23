/**
 * Campus Network utilities — shared helpers for profile, follow, invite, and visibility logic.
 * Never expose raw IDs, emails, or private fields in return values intended for display.
 */

/** Generate a random opaque invite token (no user ID embedded). */
export function generateInviteToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Derive a URL-safe slug from a display name + suffix. */
export function makeSlug(displayName) {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

/** Return the invite URL for a token. Uses current origin. */
export function inviteUrl(token) {
  return `${window.location.origin}/invite/${token}`;
}

/** Default expiry: 30 days from now */
export function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

/** Visibility options for paths and proof. */
export const VISIBILITY_OPTIONS = [
  { value: 'private',        label: 'Private',          desc: 'Only you can see this.' },
  { value: 'followers',      label: 'Followers',        desc: 'Visible to people who follow you.' },
  { value: 'my_university',  label: 'My University',    desc: 'Visible to verified students at your university.' },
  { value: 'all_unscripted', label: 'All Unscripted',   desc: 'Visible to all authenticated Unscripted users.' },
];

/** Check if viewer can see a record given visibility and context. Pure client-side gate. */
export function canViewRecord({ visibility, ownerUserId, viewerUserId, isFollower, sameUniversity }) {
  if (ownerUserId === viewerUserId) return true;
  if (!visibility || visibility === 'private') return false;
  if (visibility === 'followers') return !!isFollower;
  if (visibility === 'my_university') return !!sameUniversity;
  if (visibility === 'all_unscripted') return true;
  return false;
}

/** Safe display: returns first name only if full name is present. */
export function safeName(displayName) {
  if (!displayName) return 'A student';
  return displayName.split(' ')[0];
}