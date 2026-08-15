import { Check, Circle } from 'lucide-react';

/**
 * What this experiment tests, and what it cannot simulate. Both halves always
 * render: no experiment is allowed to look like it represents a whole career.
 */
export default function TestsAndLimits({ validation, tests = [] }) {
  const represented = validation?.career_characteristics_represented?.length
    ? validation.career_characteristics_represented
    : tests.map(t => t.label);
  const notRepresented = validation?.career_characteristics_not_represented || [];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <section>
        <h3 className="tp-section" style={{ color: 'var(--text-primary)' }}>What this experiment tests</h3>
        {represented.length ? (
          <ul className="mt-2 space-y-1.5">
            {represented.map((t, i) => (
              <li key={i} className="tp-body flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--success-700)' }} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="tp-body mt-2" style={{ color: 'var(--text-muted)' }}>
            The dimensions this experiment tests have not been mapped yet.
          </p>
        )}
      </section>

      <section>
        <h3 className="tp-section" style={{ color: 'var(--text-primary)' }}>What it cannot fully simulate</h3>
        {notRepresented.length ? (
          <ul className="mt-2 space-y-1.5">
            {notRepresented.map((t, i) => (
              <li key={i} className="tp-body flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Circle size={13} className="mt-1 shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="tp-body mt-2" style={{ color: 'var(--text-muted)' }}>
            No experiment represents an entire career. The parts this one leaves out have not been
            documented yet, so treat what you learn here as one slice of the work.
          </p>
        )}
      </section>
    </div>
  );
}