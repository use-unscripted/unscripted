/**
 * Outreach that belongs to a mission.
 *
 * Outreach records are created and updated from inside the mission that requires
 * the conversation — never as a standalone CRM entry — so every contact carries
 * user + cycle + path + experiment + mission.
 *
 * Idempotency: each record gets a dedupe_key derived from the mission and the
 * person (or the role archetype when nobody is named yet). Creating again with
 * the same key updates the existing record instead of adding a second one.
 */
import { base44 } from '@/api/base44Client';
import { onceInFlight, linksForExperiment } from '@/lib/career-cycle';
import { isDirectProfileUrl, peopleSearchUrl, storedStatusOf } from '@/lib/linkedin';

const slug = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);

/**
 * A mission is optional. A guide can have steps that ask for a conversation
 * without a mission record behind them, and the student still has to be able to
 * record who they spoke with, so the key falls back to the experiment.
 */
export function outreachKey(mission, { name, archetype }, experiment) {
  const owner = mission?.id ? `mission:${mission.id}` : `experiment:${experiment?.id || 'none'}`;
  return `${owner}:${slug(name) || slug(archetype) || 'contact'}`;
}

export async function missionOutreach(missionId) {
  const rows = await base44.entities.OutreachContacts
    .filter({ mission_id: missionId }, '-created_date', 50)
    .catch(() => []);
  return (Array.isArray(rows) ? rows : []).filter(r => r.deletion_status !== 'deleted');
}

/**
 * Creates (or updates) the outreach record for this mission + person.
 * A profile URL is stored as verified ONLY when the student confirmed it and it
 * is a real linkedin.com/in/ address; otherwise we keep a search link instead.
 */
export function saveMissionOutreach({ mission, experiment, path, contact }) {
  const key = outreachKey(mission, contact, experiment);

  return onceInFlight(`outreach:${key}`, async () => {
    const links = await linksForExperiment(experiment, mission);
    const verified = !!contact.profile_verified && isDirectProfileUrl(contact.profile_url);
    const payload = {
      ...links,
      path_id: links.path_id || path?.id,
      dedupe_key: key,
      name: contact.name || contact.archetype || 'Professional to contact',
      archetype: contact.archetype || undefined,
      role: contact.role || undefined,
      company: contact.company || undefined,
      profile_url: verified ? contact.profile_url.trim() : undefined,
      profile_verified: verified,
      search_url: verified
        ? undefined
        : peopleSearchUrl([contact.name, contact.company, contact.archetype || contact.role].filter(Boolean).join(' ')),
      contact_type: contact.contact_type || 'informational_interview',
      reason_for_contact: contact.purpose || mission?.outreach_purpose || undefined,
      suggested_message: contact.suggested_message || mission?.suggested_message || undefined,
      questions_to_ask: contact.questions_to_ask || mission?.questions_to_ask || undefined,
      response_status: storedStatusOf(contact.status || 'planned'),
      notes: contact.notes || undefined,
      path_being_tested: experiment?.path_name || path?.path_name,
    };

    const existing = await base44.entities.OutreachContacts
      .filter({ dedupe_key: key }, '-created_date', 5)
      .catch(() => []);
    const found = (Array.isArray(existing) ? existing : []).find(r => r.deletion_status !== 'deleted');
    if (found) return base44.entities.OutreachContacts.update(found.id, payload);
    return base44.entities.OutreachContacts.create(payload);
  });
}

/**
 * Notes change from inside the mission, and nothing else.
 *
 * This used to go through setOutreachStatus with the contact's current status
 * read back out of the row, which did two wrong things at once: it never wrote
 * the notes, because that function only ever patches the status, and it wrote
 * the status back through a round trip that did not survive every stored value.
 * A contact the student had closed out came back as 'not_sent'.
 */
export function setOutreachNotes(contact, notes) {
  return onceInFlight(`outreach-notes:${contact.id}`, () => (
    base44.entities.OutreachContacts.update(contact.id, { notes })
  ));
}

/** Status change from inside the mission. */
export function setOutreachStatus(contact, uiStatus) {
  return onceInFlight(`outreach-status:${contact.id}:${uiStatus}`, () => {
    const patch = { response_status: storedStatusOf(uiStatus) };
    if (uiStatus === 'contacted' && !contact.date_contacted) {
      patch.date_contacted = new Date().toISOString().split('T')[0];
    }
    return base44.entities.OutreachContacts.update(contact.id, patch);
  });
}