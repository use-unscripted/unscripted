/**
 * The three moves at the bottom of every step. Nothing is silently disabled:
 * when something is still outstanding, pressing the primary button says exactly
 * what remains.
 */
import { ArrowLeft, ArrowRight, Check, LogOut } from 'lucide-react';

export default function GuidedNav({ stepNumber, total, isDone, blockers, showBlockers, onBack, onExit, onNext, busy }) {
  const lastStep = stepNumber === total;

  return (
    <div className="mt-5">
      {showBlockers && blockers.length > 0 && (
        <div role="alert" className="mb-3 rounded-[var(--r-control)] p-3" style={{ background: 'var(--warning-50)', border: '1px solid rgba(180,83,9,0.25)' }}>
          <p className="tp-body font-bold" style={{ color: 'var(--warning-700)' }}>Before you continue</p>
          <ul className="mt-1 space-y-1">
            {blockers.map((b, i) => (
              <li key={i} className="tp-body" style={{ color: 'var(--text-secondary)' }}>· {b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onBack}
          className="ui-press tp-body inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] border px-5 font-semibold sm:order-1"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <button
          type="button"
          onClick={onExit}
          className="ui-press tp-body inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] px-5 font-semibold sm:order-2"
          style={{ color: 'var(--brand-navy-700)', minHeight: '48px' }}
        >
          <LogOut size={15} /> Save & exit
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={busy}
          className="ui-press tp-body inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--r-control)] px-6 font-bold text-white disabled:opacity-60 sm:order-3"
          style={{ background: 'var(--brand-navy-900)', minHeight: '52px' }}
        >
          {busy ? 'Saving…' : isDone
            ? <>{lastStep ? 'Finish experiment' : 'Next step'} <ArrowRight size={16} /></>
            : <><Check size={16} /> {lastStep ? 'Mark done & finish' : 'Mark done & continue'}</>}
        </button>
      </div>
      <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
        Your progress saves as you go. Nothing you typed is lost if you go back.
      </p>
    </div>
  );
}