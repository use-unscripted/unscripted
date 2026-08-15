import MetricValue from '@/components/matrix/MetricValue';
import TrendBadge from '@/components/matrix/TrendBadge';

/**
 * The wide comparison, desktop only. Every value is a button: a number nobody
 * can trace back to the work behind it is not evidence, it is decoration.
 */
const COLUMNS = [
  ['confidence', 'Path Confidence'],
  ['coverage', 'Evidence Coverage'],
  ['fit', 'Experienced Fit'],
  ['expectation', 'Expectation vs Reality'],
  ['human', 'Human Exposure'],
  ['uncertainty', 'Uncertainty Remaining'],
];

const valueOf = (row, key) => {
  if (key === 'confidence') return row.confidence.value;
  if (key === 'coverage') return row.coverage.value;
  if (key === 'fit') return row.fit.value;
  if (key === 'expectation') return row.expectation.value;
  if (key === 'human') return row.human.count ? row.human.value : null;
  return row.uncertainty.value;
};

export default function MatrixTable({ rows, onOpen }) {
  return (
    <div className="app-card hidden overflow-hidden lg:block">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr style={{ background: 'var(--ink-50)' }}>
            <th className="tp-eyebrow px-5 py-3.5" style={{ color: 'var(--brand-navy-700)' }}>Career Path</th>
            {COLUMNS.map(([key, label]) => (
              <th key={key} className="tp-eyebrow px-3 py-3.5" style={{ color: 'var(--brand-navy-700)' }}>{label}</th>
            ))}
            <th className="tp-eyebrow px-5 py-3.5" style={{ color: 'var(--brand-navy-700)' }}>Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.pathId} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
              <td className="px-5 py-4 align-top" style={{ maxWidth: 220 }}>
                <p className="tp-card" style={{ color: 'var(--text-primary)' }}>{row.name}</p>
                <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>{row.maturity.label}</p>
              </td>
              {COLUMNS.map(([key]) => (
                <td key={key} className="px-3 py-4 align-top">
                  <button type="button" onClick={() => onOpen(row, key)}
                    className="ui-press w-full rounded-[var(--r-control)] px-2 py-1.5 text-left hover:bg-[color:var(--ink-100)]">
                    <MetricValue value={valueOf(row, key)} maturity={row.maturity}
                      suffix={key === 'human' ? '%' : '%'} />
                    <span className="tp-meta mt-0.5 block" style={{ color: 'var(--brand-navy-700)' }}>
                      {key === 'confidence' ? 'Why this score?' : 'Inspect'}
                    </span>
                  </button>
                </td>
              ))}
              <td className="px-5 py-4 align-top">
                {/* The trend is a conclusion too, so it drills down like the rest. */}
                <button type="button" onClick={() => onOpen(row, 'trend')}
                  className="ui-press rounded-[var(--r-control)] px-2 py-1.5 text-left hover:bg-[color:var(--ink-100)]">
                  <TrendBadge trend={row.trend} />
                  <span className="tp-meta mt-0.5 block" style={{ color: 'var(--brand-navy-700)' }}>Why did this change?</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}