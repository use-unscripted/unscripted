/**
 * Pick the next Quick Test from what this path has NOT been tested on yet.
 *
 * A student finishing one short test is the moment they are most likely to do
 * another, and being handed a single recommendation made that a yes/no. Here the
 * remaining gaps on the same path are listed, least evidence first, so getting
 * through the dimensions a path needs is a few taps rather than a new decision
 * every time. The first one is still Unscripted's recommendation.
 */
import { ArrowRight, CircleDashed, AlertTriangle } from 'lucide-react';

export default function MomentNextChoices({ options = [], onPick }) {
  if (!options.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {options.map(o => (
        <button
          key={o.variable}
          type="button"
          onClick={() => onPick(o)}
          className="ui-lift flex w-full items-start gap-3 rounded-[var(--r-control)] border p-3 text-left"
          style={{ borderColor: o.recommended ? 'var(--brand-navy-700)' : 'var(--ink-200)', minHeight: '52px' }}
        >
          {o.contradicted
            ? <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--warning-700)' }} />
            : <CircleDashed size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ink-400)' }} />}
          <span className="min-w-0 flex-1">
            <span className="tp-body block font-semibold" style={{ color: 'var(--surface-dark-900)' }}>
              {o.label}
              {o.recommended && (
                <span className="tp-meta ml-2 rounded-full px-2 py-0.5 font-bold"
                  style={{ background: 'var(--info-50)', color: 'var(--info-700)' }}>Recommended</span>
              )}
            </span>
            {o.question && (
              <span className="tp-meta mt-0.5 block" style={{ color: 'var(--ink-500)' }}>{o.question}</span>
            )}
            <span className="tp-meta mt-0.5 block" style={{ color: 'var(--ink-400)' }}>
              {o.contradicted ? 'Your evidence here points both ways' : o.untested ? 'Not tested yet' : 'Only partly tested'}
            </span>
          </span>
          <ArrowRight size={15} className="mt-1 shrink-0" style={{ color: 'var(--brand-navy-700)' }} />
        </button>
      ))}
    </div>
  );
}