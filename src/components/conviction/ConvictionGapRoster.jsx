import { GAP_STATES } from '@/lib/conviction-gaps';

/**
 * All eight Conviction Gaps for a path, with the state of each and a way to
 * start a test on it. A plain count, never a percentage or a score.
 */
const TONE = {
  muted: { bg: 'var(--background-tertiary)', fg: 'var(--text-muted)' },
  info: { bg: 'var(--info-50)', fg: 'var(--info-700)' },
  success: { bg: 'var(--success-50)', fg: 'var(--success-700)' },
};

export default function ConvictionGapRoster({ roster, selectedId = null, onStartTest }) {
  if (!roster?.gaps?.length) return null;
  const { gaps, withEvidence, total } = roster;

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>What you still do not know</h2>
      <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>
        {withEvidence} of {total} gaps have evidence behind them.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {gaps.map(gap => {
          const tone = TONE[GAP_STATES[gap.state].tone];
          const selected = selectedId === gap.id;
          return (
            <li
              key={gap.id}
              className="app-card-flat flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              style={selected ? { borderColor: 'var(--brand-navy-700)' } : undefined}
            >
              <div className="min-w-0">
                <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{gap.label}</p>
                <p className="tp-meta mt-0.5" style={{ color: 'var(--text-secondary)' }}>{gap.question}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="tp-meta rounded-full px-3 py-1 font-bold"
                  style={{ background: tone.bg, color: tone.fg }}>
                  {GAP_STATES[gap.state].label}
                </span>
                <button
                  type="button"
                  onClick={() => onStartTest?.(gap)}
                  className="tp-meta touch-target app-cta-secondary font-bold"
                  style={{ padding: '0.5rem 0.9rem' }}
                >
                  {selected ? 'Selected' : 'Test this'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}