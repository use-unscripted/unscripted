/**
 * A Quick Test is two parts of the cycle, not one: the question you are working
 * (situation, your call, what it showed) and the short reflection that follows
 * it. This header says which of the two you are in, so a Quick Test's reflection
 * is as visible a step as a Deep Dive's longer one.
 */
const PARTS = {
  question: {
    n: 1,
    label: 'The question you are working',
    hint: 'A realistic call, then what it showed about you.',
  },
  reflection: {
    n: 2,
    label: 'Your quick reflection',
    hint: 'The short version of the reflection a longer test asks for. This is what turns the answer into evidence.',
  },
};

/** @param {{part: 'question'|'reflection'}} props */
export default function MomentPartHeader({ part }) {
  const meta = PARTS[part] || PARTS.question;
  return (
    <div className="mb-4">
      <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-700)' }}>
        Quick Test · Part {meta.n} of 2
      </p>
      <p className="tp-body mt-1 font-bold" style={{ color: 'var(--text-primary)' }}>{meta.label}</p>
      <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>{meta.hint}</p>
    </div>
  );
}