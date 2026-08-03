const accents = {
  blue:   { bg: 'var(--ink-100)', text: 'var(--brand-navy-900)' },
  green:  { bg: 'var(--success-50)', text: 'var(--success-700)' },
  violet: { bg: 'var(--ink-100)', text: 'var(--brand-navy-700)' },
  amber:  { bg: 'var(--warning-50)', text: 'var(--warning-700)' },
};

export default function MetricCard({ label, value, detail, accent = 'blue' }) {
  const a = accents[accent] || accents.blue;
  return (
    <div className="rounded-[20px] border border-[color:var(--ink-200)] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--ink-500)]">{label}</p>
      <p className="font-heading mt-4 text-3xl font-bold text-[color:var(--surface-dark-900)]">{value}</p>
      <span
        className="mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-bold"
        style={{ background: a.bg, color: a.text }}
      >
        {detail}
      </span>
    </div>
  );
}