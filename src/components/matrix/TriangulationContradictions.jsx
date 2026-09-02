/**
 * The contradiction block of the Path Triangulation Summary: the most important
 * of the four, so it gets the most room.
 *
 * Nothing is resolved here and no two opposing readings are averaged. Each item
 * keeps its own source, its own detail and the question it leaves open.
 */
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function TriangulationContradictions({ conflicts = [] }) {
  if (!conflicts.length) {
    return (
      <div className="app-inset p-4" style={{ background: 'var(--success-50)' }}>
        <p className="tp-body font-semibold" style={{ color: 'var(--success-700)' }}>
          <CheckCircle2 size={15} className="mr-1.5 inline" />
          Nothing recorded on this path disagrees with itself so far.
        </p>
        <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>
          The next test can change that, which is normal rather than a setback.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="tp-body font-semibold" style={{ color: 'var(--warning-700)' }}>
        <AlertTriangle size={15} className="mr-1.5 inline" />
        {conflicts.length} {conflicts.length === 1 ? 'disagreement is' : 'disagreements are'} still open behind this reasoning.
      </p>
      {conflicts.map(c => (
        <article key={c.id} className="app-inset p-4" style={{ background: 'var(--warning-50)' }}>
          <p className="tp-meta font-semibold uppercase" style={{ color: 'var(--warning-700)', letterSpacing: '0.06em' }}>
            {c.source}
          </p>
          <p className="tp-body mt-1 font-semibold" style={{ color: 'var(--text-primary)' }}>{c.title}</p>
          {c.detail && <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>{c.detail}</p>}
          {c.open_question && (
            <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
              Still open: {c.open_question}
            </p>
          )}
        </article>
      ))}
      <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>
        Both sides of each disagreement are kept, and neither one is averaged into the other.
      </p>
    </div>
  );
}