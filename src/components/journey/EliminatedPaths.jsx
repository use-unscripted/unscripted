import { Reveal } from '@/components/motion';

/**
 * Journey history: the directions the student learned enough about to stop.
 *
 * Ruling a career out is one of the most valuable outcomes this product has, so
 * it is recorded as knowledge rather than as a list of failures. No red, no
 * crosses, no "rejected".
 */
export default function EliminatedPaths({ eliminated = [] }) {
  if (!eliminated.length) return null;

  return (
    <Reveal y={20}>
      <section className="app-card-flat p-6">
        <h2 className="tp-card" style={{ color: 'var(--text-primary)' }}>Journey history</h2>
        <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
          Paths you learned enough to stop pursuing.
        </p>
        <ul className="mt-4 space-y-3">
          {eliminated.map(p => (
            <li key={p.id} className="rounded-[var(--r-control)] p-4" style={{ background: 'var(--ink-50)' }}>
              <h3 className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{p.name}</h3>
              {p.learned && (
                <p className="tp-meta mt-1" style={{ color: 'var(--ink-500)' }}>What you learned: {p.learned}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Reveal>
  );
}