import { CheckCircle2, ArrowRight } from 'lucide-react';

/** Stage 3. What the answer showed. Never framed as pass or fail. */
export default function MomentFeedback({ feedback, onNext }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[var(--r-surface)] border p-5"
        style={{ borderColor: feedback.strongest ? '#86EFAC' : 'var(--ink-200)', background: feedback.strongest ? 'var(--success-50)' : 'white' }}>
        <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
          <CheckCircle2 size={13} /> What this showed
        </p>
        <p className="tp-prose mt-2" style={{ color: 'var(--ink-700)' }}>{feedback.text}</p>
      </div>

      {feedback.dimensions.length > 0 && (
        <div>
          <p className="tp-eyebrow" style={{ color: 'var(--ink-500)' }}>This provided evidence about</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {feedback.dimensions.map((d, i) => (
              <span key={i} className="tp-meta rounded-full px-2.5 py-1 font-semibold"
                style={{ background: 'var(--ink-100)', color: 'var(--ink-700)' }}>{d}</span>
            ))}
          </div>
        </div>
      )}

      <button onClick={onNext}
        className="tp-body ui-press flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] py-3.5 font-semibold text-white"
        style={{ background: 'var(--brand-navy-900)' }}>
        Continue <ArrowRight size={16} />
      </button>
    </div>
  );
}