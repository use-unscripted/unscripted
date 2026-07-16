export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-[#2563EB]">{eyebrow}</p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-[#07111F] sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#334155]">{description}</p>}
      </div>
      {action}
    </header>
  );
}