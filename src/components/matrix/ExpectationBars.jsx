/**
 * Expectation vs Reality, as two bars per measure. Nothing is drawn when one
 * half of the pair was never answered.
 */
export default function ExpectationBars({ expectation }) {
  if (!expectation?.available) {
    return (
      <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>
        Expectation vs Reality becomes available after completing an experiment with before-and-after ratings.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {expectation.pairs.map(p => (
        <div key={p.key}>
          <div className="flex items-baseline justify-between">
            <p className="tp-control" style={{ color: 'var(--text-primary)' }}>{p.label}</p>
            <p className="tp-meta tabular-nums font-semibold"
              style={{ color: p.gap < 0 ? 'var(--warning-700)' : p.gap > 0 ? 'var(--success-700)' : 'var(--text-secondary)' }}>
              {p.gap > 0 ? '+' : ''}{p.gap} points vs expected
            </p>
          </div>
          {[['Expected', p.expected, 'var(--ink-300)'], ['Actual', p.actual, 'var(--brand-navy-700)']].map(([label, value, fill]) => (
            <div key={label} className="mt-2 flex items-center gap-3">
              <span className="tp-meta w-[62px] shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--ink-100)' }}>
                <span className="progress-fill block h-full rounded-full" style={{ width: `${value}%`, background: fill }} />
              </span>
              <span className="tp-meta w-[38px] shrink-0 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{value}%</span>
            </div>
          ))}
        </div>
      ))}
      <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>
        {expectation.pairs.some(p => p.key === 'enjoyment' && p.gap <= -10)
          ? 'You expected to enjoy this type of work more than you reported enjoying the experience.'
          : expectation.pairs.some(p => p.key === 'enjoyment' && p.gap >= 10)
            ? 'You enjoyed this work more than you expected to.'
            : 'Your expectations and your experience were reasonably close.'}
      </p>
    </div>
  );
}