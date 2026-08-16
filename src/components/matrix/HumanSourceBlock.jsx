import { useEffect } from 'react';
import { humanEvidenceMatrixUpdated } from '@/lib/analytics/human-reality-events';

/**
 * What people who do this work have said about this dimension.
 *
 * Its own block, its own wording, and always paired with what the student's own
 * work has shown about the same dimension. That pairing is the point: a
 * conversation can explain what the work involves, and only firsthand evidence
 * says how this student responds to it. Collapsing the two is exactly the
 * mistake this block exists to prevent.
 */
export default function HumanSourceBlock({ human, behavioural }) {
  useEffect(() => {
    if (human?.count) humanEvidenceMatrixUpdated({ stage: 'workstyle' });
  }, [human?.count]);

  if (!human?.count) return null;

  const tested = Boolean(behavioural?.tested);

  return (
    <section className="mt-6">
      <h3 className="tp-eyebrow" style={{ color: 'var(--brand-gold-700)' }}>From Human Reality conversations</h3>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{human.statement}</p>
      <ul className="mt-3 space-y-2">
        {human.learnings.slice(0, 4).map((l, i) => (
          <li key={`${l.source}-${i}`}>
            <p className="tp-body" style={{ color: 'var(--ink-700)' }}>{l.text}</p>
            <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {l.source}{l.path_name ? ` \u00b7 ${l.path_name}` : ''}
            </p>
          </li>
        ))}
      </ul>

      <h3 className="tp-eyebrow mt-5" style={{ color: 'var(--brand-navy-700)' }}>From your own work</h3>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        {tested
          ? behavioural.summary
          : 'No experiment has put you in this situation yet, so we have nothing about how you respond to it.'}
      </p>

      <p className="tp-body mt-4 rounded-[var(--r-control)] px-3 py-2.5" style={{ background: 'var(--ink-50)', color: 'var(--ink-700)' }}>
        {tested
          ? 'Human perspective has clarified what the work involves, and your own work shows how you responded to it.'
          : 'Human perspective has clarified what the work involves, but we still need firsthand evidence about how you respond to it.'}
      </p>
    </section>
  );
}