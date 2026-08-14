import { useState } from 'react';

/**
 * The student's way out of the recommendation.
 *
 * Every option here is legitimate. Nothing is framed as skipping or avoiding,
 * and choosing one of them is recorded so the next recommendation is better
 * rather than so the student can be nudged back.
 */
const OPTIONS = [
  { action: 'another_test', label: 'Show me another test' },
  { action: 'different_uncertainty', label: 'Test a different uncertainty' },
  { action: 'save_for_later', label: 'Save for later' },
  { action: 'not_relevant', label: 'This does not feel relevant' },
];

export default function OverrideActions({ onOverride, busy }) {
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');

  return (
    <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--ink-200)' }}>
      <p className="tp-meta" style={{ color: 'var(--ink-400)' }}>
        This is a suggestion, not an instruction.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {OPTIONS.map(o => (
          <button
            key={o.action}
            type="button"
            disabled={busy}
            onClick={() => (o.action === 'not_relevant' ? setNoting(true) : onOverride(o.action))}
            className="touch-target tp-meta rounded-full px-3 py-2 font-semibold disabled:opacity-50"
            style={{ background: 'var(--ink-100)', color: 'var(--ink-700)' }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {noting && (
        <div className="mt-3 rounded-[var(--r-control)] border p-3" style={{ borderColor: 'var(--ink-200)' }}>
          <label className="tp-meta block font-semibold" style={{ color: 'var(--ink-700)' }}>
            What makes it feel off? Optional, and it only helps us recommend better.
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            className="tp-body mt-2 w-full rounded-[var(--r-control)] border p-2.5"
            style={{ borderColor: 'var(--ink-200)' }}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onOverride('not_relevant', note.trim() || undefined)}
              className="app-cta tp-control"
            >
              Send and show me something else
            </button>
            <button type="button" onClick={() => setNoting(false)} className="app-cta-secondary tp-control">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}