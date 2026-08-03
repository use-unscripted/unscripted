/** One aggregate number on the pilot dashboard. No student-level content. */
export default function PilotStat({ label, value, sub }) {
  return (
    <div className="rounded-[14px] bg-white p-4" style={{ border: '1px solid var(--border-light)' }}>
      <p className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--brand-navy-700)' }}>{label}</p>
      <p className="font-heading mt-1 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {value == null ? 'No data' : value}
      </p>
      {sub && <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}