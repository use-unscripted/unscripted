export default function CycleStageBlock({ step, label, count, empty, children }) {
  return (
    <section className="rounded-[16px] border border-[color:var(--ink-200)] bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: 'var(--brand-navy-900)' }}>{step}</span>
        <h3 className="font-heading text-base font-bold text-[color:var(--surface-dark-900)]">{label}</h3>
        {typeof count === 'number' && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-700)' }}>{count}</span>
        )}
      </div>
      {count === 0 ? <p className="text-sm text-[color:var(--ink-400)]">{empty}</p> : children}
    </section>
  );
}