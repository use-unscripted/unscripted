/**
 * Task performance beside experienced fit, never merged into one score.
 *
 * Doing something well and wanting to do it for years are different findings, and
 * the interpretation line always says which one is which.
 */
export default function PerformanceVsFit({ reading }) {
  if (!reading) return null;

  return (
    <section className="app-card-flat p-5">
      <h3 className="tp-card" style={{ color: 'var(--text-primary)' }}>Performance and fit</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-[var(--r-control)] p-3" style={{ background: 'var(--ink-50)' }}>
          <p className="tp-label" style={{ color: 'var(--ink-500)' }}>Task performance</p>
          <p className="tp-body mt-1 font-bold" style={{ color: 'var(--ink-900)' }}>{reading.performance_label}</p>
        </div>
        <div className="rounded-[var(--r-control)] p-3" style={{ background: 'var(--ink-50)' }}>
          <p className="tp-label" style={{ color: 'var(--ink-500)' }}>Experienced fit</p>
          <p className="tp-body mt-1 font-bold" style={{ color: 'var(--ink-900)' }}>{reading.fit_label}</p>
        </div>
      </div>
      <p className="tp-body mt-3" style={{ color: 'var(--text-secondary)' }}>{reading.interpretation}</p>
      <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>{reading.caution}</p>
    </section>
  );
}