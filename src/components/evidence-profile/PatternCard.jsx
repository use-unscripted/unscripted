import { EvidenceBadge } from '@/components/evidence-profile/EvidenceBadge';
import EvidenceProvenance from '@/components/evidence-profile/EvidenceProvenance';

const round = (n) => (typeof n === 'number' ? Math.round(n * 10) / 10 : null);

/**
 * A repeated pattern behind energy or frustration.
 * Drains are stated as evidence about work fit, never as a shortcoming.
 */
export default function PatternCard({ pattern, flagged }) {
  const drain = pattern.kind === 'drain';
  const metrics = [
    ['Enjoyment', round(pattern.enjoyment)],
    ['Energy', round(pattern.energy)],
    ['Want to repeat', round(pattern.desire)],
    drain ? ['Frustration', round(pattern.frustration)] : null,
  ].filter(m => m && m[1] !== null);

  return (
    <div className="rounded-[var(--r-surface)] border bg-white p-5" style={{ borderColor: 'var(--ink-200)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="tp-card" style={{ color: 'var(--surface-dark-900)' }}>{pattern.label}</h3>
        <EvidenceBadge summary={pattern.summary} overrideLabel={pattern.preliminary ? 'Preliminary' : undefined} />
      </div>

      <p className="tp-body mt-2" style={{ color: 'var(--ink-700)' }}>
        {drain
          ? `Work involving ${pattern.label.toLowerCase()} has rated lower on enjoyment and energy for you. That is evidence about work fit, not about ability.`
          : `Work involving ${pattern.label.toLowerCase()} has rated highest on enjoyment, energy and wanting to do it again.`}
      </p>

      <div className="tp-meta mt-3 flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--ink-500)' }}>
        {metrics.map(([label, value]) => (
          <span key={label}>{label} <strong style={{ color: 'var(--surface-dark-900)' }}>{value}/10</strong></span>
        ))}
      </div>

      {pattern.preliminary && (
        <p className="tp-meta mt-2" style={{ color: 'var(--ink-400)' }}>
          Based on one rated experiment so far, so treat this as preliminary.
        </p>
      )}

      <EvidenceProvenance
        summary={pattern.summary}
        type={drain ? 'drain' : 'energiser'}
        conclusionKey={`${pattern.kind}:${pattern.id}`}
        label={pattern.label}
        alreadyFlagged={flagged}
      />
    </div>
  );
}