import { HUMAN_REALITY_SOURCES } from '@/lib/human-reality';

/**
 * Who to ask. Every option here is one step from a student who knows nobody in
 * the field, which is the point: this must not require a network.
 */
export default function HumanRealitySources() {
  return (
    <section className="app-card p-6 sm:p-8">
      <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>Who could answer this</h2>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        One conversation is enough to start. You do not need a network, and any of these counts the same.
      </p>
      <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {HUMAN_REALITY_SOURCES.map(s => (
          <li key={s.id} className="app-card-flat p-3.5">
            <p className="tp-control" style={{ color: 'var(--ink-900)' }}>{s.label}</p>
            <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>{s.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}