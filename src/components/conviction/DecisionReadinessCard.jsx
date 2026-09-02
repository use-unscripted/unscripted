/**
 * Where this path stands on Decision Readiness, and what is holding it there.
 * A state and its gaps, never a percentage.
 */
import { Gauge } from 'lucide-react';
import { READINESS_STATES } from '@/lib/decision-readiness-state';

const TONE = {
  muted: { bg: 'var(--ink-100)', fg: 'var(--ink-500)' },
  info: { bg: 'var(--info-50)', fg: 'var(--info-700)' },
  warning: { bg: 'var(--warning-50)', fg: 'var(--warning-700)' },
  success: { bg: 'var(--success-50)', fg: 'var(--success-700)' },
};

const ORDER = ['exploring', 'building', 'questions', 'approaching', 'ready'];

export default function DecisionReadinessCard({ readiness }) {
  if (!readiness) return null;
  const tone = TONE[readiness.tone] || TONE.muted;

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Gauge size={17} style={{ color: 'var(--brand-navy-700)' }} /> Decision Readiness
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ORDER.map(key => {
          const stage = READINESS_STATES[key];
          const current = key === readiness.key;
          return (
            <span
              key={key}
              className="tp-meta rounded-full px-3 py-1 font-semibold"
              style={{
                background: current ? tone.bg : 'transparent',
                color: current ? tone.fg : 'var(--ink-400)',
                border: `1px solid ${current ? tone.fg : 'var(--border-light)'}`,
              }}
            >
              {stage.label}
            </span>
          );
        })}
      </div>

      <p className="tp-prose mt-3" style={{ color: 'var(--text-secondary)' }}>{readiness.meaning}</p>

      {readiness.reasons?.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {readiness.reasons.map(r => (
            <li key={r} className="tp-meta" style={{ color: 'var(--text-secondary)' }}>· {r}</li>
          ))}
        </ul>
      )}

      {readiness.gaps?.length > 0 && (
        <div
          className="mt-4 rounded-[var(--r-control)] p-4"
          style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
        >
          <p className="tp-meta font-semibold uppercase" style={{ color: 'var(--ink-400)', letterSpacing: '0.06em' }}>
            Areas still thin
          </p>
          <ul className="mt-2 space-y-1.5">
            {readiness.gaps.map(g => (
              <li key={g.id} className="tp-meta" style={{ color: 'var(--text-secondary)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{g.label}.</span> {g.why}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="tp-meta mt-3" style={{ color: 'var(--ink-400)' }}>
Decision Ready means enough evidence to decide for yourself, not that this career is right.
      </p>
    </section>
  );
}