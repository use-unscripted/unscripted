/**
 * The direction with the strongest supporting evidence right now — and nothing
 * more than that. No "best career", no likelihood of success, and no verdict
 * when the leaders sit close together.
 */
export default function StrongestHypothesis({ strongest }) {
  const { row, reason } = strongest;
  return (
    <section className="app-card p-6" style={{ background: 'var(--brand-navy-900)', border: 'none' }}>
      <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-500)' }}>Strongest current path</p>
      {row ? (
        <>
          <h2 className="tp-page mt-2" style={{ color: 'var(--brand-white)' }}>{row.name}</h2>
          <p className="tp-lead mt-2" style={{ color: 'var(--ink-300)' }}>
            Currently has the strongest supporting evidence among the directions you have tested.
          </p>
          <p className="tp-body mt-3" style={{ color: 'var(--ink-300)' }}>{row.confidence.basis}</p>
        </>
      ) : (
        <p className="tp-lead mt-2" style={{ color: 'var(--ink-300)' }}>{reason}</p>
      )}
      <p className="tp-meta mt-4" style={{ color: 'var(--ink-300)' }}>This can change as you collect more evidence.</p>
    </section>
  );
}