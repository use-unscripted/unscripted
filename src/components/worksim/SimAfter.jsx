/**
 * The three questions after. Two taps and one optional line.
 *
 * There is no "how much did you enjoy it" here and adding one back for symmetry
 * would break the measurement. Enjoyment was sampled twice while the work was
 * happening; asked again at the end it comes back coloured by how the ending
 * went, and holding both numbers would let a read-out quietly pick the wrong
 * one.
 *
 * Predicted performance is not asked again either. It was asked before, and the
 * before half is the half a gap needs.
 */
import ScaleInput from '@/components/measurement/ScaleInput';
import { AGAIN_OPTIONS } from '@/lib/career-moment';
import { SimTextArea, SimNext } from '@/components/worksim/controls';

export default function SimAfter({ answers, onAnswer, onFinish, busy }) {
  const ready = answers.actual_energy != null && answers.desire_to_repeat != null;

  return (
    <div className="space-y-8">
      <ScaleInput
        label="How do you feel now?"
        low="Drained"
        high="Energised"
        value={answers.actual_energy}
        onChange={(v) => onAnswer('actual_energy', v)}
      />

      <div>
        <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>Do you want to do another one?</p>
        <div className="mt-2 flex gap-2">
          {AGAIN_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              aria-pressed={answers.desire_to_repeat === o.score}
              onClick={() => onAnswer('desire_to_repeat', o.score)}
              className="tp-body flex-1 rounded-[var(--r-control)] border py-3 font-semibold transition-colors"
              style={answers.desire_to_repeat === o.score
                ? { borderColor: 'var(--brand-navy-900)', background: 'var(--background-tertiary)', color: 'var(--brand-navy-900)' }
                : { borderColor: 'var(--border-light)', background: 'var(--background-primary)', color: 'var(--text-secondary)' }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <SimTextArea
        id="sim-surprise"
        label="What surprised you?"
        hint="One line, and you can leave it blank."
        rows={2}
        value={answers.surprise_reflection || ''}
        onChange={(v) => onAnswer('surprise_reflection', v)}
      />

      <SimNext onClick={onFinish} disabled={!ready} busy={busy}>Finish</SimNext>
    </div>
  );
}
