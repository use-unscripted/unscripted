export default function ProfileCard({ label, children, dark = false }) {
  if (dark) {
    return (
      <section
        className="rounded-[20px] p-6 text-white"
        style={{
          background: 'var(--surface-dark-700)',
          border: '1px solid rgba(31,58,95,0.35)',
        }}
      >
        <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: 'var(--brand-navy-700)' }}>{label}</p>
        <div className="mt-4">{children}</div>
      </section>
    );
  }
  return (
    <section className="rounded-[20px] border border-[color:var(--ink-200)] bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: 'var(--brand-navy-700)' }}>{label}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}