/**
 * One short written answer inside a check-in. Optional by design: the scales
 * carry the comparison, and a required paragraph is what stops people finishing.
 */
export default function TextAnswer({ label, value, onChange, placeholder = 'A sentence is plenty.' }) {
  return (
    <label className="block">
      <span className="tp-body block font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
      <span className="tp-meta mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Optional.</span>
      <textarea
        rows={2}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-2.5 text-base outline-none focus:border-[color:var(--brand-navy-900)] md:text-sm"
      />
    </label>
  );
}