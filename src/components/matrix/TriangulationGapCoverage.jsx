/**
 * Gap by gap coverage: which of the eight gaps were tested, at which method, and
 * which have only one reading behind them.
 */
const TONE = {
  untested: { bg: 'var(--ink-100)', fg: 'var(--text-secondary)', label: 'Untested' },
  tested_once: { bg: 'var(--info-50)', fg: 'var(--info-700)', label: 'Tested once' },
  tested_more: { bg: 'var(--success-50)', fg: 'var(--success-700)', label: 'Tested more than once' },
};

export default function TriangulationGapCoverage({ coverage = [], testedOnce = 0 }) {
  if (!coverage.length) return null;
  return (
    <div>
      <div className="space-y-2">
        {coverage.map(g => {
          const tone = TONE[g.state] || TONE.untested;
          return (
            <div key={g.id} className="app-inset flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              style={{ background: 'var(--ink-50)' }}>
              <div className="min-w-0">
                <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{g.label}</p>
                <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {g.methods.length
                    ? `Tested at ${g.methods.join(', ')}`
                    : 'Nothing has been tested here yet.'}
                </p>
              </div>
              <span className="tp-meta rounded-full px-3 py-1 font-semibold" style={{ background: tone.bg, color: tone.fg }}>
                {tone.label}
              </span>
            </div>
          );
        })}
      </div>
      {testedOnce > 0 && (
        <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
          {testedOnce} {testedOnce === 1 ? 'gap rests' : 'gaps rest'} on a single reading, so a second test there would add the most.
        </p>
      )}
    </div>
  );
}