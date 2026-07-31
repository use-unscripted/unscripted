import ScrollReveal from '@/components/ScrollReveal';

export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <ScrollReveal as="header" className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {/* Optional now, and used by only two pages. It used to render
            unconditionally, so every page opened with a small-caps label
            naming the page you were already on — which the sidebar highlight
            and the browser tab both say. Keep it only where it names the KIND
            of thing when the title is an instance name ("Personal roadmap"
            over a roadmap's own title); drop it where it just restates the
            page. Rendering an empty bold <p> when the prop was absent was
            also leaving a stray gap. */}
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[.14em]" style={{ color: 'var(--brand-navy-700)' }}>{eyebrow}</p>
        )}
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{description}</p>}
      </div>
      {action}
    </ScrollReveal>
  );
}