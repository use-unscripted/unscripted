import ScaleInput from '@/components/measurement/ScaleInput';
import { REACTIONS, AGAIN_OPTIONS } from '@/lib/career-moment';

/**
 * Stage 4. One or two questions, chosen by the rotation — never the full
 * post-experiment survey. Enjoyment and "do it again" keep their tap-sized
 * controls; everything else is a single scale row.
 */
export default function MomentReaction({ fields, answers, onAnswer, onFinish, saving }) {
  const answered = fields.every(f => answers[f.key] != null);

  return (
    <div className="space-y-7">
      {fields.map(f => {
        if (f.key === 'actual_enjoyment') {
          return (
            <div key={f.key}>
              <p className="tp-card" style={{ color: 'var(--surface-dark-900)' }}>How did that feel?</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {REACTIONS.map(r => (
                  <button key={r.value} onClick={() => onAnswer(f.key, r.score)}
                    className="rounded-[14px] border px-3 py-4 text-center transition"
                    style={answers[f.key] === r.score
                      ? { borderColor: 'var(--brand-navy-900)', background: 'var(--ink-100)' }
                      : { borderColor: 'var(--ink-200)', background: 'white' }}>
                    <span className="block text-2xl" aria-hidden="true">{r.emoji}</span>
                    <span className="tp-meta mt-1 block font-semibold" style={{ color: 'var(--ink-700)' }}>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        }

        if (f.key === 'desire_to_repeat') {
          return (
            <div key={f.key}>
              <p className="tp-card" style={{ color: 'var(--surface-dark-900)' }}>{f.label}</p>
              <div className="mt-3 flex gap-2">
                {AGAIN_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => onAnswer(f.key, o.score)}
                    className="tp-body flex-1 rounded-[12px] border py-3 font-semibold transition"
                    style={answers[f.key] === o.score
                      ? { borderColor: 'var(--brand-navy-900)', background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }
                      : { borderColor: 'var(--ink-200)', background: 'white', color: 'var(--ink-700)' }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          );
        }

        return (
          <ScaleInput
            key={f.key}
            label={f.label}
            low={f.low}
            high={f.high}
            value={answers[f.key]}
            onChange={(v) => onAnswer(f.key, v)}
          />
        );
      })}

      <button onClick={onFinish} disabled={!answered || saving}
        className="tp-body ui-press w-full rounded-[12px] py-3.5 font-semibold text-white disabled:opacity-40"
        style={{ background: 'var(--brand-navy-900)' }}>
        {saving ? 'Saving your evidence…' : 'Save my evidence'}
      </button>
    </div>
  );
}