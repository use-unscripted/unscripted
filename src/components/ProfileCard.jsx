export default function ProfileCard({ label, children, dark = false }) {
  if (dark) {
    return (
      <section
        className="rounded-[20px] p-6 text-white"
        style={{
          background: 'linear-gradient(145deg, #0F1E36 0%, #061226 100%)',
          border: '1px solid rgba(34,211,238,0.18)',
          boxShadow: '0 20px 50px rgba(37,99,235,0.15)',
        }}
      >
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#22D3EE]">{label}</p>
        <div className="mt-4">{children}</div>
      </section>
    );
  }
  return (
    <section className="rounded-[20px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2563EB]">{label}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}