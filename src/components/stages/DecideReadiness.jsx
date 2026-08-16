/**
 * The gate on the Decide stage: the decision opens once every key dimension of
 * this path has at least one reading. Until then this says which are missing and
 * links each one straight to a short test.
 */
import { Link } from 'react-router-dom';
import { Circle, Lock, CheckCircle2 } from 'lucide-react';
import { decideReadiness, readinessMessage } from '@/lib/decide-readiness';

export default function DecideReadiness({ progress, pathId }) {
  const readiness = decideReadiness(progress);
  const message = readinessMessage(readiness);

  if (readiness.ready) {
    return (
      <section className="app-card p-6">
        <h2 className="tp-section flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <CheckCircle2 size={17} style={{ color: 'var(--success-700)' }} /> This decision is ready to record
        </h2>
        <p className="tp-prose mt-1.5" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        <Link
          to="/reflect"
          className="app-cta tp-body mt-4 font-bold"
          style={{ minHeight: '48px' }}
        >
          Conclude this test
        </Link>
      </section>
    );
  }

  return (
    <section className="app-card p-6">
      <h2 className="tp-section flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Lock size={16} style={{ color: 'var(--warning-700)' }} /> A few dimensions still have no reading
      </h2>
      <p className="tp-prose mt-1.5" style={{ color: 'var(--text-secondary)' }}>{message}</p>

      <ul className="mt-4 space-y-2.5">
        {readiness.remaining.map(row => (
          <li
            key={row.id}
            className="flex flex-wrap items-start gap-3 rounded-[var(--r-control)] p-3"
            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
          >
            <Circle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ink-400)' }} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="tp-body block font-semibold" style={{ color: 'var(--text-primary)' }}>
                {row.question || row.label}
              </span>
              <span className="tp-meta block" style={{ color: 'var(--ink-400)' }}>{row.label} · never tested</span>
            </span>
            <Link
              to={`/moment?recId=${pathId || ''}&variable=${encodeURIComponent(row.id)}`}
              className="tp-meta shrink-0 font-bold"
              style={{ color: 'var(--brand-navy-700)', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}
            >
              Quick Test this
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}