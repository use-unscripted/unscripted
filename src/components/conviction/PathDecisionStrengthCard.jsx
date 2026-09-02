/**
 * How much weight the evidence behind this path carries. Same card shape and tone
 * as DecisionReadinessCard, because the two are one family and are read together.
 */
import { Scale } from 'lucide-react';
import PathStrengthGauge from '@/components/conviction/PathStrengthGauge';
import { STRENGTH_VS_READINESS } from '@/lib/path-decision-strength';

export default function PathDecisionStrengthCard({ strength }) {
  if (!strength) return null;

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Scale size={17} style={{ color: 'var(--brand-navy-700)' }} /> Path Decision Strength
      </h2>

      <div className="mt-4 flex flex-wrap items-start gap-5">
        <PathStrengthGauge strength={strength} />
        <p className="tp-prose min-w-[200px] flex-1" style={{ color: 'var(--text-secondary)' }}>
          {strength.meaning}
        </p>
      </div>

      {strength.reasons?.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {strength.reasons.map(r => (
            <li key={r} className="tp-meta" style={{ color: 'var(--text-secondary)' }}>· {r}</li>
          ))}
        </ul>
      )}

      {strength.heldDownByContradiction && (
        <div
          className="app-inset mt-4 p-4"
          style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-700)' }}
        >
          <p className="tp-body font-semibold" style={{ color: 'var(--warning-700)' }}>
            Held down by a disagreement that is still open
          </p>
          <p className="tp-prose mt-1" style={{ color: 'var(--text-secondary)' }}>
            Both readings are kept. This cannot read above Moderate until another test settles which one holds.
          </p>
        </div>
      )}

      <p className="tp-meta mt-3" style={{ color: 'var(--ink-400)' }}>{STRENGTH_VS_READINESS}</p>
    </section>
  );
}