/**
 * One experience sample. Two of these in a run and no more.
 *
 * It fires at a seam, never on a timer and never while somebody is typing. Both
 * seams are a moment where the student has just pressed a button and is between
 * things, which is the difference between a reading and an interruption. A timed
 * ping landing in the middle of a sentence is exactly the thing that costs a
 * completion.
 *
 * Skip writes a skip. It is a different fact from a crash or a closed tab, and
 * telling them apart later is the point of the control.
 */
import { REACTIONS } from '@/lib/career-moment';

export default function SimSample({ onAnswer, onSkip }) {
  return (
    <div className="space-y-6 py-4">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Right now, this is...</h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {REACTIONS.map(r => (
          <button
            key={r.value}
            type="button"
            onClick={() => onAnswer(r.score)}
            className="ui-press rounded-[var(--r-control)] border px-3 py-5 text-center transition-colors"
            style={{ minHeight: '48px', borderColor: 'var(--border-light)', background: 'var(--background-primary)' }}
          >
            <span className="block text-2xl" aria-hidden="true">{r.emoji}</span>
            <span className="tp-meta mt-1.5 block font-semibold" style={{ color: 'var(--text-primary)' }}>{r.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="tp-control block w-full font-semibold underline"
        style={{ minHeight: '48px', color: 'var(--text-muted)' }}
      >
        Skip this
      </button>
    </div>
  );
}
