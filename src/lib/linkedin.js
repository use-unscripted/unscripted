/**
 * LinkedIn links, honestly.
 *
 * A direct profile URL is only ever shown when the student (or an import) has
 * confirmed that URL belongs to that person. We never construct one from a
 * name, because a guessed /in/ slug sends a student to a stranger. Everything
 * else becomes a LinkedIn SEARCH for the person, or for the role archetype when
 * there is no named person yet.
 */

const LINKEDIN_PROFILE = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/\s]+/i;

/** Is this a real, direct profile URL we were given (not inferred)? */
export function isDirectProfileUrl(url) {
  return !!url && LINKEDIN_PROFILE.test(url.trim());
}

/** People search — used whenever we have a name but no confirmed profile. */
export function peopleSearchUrl(query) {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

/**
 * The one link to render for an outreach target.
 * @returns {{ href: string, label: string, verified: boolean }}
 */
export function outreachLink({ profile_url, profile_verified, name, company, role, archetype } = {}) {
  if (profile_verified && isDirectProfileUrl(profile_url)) {
    return { href: profile_url.trim(), label: 'Verified profile', verified: true };
  }
  const query = [name, company, !name ? (archetype || role) : null].filter(Boolean).join(' ');
  return {
    href: peopleSearchUrl(query || archetype || role || 'professional'),
    label: name ? 'Search LinkedIn for this person' : 'Search LinkedIn for this role',
    verified: false,
  };
}

/**
 * UI statuses against the stored response_status values.
 *
 * `closed` is in here because a student can now close a contact out on purpose
 * from the answer page, and deciding not to pursue somebody is a result, not a
 * gap. Without a row here `uiStatusOf('closed')` fell through to 'planned', and
 * anything that wrote the status back (editing a note did) put 'not_sent' over
 * the top of the decision.
 */
export const OUTREACH_STATUSES = [
  { key: 'planned', label: 'Planned', stored: 'not_sent' },
  { key: 'contacted', label: 'Contacted', stored: 'sent' },
  { key: 'replied', label: 'Replied', stored: 'responded' },
  { key: 'completed', label: 'Completed', stored: 'completed' },
  { key: 'closed', label: 'Closed out', stored: 'closed' },
];

export function uiStatusOf(stored) {
  return OUTREACH_STATUSES.find(s => s.stored === stored)?.key || 'planned';
}
export function storedStatusOf(uiKey) {
  return OUTREACH_STATUSES.find(s => s.key === uiKey)?.stored || 'not_sent';
}