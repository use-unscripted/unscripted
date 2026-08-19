import { STATES } from '@/lib/conviction-record';

const TONE = {
  muted: { bg: 'var(--background-tertiary)', fg: 'var(--text-muted)' },
  warning: { bg: 'var(--warning-50)', fg: 'var(--warning-700)' },
  info: { bg: 'var(--info-50)', fg: 'var(--info-700)' },
  success: { bg: 'var(--success-50)', fg: 'var(--success-700)' },
};

/**
 * The eight conviction areas, each with the state of the evidence behind it and
 * a plain sentence about what exists and what is missing. No percentages: a
 * handful of observations does not support a decimal point.
 */
export default function ConvictionRecord({ record }) {
  if (!record) return null;

  return (
    <section className="app-card p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Your Conviction Record</h2>
      <p className="tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>
        {record.withEvidence} of the {record.total} areas below have real evidence behind them, drawn from{' '}
        {record.basis.experiments} finished {record.basis.experiments === 1 ? 'test' : 'tests'},{' '}
        {record.basis.proof} {record.basis.proof === 1 ? 'piece' : 'pieces'} of proof and{' '}
        {record.basis.reflections} {record.basis.reflections === 1 ? 'reflection' : 'reflections'} on this path.
      </p>

      <ul className="mt-4 space-y-3">
        {record.areas.map(area => {
          const state = STATES[area.state] || STATES.none;
          const tone = TONE[state.tone];
          return (
            <li
              key={area.id}
              className="rounded-[var(--r-control)] p-4"
              style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{area.label}</p>
                <span className="tp-meta rounded-full px-2.5 py-0.5 font-bold"
                  style={{ background: tone.bg, color: tone.fg }}>
                  {state.label}
                </span>
              </div>
              <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>{area.question}</p>
              <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{area.detail}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}