import { Link } from 'react-router-dom';
import { Reveal } from '@/components/motion';

/**
 * The hypotheses the student is not currently testing.
 *
 * Deliberately quieter than the focus panel: one direction is being tested, and
 * three equally loud cards is what turned this page into a menu. Each one still
 * says where it stands, what its biggest unknown is, and how to pick it up later.
 */
export default function OtherHypotheses({ others = [] }) {
  if (!others.length) return null;

  return (
    <Reveal y={20}>
      <section className="app-card-flat p-6">
        <h2 className="tp-card" style={{ color: 'var(--text-primary)' }}>Other paths</h2>
        <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
          Still open. You are not testing these right now, and nothing about them is closed.
        </p>

        <ul className="mt-4 space-y-3">
          {others.map(h => (
            <li key={h.id} className="rounded-[var(--r-control)] border border-[color:var(--ink-200)] p-4">
              <h3 className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{h.name}</h3>
              <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>
                {h.statusLabel} · Confidence {h.confidenceBand}
              </p>
              {h.unknowns?.[0] && (
                <p className="tp-meta mt-2" style={{ color: 'var(--ink-500)' }}>
                  Biggest unknown: {h.unknowns[0].question}
                </p>
              )}
              <Link
                to={`/paths?focus=${h.id}`}
                className="tp-meta touch-reach mt-3 inline-flex font-semibold"
                style={{ color: 'var(--brand-navy-700)' }}
              >
                Test this later
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Reveal>
  );
}