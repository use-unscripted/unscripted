/** One numbered section of the Career Evidence Profile. */
export default function ProfileSection({ index, title, description, count, children }) {
  return (
    <section className="mb-10">
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="tp-meta flex h-6 w-6 items-center justify-center rounded-full font-bold"
            style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>{index}</span>
          <h2 className="tp-section" style={{ color: 'var(--surface-dark-900)' }}>{title}</h2>
          {typeof count === 'number' && (
            <span className="tp-meta rounded-full px-2.5 py-0.5 font-bold"
              style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}>{count}</span>
          )}
        </div>
        {description && <p className="tp-body mt-2" style={{ color: 'var(--ink-500)', maxWidth: '60ch' }}>{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** The shared empty state: never a forced conclusion. */
export function StillLearning({ children }) {
  return (
    <div className="tp-body rounded-[var(--r-surface)] border border-dashed p-5"
      style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-500)' }}>
      {children}
    </div>
  );
}