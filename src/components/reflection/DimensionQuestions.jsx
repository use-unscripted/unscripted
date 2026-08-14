/**
 * Section 4: what this experiment taught the student about themselves.
 *
 * The questions are built from the decision dimensions THIS experiment actually
 * tested, so nobody is asked what they noticed about something they never did.
 * With no tagged dimensions there is one honest fallback question instead.
 */
const field = 'w-full rounded-[var(--r-control)] border bg-white px-3 py-2.5 text-base md:text-sm outline-none resize-none';
const fieldStyle = { borderColor: 'var(--border-light)' };

const LEVEL_NOTE = {
  unknown: 'Nothing tested here before this experiment.',
  weak: 'One earlier reading on this.',
  moderate: 'Some earlier evidence on this.',
  strong: 'Consistent earlier evidence on this.',
  conflicting: 'Your earlier readings on this pointed both ways.',
};

export default function DimensionQuestions({ dimensions = [], notes = {}, onChange }) {
  if (!dimensions.length) {
    return (
      <label className="mt-4 block">
        <span className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>
          What did this tell you about the way you like to work?
        </span>
        <span className="tp-meta mt-1 block" style={{ color: 'var(--text-muted)' }}>
          This experiment was not tagged with specific decision dimensions, so this is the open version of the question.
        </span>
        <textarea
          rows={3}
          value={notes.__general || ''}
          onChange={e => onChange('__general', e.target.value)}
          placeholder="What you noticed about yourself while doing it."
          className={`${field} mt-1.5`}
          style={fieldStyle}
        />
      </label>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {dimensions.map(d => (
        <label key={d.dimension} className="block">
          <span className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>
            This experiment tested {d.dimension_label.toLowerCase()}. What did you notice about {d.noun || 'this kind of work'}?
          </span>
          <span className="tp-meta mt-1 block" style={{ color: 'var(--text-muted)' }}>
            {LEVEL_NOTE[d.current_evidence_level] || ''}
          </span>
          <textarea
            rows={3}
            value={notes[d.dimension] || ''}
            onChange={e => onChange(d.dimension, e.target.value)}
            placeholder="What actually happened when you were in it."
            className={`${field} mt-1.5`}
            style={fieldStyle}
          />
        </label>
      ))}
    </div>
  );
}