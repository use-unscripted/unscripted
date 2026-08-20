import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { humanExposure, SOURCE_LABELS } from '@/lib/human-reality';

/**
 * Human exposure: how much of what this student believes has been checked
 * against somebody who does the work. Its own metric, next to the scores rather
 * than inside them.
 */
export default function HumanExposurePanel({ conversations = [] }) {
  const exposure = humanExposure(conversations);
  const recent = conversations
    .filter(c => ['conversation_held', 'human_evidence_recorded'].includes(c.evidence_status))
    .slice(0, 3);

  return (
    <section className="app-card p-6">
      <div className="flex items-center gap-2">
        <Users size={16} style={{ color: 'var(--brand-gold-700)' }} aria-hidden="true" />
        <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Human exposure</h2>
      </div>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        {exposure.conversations === 0
          ? 'Nobody who does this work has described it to you yet. Hours, hierarchy and real stakes can only be answered this way.'
          : `${exposure.label} across ${exposure.paths} ${exposure.paths === 1 ? 'path' : 'paths'}, covering ${exposure.topics} ${exposure.topics === 1 ? 'question' : 'questions'} no experiment could answer.`}
      </p>

      {recent.length > 0 && (
        <ul className="mt-5 space-y-2.5">
          {recent.map(c => (
            <li key={c.id} className="app-card-flat p-3.5">
              <p className="tp-control" style={{ color: 'var(--ink-900)' }}>{c.topic_label || 'A conversation'}</p>
              <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>
                {c.professional_role || SOURCE_LABELS.get(c.source_type) || 'A professional'}
                {c.path_name ? ` \u00b7 ${c.path_name}` : ''}
                {c.conversation_date ? ` \u00b7 ${c.conversation_date}` : ''}
              </p>
              {c.key_learning && (
                <p className="tp-body mt-2" style={{ color: 'var(--ink-700)' }}>{c.key_learning}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {exposure.changed_expectations > 0 && (
        <p className="tp-meta mt-4 rounded-[var(--r-control)] px-3 py-2" style={{ background: 'var(--info-50)', color: 'var(--info-700)' }}>
          {exposure.changed_expectations === 1
            ? 'One of these changed what you expected. That is a real result.'
            : `${exposure.changed_expectations} of these changed what you expected. That is a real result.`}
        </p>
      )}

      <Link to="/human-reality" className="app-cta-secondary tp-control mt-5 inline-flex">
        {exposure.conversations === 0 ? 'Set up a conversation' : 'Record another conversation'}
      </Link>
    </section>
  );
}