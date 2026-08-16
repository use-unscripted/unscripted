import { ArrowRight } from 'lucide-react';

/**
 * The step the old outreach feature never had. A completed conversation is not
 * evidence: the person is the source, and what the student learned is the
 * evidence. This is the handover, and everything it needs is already known.
 */
export default function TurnIntoEvidence({ contact, brief, path, onContinue }) {
  const prefilled = [
    path?.path_name && `Path: ${path.path_name}`,
    brief?.topic_label && `Unknown: ${brief.topic_label}`,
    contact?.role && `Who you spoke with: ${contact.role}${contact.company ? `, ${contact.company}` : ''}`,
    'Date, and the dimensions this touches',
  ].filter(Boolean);

  return (
    <section className="app-card p-6 sm:p-8">
      <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>Turn this conversation into evidence</h2>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        The person you spoke with is the source. What you learned from the conversation is the evidence.
      </p>

      <ul className="mt-4 space-y-1.5">
        {prefilled.map(line => (
          <li key={line} className="tp-meta" style={{ color: 'var(--text-muted)' }}>Already filled in \u00b7 {line}</li>
        ))}
      </ul>

      <button type="button" onClick={onContinue} className="ui-press app-cta tp-control mt-5">
        Add to Evidence <ArrowRight size={16} aria-hidden="true" />
      </button>
    </section>
  );
}