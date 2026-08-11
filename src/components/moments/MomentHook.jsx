import { Clock, ArrowRight } from 'lucide-react';

/** Stage 1. The situation, and nothing else. Ten to twenty seconds. */
export default function MomentHook({ moment, onStart }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[20px] p-6" style={{ background: 'var(--surface-dark-700)', color: 'white' }}>
        <p className="tp-eyebrow opacity-60">Career Moment · {moment.career_name}</p>
        <p className="tp-lead mt-3">{moment.hook}</p>
      </div>

      <p className="tp-meta flex items-center gap-1.5" style={{ color: 'var(--ink-500)' }}>
        <Clock size={12} /> About {moment.estimated_minutes} minutes
      </p>

      <button onClick={onStart}
        className="tp-body ui-press flex w-full items-center justify-center gap-2 rounded-[12px] py-3.5 font-semibold text-white"
        style={{ background: 'var(--brand-navy-900)' }}>
        Start <ArrowRight size={16} />
      </button>
    </div>
  );
}