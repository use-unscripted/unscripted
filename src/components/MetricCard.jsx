const accents = {
  blue: { bg: '#EFF6FF', text: '#2563EB' },
  green: { bg: '#ECFDF5', text: '#10B981' },
  violet: { bg: '#F5F3FF', text: '#7C3AED' },
  amber: { bg: '#FFFBEB', text: '#D97706' },
};

export default function MetricCard({ label, value, detail, accent = 'blue' }) {
  const a = accents[accent] || accents.blue;
  return (
    <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">{label}</p>
      <p className="font-heading mt-4 text-3xl font-bold text-[#07111F]">{value}</p>
      <span
        className="mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-bold"
        style={{ background: a.bg, color: a.text }}
      >
        {detail}
      </span>
    </div>
  );
}