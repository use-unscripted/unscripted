export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="anim-fade-up mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.14em]" style={{ color: 'var(--brand-navy-700)' }}>{eyebrow}</p>
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{description}</p>}
      </div>
      {action}
    </header>
  );
}