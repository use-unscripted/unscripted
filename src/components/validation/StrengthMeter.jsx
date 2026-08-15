/**
 * Experiment Strength, as a bar plus a word. Never colour alone: the level is
 * always written out, and the filled segments are countable.
 */
const SEGMENTS = 10;

export default function StrengthMeter({ strength, compact = false }) {
  const filled = strength.sufficient ? Math.max(1, Math.round((strength.score / 100) * SEGMENTS)) : 0;

  return (
    <div>
      <div className="flex items-center gap-2" aria-hidden="true">
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <span
            key={i}
            className="h-2 flex-1 rounded-full"
            style={{ background: i < filled ? 'var(--brand-navy-900)' : 'var(--ink-200)' }}
          />
        ))}
      </div>
      <p className="tp-card mt-2" style={{ color: 'var(--text-primary)' }}>
        {strength.level_label}
        {strength.sufficient && !compact && (
          <span className="tp-meta ml-2 font-semibold tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {strength.score} / 100 validation score
          </span>
        )}
      </p>
      {!strength.sufficient && (
        <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
          Too little validation on file to give this a score yet.
        </p>
      )}
    </div>
  );
}