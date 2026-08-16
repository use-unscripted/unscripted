import { Link } from 'react-router-dom';
import { fmtDate } from '@/lib/evidence-library';

/**
 * One piece of human evidence, with its provenance on the face of it: who the
 * source was, which question it was aimed at, what the student learned, and the
 * Path it informed.
 */
export default function HumanEvidenceCard({ conversation: c, changedLabel, sourceLabel, interactionLabel, representativeness }) {
  const Row = ({ label, children }) => (
    <div className="mt-3">
      <p className="tp-label" style={{ color: 'var(--ink-500)' }}>{label}</p>
      <p className="tp-body mt-1" style={{ color: 'var(--ink-700)' }}>{children}</p>
    </div>
  );

  return (
    <article className="app-card p-5 sm:p-6">
      <h3 className="tp-control" style={{ color: 'var(--ink-900)' }}>
        {c.professional_role || sourceLabel || 'A professional'}{c.professional_organisation ? ` \u2014 ${c.professional_organisation}` : ''}
      </h3>
      <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
        {interactionLabel || 'A conversation'}
        {c.conversation_date ? ` \u00b7 ${fmtDate(c.conversation_date)}` : ''}
      </p>

      <Row label="Source">Conversation with {c.professional_role || sourceLabel || 'a professional'}</Row>
      <Row label="Question tested">{c.uncertainty_question || c.topic_label || 'Not recorded'}</Row>
      <Row label="What you learned">{c.key_learning}</Row>
      {c.surprised_by && <Row label="What surprised you">{c.surprised_by}</Row>}
      {changedLabel && <Row label="Expectation">{changedLabel}{c.changed_expectation_note ? ` \u2014 ${c.changed_expectation_note}` : ''}</Row>}
      {c.remaining_unknown && <Row label="Still unknown">{c.remaining_unknown}</Row>}
      <Row label="Path informed">{c.path_name || 'Not recorded'}</Row>
      {representativeness && (
        <p className="tp-meta mt-4 rounded-[var(--r-control)] px-3 py-2" style={{ background: 'var(--ink-50)', color: 'var(--text-secondary)' }}>
          How far this goes: {representativeness}. Human perspective explains the work; it does not measure how you respond to it.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/matrix" className="app-cta-secondary tp-control">View in Decision Matrix</Link>
        {c.contact_id && (
          <Link to={`/human-reality?contactId=${c.contact_id}`} className="app-cta-secondary tp-control">View conversation</Link>
        )}
      </div>
    </article>
  );
}