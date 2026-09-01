import { EVIDENCE_METHODS, LADDER_NOTE, methodAvailability } from '@/lib/evidence-methods';

/**
 * The six ways to test one Conviction Gap, weakest evidence on the left. The
 * recommended method arrives selected; choosing another regenerates the
 * recommendation at that method. Unavailable methods stay on screen, greyed with
 * a reason, so the student can see the whole ladder they are climbing.
 */
export default function EvidenceMethodLadder({ selected, onSelect, recommendation = null, disabled = false }) {
  return (
    <section className="app-card mb-4 p-5 sm:p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>How do you want to test this?</h2>
      <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>{LADDER_NOTE}</p>

      <ol className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {EVIDENCE_METHODS.map(method => {
          const { available, reason } = methodAvailability(method.id, { recommendation });
          const isSelected = selected === method.id;
          return (
            <li key={method.id} className="min-w-[150px] flex-1">
              <button
                type="button"
                disabled={!available || disabled}
                onClick={() => onSelect?.(method.id)}
                aria-pressed={isSelected}
                className="app-card-flat h-full w-full p-3 text-left disabled:cursor-not-allowed"
                style={{
                  borderColor: isSelected ? 'var(--brand-navy-700)' : 'var(--border-light)',
                  background: available ? 'var(--background-primary)' : 'var(--background-tertiary)',
                  opacity: available ? 1 : 0.7,
                }}
              >
                <p className="tp-body font-bold" style={{ color: available ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {method.label}
                </p>
                <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>{method.asks}</p>
                {!available && (
                  <p className="tp-meta mt-1.5 font-semibold" style={{ color: 'var(--text-muted)' }}>{reason}</p>
                )}
                {isSelected && available && (
                  <p className="tp-meta mt-1.5 font-bold" style={{ color: 'var(--brand-navy-700)' }}>Selected</p>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}