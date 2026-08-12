/**
 * Where the student is: "Step 3 of 7", a bar, and a compact list of every step
 * with its status. Steps already reached can be reopened; steps further ahead
 * stay closed so nothing important is skipped by accident.
 */
import { useState } from 'react';
import { Check, Circle, Dot, List, X } from 'lucide-react';

export default function GuidedProgress({ steps, stepNumber, completed, maxReachable, onJump }) {
  const [open, setOpen] = useState(false);
  const total = steps.length;
  const pct = total ? Math.round((completed.length / total) * 100) : 0;

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-4" style={{ border: '1px solid var(--border-light)' }}>
      <div className="flex items-center justify-between gap-3">
        <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>
          Step {stepNumber} of {total}
        </p>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="tp-meta inline-flex items-center gap-1.5 rounded-[var(--r-control)] border px-3 font-bold"
          style={{ borderColor: 'var(--border-light)', color: 'var(--brand-navy-700)', minHeight: '40px' }}
        >
          {open ? <X size={13} /> : <List size={13} />} {open ? 'Hide steps' : 'View all steps'}
        </button>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--background-tertiary)' }}>
        <div className="progress-fill h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-gold-500)' }} />
      </div>
      <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>{completed.length} of {total} steps complete</p>

      {open && (
        <ol className="mt-3 space-y-1">
          {steps.map((s, i) => {
            const n = i + 1;
            const isDone = completed.includes(n);
            const isCurrent = n === stepNumber;
            const reachable = n <= maxReachable;
            return (
              <li key={n}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => { setOpen(false); onJump(n); }}
                  className="tp-body flex w-full items-center gap-2.5 rounded-[var(--r-control)] px-3 text-left"
                  style={{
                    minHeight: '46px',
                    background: isCurrent ? 'var(--background-tertiary)' : 'transparent',
                    color: reachable ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: isCurrent ? 700 : 500,
                  }}
                >
                  <span className="shrink-0" style={{ color: isDone ? 'var(--success-700)' : 'var(--text-muted)' }}>
                    {isDone ? <Check size={15} /> : isCurrent ? <Dot size={19} /> : <Circle size={13} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">Step {n} — {s.title || 'Untitled step'}</span>
                  {!reachable && <span className="tp-meta shrink-0">Locked</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}