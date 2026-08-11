import { Check, Circle, MinusCircle } from 'lucide-react';

/**
 * What has and has not been tested on one career.
 *
 * Every row is a dimension the Career Uncertainty Map already says matters here,
 * and a tick means real evidence exists — never that an experiment was opened.
 */
export default function DimensionProgress({ progress, compact = false }) {
  if (!progress?.total) return null;
  const { tested, partial, untested, testedCount, total, confidence, evidenceStatus, message } = progress;
  const pct = Math.round((testedCount / total) * 100);

  const Row = ({ row, icon, color }) => (
    <li className="tp-body flex items-center gap-2" style={{ color }}>
      {icon}
      <span>{row.label}</span>
      {row.contradicted && <span className="tp-meta" style={{ color: 'var(--warning-700)' }}>readings differ</span>}
    </li>
  );

  return (
    /* Compact means this is already sitting inside a bordered row inside a
       card. A third outline there is three boxes deep, which the marketing
       page never does: its inset blocks are a flat tint with no border at all.
       Standalone, on the paths screen, it is still a box of its own. */
    <div
      className={compact ? 'app-inset p-4' : 'rounded-[var(--r-control)] border p-4'}
      style={compact
        ? { background: 'var(--ink-50)' }
        : { borderColor: 'var(--border-light)', background: 'white' }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="tp-label" style={{ color: 'var(--ink-500)' }}>Your evidence progress</p>
        <span className="tp-meta rounded-full px-2.5 py-0.5 font-bold"
          style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>
          Evidence status: {evidenceStatus.label}
        </span>
      </div>

      <p className="tp-body mt-2 font-semibold" style={{ color: 'var(--surface-dark-900)' }}>
        {testedCount} of {total} key dimensions tested
      </p>
      <div className="progress-fill mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--ink-100)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-navy-900)' }} />
      </div>

      {!compact && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {tested.length > 0 && (
            <div>
              <p className="tp-label mb-2" style={{ color: 'var(--success-700)' }}>Tested</p>
              <ul className="space-y-1.5">
                {tested.map(r => <Row key={r.id} row={r} color="var(--ink-700)"
                  icon={<Check size={14} style={{ color: 'var(--success-700)' }} aria-hidden="true" />} />)}
              </ul>
            </div>
          )}
          {(untested.length > 0 || partial.length > 0) && (
            <div>
              <p className="tp-label mb-2" style={{ color: 'var(--ink-500)' }}>Still to test</p>
              <ul className="space-y-1.5">
                {partial.map(r => <Row key={r.id} row={r} color="var(--ink-500)"
                  icon={<MinusCircle size={14} style={{ color: 'var(--warning-700)' }} aria-hidden="true" />} />)}
                {untested.map(r => <Row key={r.id} row={r} color="var(--ink-500)"
                  icon={<Circle size={13} style={{ color: 'var(--ink-300)' }} aria-hidden="true" />} />)}
              </ul>
            </div>
          )}
        </div>
      )}

      {typeof confidence === 'number' && (
        <p className="tp-meta mt-4" style={{ color: 'var(--ink-500)' }}>
          Current confidence: <strong style={{ color: 'var(--surface-dark-900)' }}>{confidence}%</strong>
        </p>
      )}
      <p className="tp-meta mt-1" style={{ color: 'var(--ink-500)' }}>{message}</p>
    </div>
  );
}