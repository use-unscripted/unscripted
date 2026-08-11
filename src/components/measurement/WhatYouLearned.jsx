/**
 * "What You Learned" — expected against actual, in the student's own numbers.
 *
 * Rows whose pre answer is missing (a historical experiment measured only at the
 * end) show the actual figure alone rather than a delta from nothing. No score
 * anywhere else in the product is changed by this view.
 */
import { ArrowRight } from 'lucide-react';

function Row({ label, expected, actual }) {
  const both = typeof expected === 'number' && typeof actual === 'number';
  const delta = both ? actual - expected : null;
  const tone = delta === null || delta === 0
    ? 'var(--text-secondary)'
    : delta > 0 ? 'var(--success-700)' : 'var(--warning-700)';

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--ink-200)] py-2.5 last:border-0">
      <span className="tp-body" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="tp-body flex shrink-0 items-center gap-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
        {both ? (
          <>
            {expected}/10 <ArrowRight size={13} style={{ color: 'var(--ink-300)' }} /> {actual}/10
            {delta !== 0 && (
              <span className="tp-meta rounded-full px-2 py-0.5 font-bold" style={{ background: 'var(--ink-100)', color: tone }}>
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
          </>
        ) : (
          <>{typeof actual === 'number' ? `${actual}/10` : '—'}</>
        )}
      </span>
    </div>
  );
}

function Plain({ label, value }) {
  if (typeof value !== 'number') return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--ink-200)] py-2.5 last:border-0">
      <span className="tp-body" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{value}/10</span>
    </div>
  );
}

export default function WhatYouLearned({ m, compact = false }) {
  if (!m?.post_completed_at) return null;

  return (
    <div className={compact ? '' : 'rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-4'}>
      <p className="tp-eyebrow mb-1" style={{ color: 'var(--brand-navy-700)' }}>What you learned</p>

      <div className="mt-2">
        <Row label="Enjoyment" expected={m.expected_enjoyment} actual={m.actual_enjoyment} />
        <Row label="Difficulty" expected={m.expected_difficulty} actual={m.actual_difficulty} />
        <Row label="Energy" expected={m.expected_energy} actual={m.actual_energy} />
        <Row label="Career confidence" expected={m.pre_career_fit_confidence} actual={m.post_career_fit_confidence} />
        <Plain label="Desire to do similar work again" value={m.desire_to_repeat} />
        <Plain label="Frustration" value={m.frustration_level} />
        <Plain label="How well you think you did" value={m.self_rated_performance} />
        {typeof m.system_performance_score === 'number' && (
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="tp-body" style={{ color: 'var(--text-secondary)' }}>Unscripted's rating of the work</span>
            <span className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{m.system_performance_score}/10</span>
          </div>
        )}
      </div>

      {m.surprise_reflection && (
        <p className="tp-body mt-3 rounded-[var(--r-control)] px-3.5 py-2.5" style={{ background: 'var(--ink-50)', color: 'var(--ink-700)' }}>
          <span className="font-semibold">What surprised you: </span>{m.surprise_reflection}
        </p>
      )}

      <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
        Your expectations changed after trying the work. Unscripted will use this evidence to improve its understanding of what may fit you.
      </p>
    </div>
  );
}