/**
 * The vertical Low to High gauge for Path Decision Strength.
 * A filled band position, never a number and never a percentage.
 */
const TONE = {
  muted: 'var(--ink-400)',
  info: 'var(--info-700)',
  warning: 'var(--warning-700)',
  success: 'var(--success-700)',
};

export default function PathStrengthGauge({ strength, height = 132 }) {
  if (!strength) return null;
  const fill = TONE[strength.tone] || TONE.muted;
  const segments = Array.from({ length: strength.bands }, (_, i) => i).reverse();

  return (
    <div className="flex items-stretch gap-3">
      <div className="flex flex-col justify-between" style={{ height }}>
        {segments.map(i => (
          <div
            key={i}
            className="w-3 flex-1 rounded-sm"
            style={{
              background: i <= strength.index ? fill : 'var(--ink-200)',
              marginBottom: i === 0 ? 0 : 3,
            }}
          />
        ))}
      </div>
      <div className="flex flex-col justify-between" style={{ height }}>
        <span className="tp-meta" style={{ color: 'var(--ink-400)' }}>High</span>
        <span className="tp-body font-bold" style={{ color: fill }}>{strength.label}</span>
        <span className="tp-meta" style={{ color: 'var(--ink-400)' }}>Low</span>
      </div>
    </div>
  );
}