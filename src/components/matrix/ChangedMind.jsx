import { ArrowRight } from 'lucide-react';

/**
 * Where real experience has replaced an assumption. Only the student's own
 * recorded answers and rating gaps appear here; nothing is written for them.
 */
export default function ChangedMind({ items }) {
  if (!items.length) return null;
  return (
    <section className="app-card p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Things experience has changed your mind about</h2>
      <ul className="mt-5 space-y-3">
        {items.map(item => (
          <li key={item.key} className="app-card-flat p-4">
            {item.career && <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{item.career}</p>}
            <p className="tp-body mt-1.5" style={{ color: 'var(--text-muted)' }}>{item.expected}</p>
            <p className="tp-card mt-2 flex items-start gap-2" style={{ color: 'var(--text-primary)' }}>
              <ArrowRight size={15} className="mt-1 shrink-0" style={{ color: 'var(--brand-gold-600)' }} aria-hidden="true" />
              {item.experienced}
            </p>
            <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>From {item.source}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}