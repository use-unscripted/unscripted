export default function CycleStageBlock({ step, label, count, empty, children }) {
  return (
    <section className="tp-card-body rounded-[16px] border border-[color:var(--ink-200)] bg-white">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="tp-meta flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold text-white"
          style={{ background: 'var(--brand-navy-900)' }}>{step}</span>
        <h3 className="tp-card text-[color:var(--surface-dark-900)]">{label}</h3>
        {typeof count === 'number' && (
          <span className="tp-meta rounded-full px-2.5 py-0.5 font-bold" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-700)' }}>{count}</span>
        )}
      </div>
      {count === 0 ? <p className="tp-body text-[color:var(--ink-400)]">{empty}</p> : children}
    </section>
  );
}