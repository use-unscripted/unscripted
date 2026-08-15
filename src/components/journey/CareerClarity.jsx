import { Reveal } from '@/components/motion';

/**
 * Career clarity, reported rather than scored.
 *
 * Clarity is allowed to go down: testing a career and finding it does not fit
 * often makes a student less certain for a while, and that is real progress.
 * Nothing here is styled as a target, a streak or a percentage complete.
 */
function Stat({ label, value }) {
  return (
    <div className="rounded-[var(--r-control)] p-4" style={{ background: 'var(--ink-50)' }}>
      <p className="tp-eyebrow" style={{ color: 'var(--ink-400)' }}>{label}</p>
      <p className="tp-card mt-1 font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

export default function CareerClarity({ clarity }) {
  if (!clarity) return null;
  const { baseline, current, hypothesesTested, unknownsResolved, experimentsCompleted } = clarity;

  return (
    <Reveal y={20}>
      <section className="app-card p-6">
        <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Career clarity</h2>
        <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
          How your thinking has moved. Clarity going down after a test is normal, and it still counts as learning.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Baseline clarity" value={baseline === null ? 'Not recorded' : `${baseline}/10`} />
          <Stat label="Current clarity" value={current === null ? 'Not rated yet' : `${current}/10`} />
          <Stat label="Paths tested" value={hypothesesTested} />
          <Stat label="Unknowns resolved" value={unknownsResolved} />
          <Stat label="Experiments completed" value={experimentsCompleted} />
        </div>
      </section>
    </Reveal>
  );
}