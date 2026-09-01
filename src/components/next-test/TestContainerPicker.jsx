import { containersForGap } from '@/lib/test-containers';

/**
 * Where this test runs. The same single piece of state as the evidence ladder —
 * a container maps onto one rung — so picking here moves the ladder too. Shown
 * only when the gap can be tested in more than one container; a gap with one
 * honest container has no choice to offer.
 */
export default function TestContainerPicker({ selectedMethod, onSelect, recommendation = null, disabled = false }) {
  const containers = containersForGap({ recommendation });
  const open = containers.filter(c => c.available);
  if (open.length < 2) return null;

  return (
    <section className="app-card mb-4 p-5 sm:p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Where do you want to run it?</h2>
      <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>
        Each one ends by submitting the evidence it produces.
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {open.map(c => {
          const isSelected = selectedMethod === c.method;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect?.(c.method)}
                aria-pressed={isSelected}
                className="app-card-flat h-full w-full p-3 text-left disabled:opacity-60"
                style={{ borderColor: isSelected ? 'var(--brand-navy-700)' : 'var(--border-light)' }}
              >
                <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{c.label}</p>
                <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>{c.blurb}</p>
                <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>{c.submitAsks}</p>
                {isSelected && (
                  <p className="tp-meta mt-1.5 font-bold" style={{ color: 'var(--brand-navy-700)' }}>Selected</p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}