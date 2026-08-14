/**
 * The setup screen: what this is, what it is not, and the four predictions.
 *
 * The framing sits here rather than only in the read-out. A student who starts
 * believing the next 30 minutes decides whether their path is right has already
 * been misled, and no copy at the end takes that back. `entry_note` in the
 * content module is that sentence and it is printed before anything else.
 *
 * The four questions come from SIM_PRE_FIELDS and are the only questions asked
 * before the work starts. Three are the app's existing 1 to 10 row. The fourth
 * is the three way answer the Career Moment reaction already uses, scored on the
 * same 2 / 5 / 9 so the two flows write comparable numbers.
 */
import ScaleInput from '@/components/measurement/ScaleInput';
import { AGAIN_OPTIONS } from '@/lib/career-moment';
import { SIM_PRE_FIELDS } from '@/lib/experiment-measurement';
import { SimNext } from '@/components/worksim/controls';

export default function SimSetup({ sim, answers, onAnswer, onStart, busy }) {
  const answered = SIM_PRE_FIELDS.every(f => answers[f.key] != null);

  return (
    <div className="space-y-8">
      <div>
        <p className="tp-eyebrow font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-navy-700)' }}>
          Work simulation
        </p>
        <h1 className="tp-section mt-2" style={{ color: 'var(--text-primary)' }}>{sim.title}</h1>
        <p className="tp-lead mt-4" style={{ color: 'var(--text-secondary)' }}>{sim.entry_note}</p>
      </div>

      <div className="app-inset p-5" style={{ background: 'var(--background-secondary)' }}>
        <p className="tp-body" style={{ color: 'var(--text-primary)' }}>{sim.setup}</p>
        <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
          {sim.steps.length} steps, about {sim.estimated_minutes} minutes. Nothing is timed on screen.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="tp-card font-semibold" style={{ color: 'var(--text-primary)' }}>
            Four questions before you start
          </h2>
          <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>
            Answer them now so that at the end you can see which ones you called right.
          </p>
        </div>

        {SIM_PRE_FIELDS.map(f => (
          f.key === 'expected_want_more' ? (
            <div key={f.key}>
              <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{f.label}</p>
              <div className="mt-2 flex gap-2">
                {AGAIN_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={answers[f.key] === o.score}
                    onClick={() => onAnswer(f.key, o.score)}
                    className="tp-body flex-1 rounded-[var(--r-control)] border py-3 font-semibold transition-colors"
                    style={answers[f.key] === o.score
                      ? { borderColor: 'var(--brand-navy-900)', background: 'var(--background-tertiary)', color: 'var(--brand-navy-900)' }
                      : { borderColor: 'var(--border-light)', background: 'var(--background-primary)', color: 'var(--text-secondary)' }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ScaleInput
              key={f.key}
              label={f.label}
              low={f.low}
              high={f.high}
              value={answers[f.key]}
              onChange={(v) => onAnswer(f.key, v)}
            />
          )
        ))}
      </div>

      <div>
        <SimNext onClick={onStart} disabled={!answered} busy={busy}>Start</SimNext>
        {!answered && (
          <p className="tp-meta mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
            Answer all four to begin.
          </p>
        )}
      </div>
    </div>
  );
}
