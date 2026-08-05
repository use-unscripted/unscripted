import ScrollReveal from '@/components/ScrollReveal';

export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <ScrollReveal as="header" className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {/* Optional now, and used by only two pages. It used to render
            unconditionally, so every page opened with a small-caps label
            naming the page you were already on — which the sidebar highlight
            and the browser tab both say. Keep it only where it names the KIND
            of thing when the title is an instance name ("Personal roadmap"
            over a roadmap's own title); drop it where it just restates the
            page. Rendering an empty bold <p> when the prop was absent was
            also leaving a stray gap. */}
        {eyebrow && (
          <p className="tp-eyebrow mb-2.5" style={{ color: 'var(--brand-navy-700)' }}>{eyebrow}</p>
        )}
        <h1 className="tp-page" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        {description && <p className="tp-lead mt-3 max-w-[48ch]" style={{ color: 'var(--text-secondary)' }}>{description}</p>}
      </div>
      {/* Guarded, unlike the harness version: an unconditional wrapper is still
          a flex item when there is no action, and gap-5 would then add 20px of
          empty space under the header on every page that passes no action. */}
      {action && <div className="shrink-0">{action}</div>}
    </ScrollReveal>
  );
}