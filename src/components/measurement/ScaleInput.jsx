/**
 * A 1-10 rating row. Ten taps wide on desktop, wrapping to two rows on a phone,
 * so the whole check-in stays a series of taps rather than a form.
 */
export default function ScaleInput({ label, value, onChange, low, high }) {
  return (
    <div>
      <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${label}: ${n} out of 10`}
              aria-pressed={on}
              onClick={() => onChange(n)}
              className="tp-body h-10 min-w-[2.25rem] flex-1 rounded-[var(--r-control)] border font-semibold transition-colors"
              style={on
                ? { background: 'var(--brand-navy-900)', borderColor: 'var(--brand-navy-900)', color: '#fff' }
                : { background: '#fff', borderColor: 'var(--ink-200)', color: 'var(--ink-700)' }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(low || high) && (
        <div className="tp-meta mt-1 flex justify-between" style={{ color: 'var(--text-muted)' }}>
          <span>{low}</span><span>{high}</span>
        </div>
      )}
    </div>
  );
}