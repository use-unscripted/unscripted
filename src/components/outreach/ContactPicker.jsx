import { STATUS_LABELS, HOW_KNOWN_LABELS } from '@/lib/outreach';

/**
 * People this student has already recorded. Reusing one of them is how the same
 * professional supports a second, different question without a duplicate
 * contact record being created.
 */
export default function ContactPicker({ contacts = [], onPick }) {
  if (!contacts.length) return null;

  return (
    <section className="app-card p-6 sm:p-8">
      <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>People you have already spoken with</h2>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        Ask one of them about this question instead. We keep the same contact and record a separate conversation.
      </p>
      <ul className="mt-4 space-y-2.5">
        {contacts.slice(0, 6).map(c => (
          <li key={c.id}>
            <button type="button" onClick={() => onPick(c)}
              className="ui-press ui-lift app-card-flat touch-target w-full p-4 text-left">
              <p className="tp-control" style={{ color: 'var(--ink-900)' }}>
                {c.role || 'A professional'}{c.company ? ` \u00b7 ${c.company}` : ''}
              </p>
              <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>
                {HOW_KNOWN_LABELS.get(c.how_known) || 'Contact'}
                {c.path_name ? ` \u00b7 ${c.path_name}` : ''}
                {c.outreach_status ? ` \u00b7 ${STATUS_LABELS.get(c.outreach_status)}` : ''}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}