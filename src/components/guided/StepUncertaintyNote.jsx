/**
 * The tie between one step and the uncertainty being tested, plus the reminder
 * that the point is the reaction rather than the performance. Renders nothing
 * when the experiment carries no question, so legacy experiments are unchanged.
 */
import { Target } from 'lucide-react';
import { stepUncertaintyLine, PERFORMANCE_REMINDER } from '@/lib/experiment-types';

export default function StepUncertaintyNote({ experiment, showReminder = true }) {
  const line = stepUncertaintyLine(experiment);
  if (!line) return null;
  return (
    <div className="mt-4 rounded-[var(--r-control)] p-3.5" style={{ background: 'var(--info-50)', border: '1px solid rgba(37,99,235,0.2)' }}>
      <p className="tp-body flex items-start gap-2" style={{ color: 'var(--ink-700)' }}>
        <Target size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--info-700)' }} />
        <span>{line}</span>
      </p>
      {showReminder && (
        <p className="tp-meta mt-1.5 pl-6" style={{ color: 'var(--ink-500)' }}>{PERFORMANCE_REMINDER}</p>
      )}
    </div>
  );
}