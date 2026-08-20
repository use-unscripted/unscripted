/**
 * The dimensions this one hypothesis turns on, answered from the shared evidence
 * store rather than per career — so a dimension already tested elsewhere shows
 * as known here, with the career it was learned on named. Transfer is labelled
 * as transfer, because a preference does not carry across contexts perfectly.
 */
import { Check, HelpCircle, Scale, ArrowRightLeft } from 'lucide-react';
import { deriveDimensions, dimensionsForCareer, EVIDENCE_LEVEL_LABELS } from '@/lib/career-dimensions';

const ICON = {
  strong: { icon: Check, tone: 'var(--success-700)' },
  moderate: { icon: Check, tone: 'var(--success-700)' },
  weak: { icon: HelpCircle, tone: 'var(--brand-navy-700)' },
  conflicting: { icon: Scale, tone: 'var(--warning-700)' },
  unknown: { icon: HelpCircle, tone: 'var(--ink-400)' },
};

export default function HypothesisDimensions({ hypothesis, careerName, signals = [], profile = {} }) {
  const view = dimensionsForCareer({
    hypothesis,
    dimensions: deriveDimensions({ signals, profile }),
    careerName,
  });
  if (!view?.rows?.length) return null;

  return (
    <div className="rounded-[var(--r-control)] bg-white p-4" style={{ border: '1px solid var(--border-light)' }}>
      <p className="tp-eyebrow mb-2" style={{ color: 'var(--brand-navy-700)' }}>Dimensions this hypothesis turns on</p>
      <ul className="space-y-2">
        {view.rows.slice(0, 8).map(r => {
          const { icon: Icon, tone } = ICON[r.current_evidence_level] || ICON.unknown;
          return (
            <li key={r.dimension} className="flex items-start gap-2">
              <Icon size={14} className="mt-0.5 shrink-0" style={{ color: tone }} />
              <div className="min-w-0">
                <p className="tp-body text-[color:var(--ink-700)]">
                  <span className="font-semibold">{r.dimension_label}</span>
                  <span className="tp-meta text-[color:var(--ink-400)]"> · {EVIDENCE_LEVEL_LABELS[r.current_evidence_level]}</span>
                </p>
                {r.transferred && (
                  <p className="tp-meta flex items-start gap-1.5 text-[color:var(--ink-400)]">
                    <ArrowRightLeft size={11} className="mt-0.5 shrink-0" /> {r.transfer_note}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {view.unknown.length > 0 && (
        <p className="tp-meta mt-3 text-[color:var(--ink-500)]">
          Still unknown here: {view.unknown.slice(0, 3).map(r => r.dimension_label.toLowerCase()).join(', ')}.
        </p>
      )}
    </div>
  );
}