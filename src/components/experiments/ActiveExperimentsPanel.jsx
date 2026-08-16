/**
 * Every experiment currently open, with how far through it the student is.
 *
 * Running two or three at once is normal, and until now nothing showed them
 * side by side, so it was impossible to see which was nearly finished.
 */
import { Link } from 'react-router-dom';
import { CheckCircle2, PlayCircle, Clock } from 'lucide-react';

function Row({ row }) {
  const awaiting = row.awaitingReflection;
  const to = awaiting ? `/reflect?experimentId=${row.id}` : `/experiment?experimentId=${row.id}`;
  const Icon = awaiting ? CheckCircle2 : row.status === 'in_progress' ? PlayCircle : Clock;

  return (
    <Link
      to={to}
      className="app-card-flat ui-lift block p-4"
      style={{ minHeight: '44px' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tp-body font-bold truncate" style={{ color: 'var(--text-primary)' }}>{row.title}</p>
          {row.pathName && (
            <p className="tp-meta mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{row.pathName}</p>
          )}
        </div>
        <span className="tp-meta inline-flex shrink-0 items-center gap-1 font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
          <Icon size={13} />
          {awaiting ? 'Ready to reflect' : row.status === 'in_progress' ? 'In progress' : 'Not started'}
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--ink-200)' }}>
        <div
          className="progress-fill h-full rounded-full"
          style={{ width: `${row.percent}%`, background: awaiting ? 'var(--success-700)' : 'var(--brand-gold-500)' }}
        />
      </div>
      <p className="tp-meta mt-2" style={{ color: 'var(--text-secondary)' }}>
        {row.stepsTotal
          ? `${row.stepsDone} of ${row.stepsTotal} steps complete`
          : awaiting
            ? 'Work finished, reflection still open'
            : 'No steps set up yet'}
      </p>
    </Link>
  );
}

const SHOWN = 6;

export default function ActiveExperimentsPanel({ rows = [] }) {
  if (!rows.length) return null;
  const shown = rows.slice(0, SHOWN);
  const hidden = rows.length - shown.length;

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-card" style={{ color: 'var(--text-primary)' }}>
        Your open experiments ({rows.length})
      </h2>
      <p className="tp-prose mt-1" style={{ color: 'var(--text-secondary)' }}>
        Where each one stands. Finishing the steps of one opens its reflection.
      </p>
      <div className="mt-4 space-y-3">
        {shown.map(row => <Row key={row.id} row={row} />)}
      </div>
      {hidden > 0 && (
        <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
          <Link to="/experiments" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
            {hidden} more open {hidden === 1 ? 'experiment' : 'experiments'}
          </Link>
        </p>
      )}
    </section>
  );
}