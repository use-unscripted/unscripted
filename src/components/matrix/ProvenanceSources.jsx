import { humanDate } from '@/lib/matrix-provenance';

/**
 * "Sources used" — the records a score was read from, by title and date. No
 * database ids: an id tells a student nothing, and showing one invites them to
 * trust a number because it looks technical.
 */
export default function ProvenanceSources({ sources = [] }) {
  if (!sources.length) {
    return (
      <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>
        No records are attached to this score yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {sources.map((s, i) => (
        <li key={i} className="app-inset p-3" style={{ background: 'var(--ink-50)' }}>
          <p className="tp-meta" style={{ color: 'var(--brand-navy-700)' }}>{s.kind}</p>
          <p className="tp-body" style={{ color: 'var(--text-primary)' }}>{s.title}</p>
          <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {[humanDate(s.date), s.note].filter(Boolean).join(' · ') || 'No date recorded'}
          </p>
        </li>
      ))}
    </ul>
  );
}