/**
 * "What does this tell us about the hypothesis?"
 *
 * The one question that turns a stored artefact into evidence. Optional on
 * purpose: a student who does not know yet should be able to file the work and
 * answer it later in reflection, rather than being blocked at the door.
 *
 * The direction is the student's own reading, never ours, and it is deliberately
 * four options including "not sure yet" so that no answer here implies a verdict
 * on the career.
 */
import { HelpCircle } from 'lucide-react';

const DIRECTIONS = [
  ['supports', 'Supports it'],
  ['weakens', 'Weakens it'],
  ['mixed', 'Both'],
  ['unclear', 'Not sure yet'],
];

export default function InterpretationField({ testQuestion, value, direction, onChange, onDirectionChange, inputCls }) {
  return (
    <div>
      <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>
        What does this tell us about the hypothesis?
      </p>
      {testQuestion && (
        <p className="tp-meta mt-1.5 flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
          <HelpCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          You were testing: {testQuestion}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {DIRECTIONS.map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => onDirectionChange(direction === val ? '' : val)}
            aria-pressed={direction === val}
            className="touch-target tp-meta rounded-full px-3.5 py-2 font-bold"
            style={direction === val
              ? { background: 'var(--brand-navy-900)', color: '#fff' }
              : { background: 'var(--background-tertiary)', color: 'var(--text-secondary)' }}
          >
            {label}
          </button>
        ))}
      </div>

      <textarea
        rows={3}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Evidence suggests… what did doing this actually tell you?"
        className={`${inputCls} mt-3`}
      />
      <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
        Optional. You can leave it and answer it in your reflection instead.
      </p>
    </div>
  );
}