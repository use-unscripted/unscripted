/**
 * What people who do this work have said about this dimension.
 *
 * Its own block, its own wording. A conversation describes the field; only the
 * student's own work describes the student, so nothing here is folded into the
 * behavioural evidence above it.
 */
export default function HumanSourceBlock({ human }) {
  if (!human?.count) return null;

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
      <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
        This is context about the career. It does not change what your own experiments have shown.
      </p>
    </section>
  );
}