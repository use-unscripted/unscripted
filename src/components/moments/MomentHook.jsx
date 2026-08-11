import { Clock, ArrowRight } from 'lucide-react';
import ScaleInput from '@/components/measurement/ScaleInput';
import DepthBadge from '@/components/experiments/DepthBadge';

/**
 * Stage 1. The situation, and at most one expectation question — asked only
 * every few Moments, and only when it can be compared with a question this
 * Moment will ask afterwards.
 */
export default function MomentHook({ moment, onStart, preField, preValue, onPre }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[20px] p-6" style={{ background: 'var(--surface-dark-700)', color: 'white' }}>
        <p className="tp-eyebrow opacity-60">Quick Test · {moment.career_name}</p>
        <p className="tp-lead mt-3">{moment.hook}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DepthBadge depth="quick_test" showDuration={false} />
        <p className="tp-meta flex items-center gap-1.5" style={{ color: 'var(--ink-500)' }}>
          <Clock size={12} /> About {moment.estimated_minutes} minutes
        </p>
      </div>

      {preField && (
        <ScaleInput label={preField.label} low={preField.low} high={preField.high} value={preValue} onChange={onPre} />
      )}

      <button onClick={onStart}
        className="tp-body ui-press flex w-full items-center justify-center gap-2 rounded-[12px] py-3.5 font-semibold text-white"
        style={{ background: 'var(--brand-navy-900)' }}>
        Start <ArrowRight size={16} />
      </button>
    </div>
  );
}