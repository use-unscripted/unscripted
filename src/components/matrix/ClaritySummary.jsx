/**
 * The record so far. Deliberately flat: these are counts of what exists, not a
 * score, and a bigger number is not automatically better.
 */
export default function ClaritySummary({ clarity }) {
  const tiles = [
    ['Baseline clarity', clarity.baseline === null ? null : `${clarity.baseline}/10`],
    ['Clarity now', clarity.current === null ? null : `${clarity.current}/10`],
    ['Paths tested', clarity.hypothesesTested],
    ['Experiments completed', clarity.experiments],
    ['Evidence created', clarity.evidence],
    ['Professional conversations', clarity.conversations],
    ['Unknowns with evidence', clarity.unknownsTested],
    ['Unknowns still open', clarity.unknownsRemaining],
  ];

  return (
    <section className="app-card p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Where you stand</h2>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="app-inset p-3.5" style={{ background: 'var(--ink-50)' }}>
            <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="tp-card mt-1 tabular-nums" style={{ color: value === null ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {value === null ? 'Not recorded' : value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}