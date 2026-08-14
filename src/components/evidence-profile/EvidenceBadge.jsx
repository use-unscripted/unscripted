import { EVIDENCE_LEVELS, TIER_LABELS } from '@/lib/evidence-graph';

const TONES = {
  success: { bg: 'var(--success-50)', text: 'var(--success-700)' },
  info: { bg: 'var(--info-50)', text: 'var(--info-700)' },
  muted: { bg: 'var(--ink-100)', text: 'var(--ink-500)' },
};

/** The evidence level of a conclusion, never a certainty claim. */
export function EvidenceBadge({ summary, overrideLabel }) {
  const level = EVIDENCE_LEVELS[summary?.level || 'none'];
  const tone = TONES[level.tone];
  return (
    <span className="tp-meta rounded-full px-2.5 py-1 font-bold" style={{ background: tone.bg, color: tone.text }}>
      {overrideLabel || level.label}
    </span>
  );
}

/** Confidence, plus how many sources stand behind it and how strong they are. */
export function ConfidenceMeter({ summary, label = 'Confidence' }) {
  const pct = summary?.confidence || 0;
  return (
    <div>
      <div className="tp-meta mb-1.5 flex justify-between" style={{ color: 'var(--ink-500)' }}>
        <span>{label}</span>
        <span className="font-semibold" style={{ color: 'var(--surface-dark-900)' }}>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--ink-100)' }}>
        <div className="progress-fill h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-navy-900)' }} />
      </div>
      <p className="tp-meta mt-1.5" style={{ color: 'var(--ink-400)' }}>
        {summary?.count || 0} evidence source{summary?.count === 1 ? '' : 's'}
        {summary?.tier ? ` · ${TIER_LABELS[summary.tier]}` : ''}
      </p>
    </div>
  );
}

export default EvidenceBadge;