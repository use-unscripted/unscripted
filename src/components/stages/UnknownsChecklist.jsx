import { Link } from 'react-router-dom';
import { CheckCircle2, CircleDashed, Circle, AlertTriangle } from 'lucide-react';

/**
 * The unknowns on the path being tested, as a checklist.
 *
 * Every row comes from the Career Uncertainty Map the path already carries, and
 * a row is only ticked when real evidence exists for it (dimension-progress
 * decides that, not this component). Opening a test moves nothing.
 */
const STATE = {
  tested: { Icon: CheckCircle2, color: 'var(--success-700)', label: 'Tested' },
  partial: { Icon: CircleDashed, color: 'var(--warning-700)', label: 'One reading so far' },
  untested: { Icon: Circle, color: 'var(--ink-400)', label: 'Not tested yet' },
};

export default function UnknownsChecklist({ progress, pathId }) {
  if (!progress?.rows?.length) return null;

  return (
    <section className="app-card p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
        What you still need to test on this path
      </h2>
      <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
        {progress.testedCount} of {progress.total} have real evidence behind them. {progress.message}
      </p>

      <ul className="mt-4 space-y-2.5">
        {progress.rows.map(row => {
          const { Icon, color, label } = STATE[row.status] || STATE.untested;
          return (
            <li
              key={row.id}
              className="flex flex-wrap items-start gap-3 rounded-[var(--r-control)] p-3"
              style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
            >
              <Icon size={16} className="mt-0.5 shrink-0" style={{ color }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="tp-body block font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {row.question || row.label}
                </span>
                <span className="tp-meta block" style={{ color: 'var(--ink-400)' }}>
                  {row.label} · {label}
                  {row.contradicted && (
                    <span className="ml-1.5 inline-flex items-center gap-1" style={{ color: 'var(--warning-700)' }}>
                      <AlertTriangle size={11} /> readings went both ways
                    </span>
                  )}
                </span>
              </span>
              {row.status !== 'tested' && (
                <Link
                  to={`/moment?recId=${pathId || ''}&variable=${encodeURIComponent(row.id)}`}
                  className="tp-meta shrink-0 font-bold"
                  style={{ color: 'var(--brand-navy-700)', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}
                >
                  Test this
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}