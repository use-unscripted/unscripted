/**
 * The terms a student chose to keep. A supporting list, not a destination: it has
 * no nav entry and nothing in the product depends on it.
 */
import { useEffect, useState } from 'react';
import { loadVocabulary } from '@/lib/language-level';

export default function MyCareerVocabulary() {
  const [rows, setRows] = useState(null);

  useEffect(() => { loadVocabulary().then(setRows); }, []);

  if (rows === null) return null;

  return (
    <section className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-7 shadow-sm">
      {rows.length === 0 ? (
        <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>
          Nothing saved yet. Inside an experiment step, open a term and choose Save this term.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map(r => (
            <li key={r.id} className="border-b pb-4 last:border-0 last:pb-0" style={{ borderColor: 'var(--border-light)' }}>
              <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{r.term}</p>
              <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>{r.definition}</p>
              {r.why_it_matters && <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>Why it matters: {r.why_it_matters}</p>}
              {r.example && <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>Example: {r.example}</p>}
              <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
                {[r.path_name, r.learned_at ? new Date(r.learned_at).toLocaleDateString() : null].filter(Boolean).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}