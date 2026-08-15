import MetricValue from '@/components/matrix/MetricValue';
import TrendBadge from '@/components/matrix/TrendBadge';

/**
 * The same comparison on a phone: one card per hypothesis, stacked. The table is
 * never squeezed sideways, so nothing essential sits behind a scroll.
 */
const CELLS = [
  ['confidence', 'Confidence', r => r.confidence.value],
  ['coverage', 'Evidence coverage', r => r.coverage.value],
  ['fit', 'Experienced fit', r => r.fit.value],
  ['uncertainty', 'Uncertainty left', r => r.uncertainty.value],
];

export default function MatrixCards({ rows, onOpen }) {
  return (
    <div className="space-y-4 lg:hidden">
      {rows.map(row => (
        <article key={row.pathId} className="app-card p-5">
          <p className="tp-card" style={{ color: 'var(--text-primary)' }}>{row.name}</p>
          <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>{row.maturity.label}</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {CELLS.map(([key, label, read]) => (
              <button key={key} type="button" onClick={() => onOpen(row, key)}
                className="touch-target app-inset px-3 py-2.5 text-left" style={{ background: 'var(--ink-50)' }}>
                <span className="tp-meta block" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <MetricValue value={read(row)} maturity={row.maturity} />
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <TrendBadge trend={row.trend} />
            <button type="button" onClick={() => onOpen(row, 'confidence')}
              className="touch-target tp-control rounded-[var(--r-control)] px-3 py-2"
              style={{ color: 'var(--brand-navy-700)' }}>
              Why this score?
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}