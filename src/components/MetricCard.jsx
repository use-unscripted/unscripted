const accents = {
  blue:   { bg: '#EEF2F6', text: '#1F3A5F' },
  green:  { bg: '#F0FDF4', text: '#15803D' },
  violet: { bg: '#EEF2F6', text: '#274C77' },
  amber:  { bg: '#FFFBEB', text: '#B45309' },
};

export default function MetricCard({ label, value, detail, accent = 'blue' }) {
  const a = accents[accent] || accents.blue;
  return (
    <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">{label}</p>
      <p className="font-heading mt-4 text-3xl font-bold text-[#050816]">{value}</p>
      <span
        className="mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-bold"
        style={{ background: a.bg, color: a.text }}
      >
        {detail}
      </span>
    </div>
  );
}