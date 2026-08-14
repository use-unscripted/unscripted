import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ScrollReveal from '@/components/ScrollReveal';

export default function PageHeader({ eyebrow, title, description, action, showBack, backLabel = 'Go back' }) {
  const navigate = useNavigate();
  return (
    <ScrollReveal as="header" className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      {/* One back control for every sub-page, rather than a differently worded
          text link per screen. It goes back through history, so it always
          returns where the student actually came from. */}
      <div className="flex min-w-0 items-start gap-1.5 sm:flex-1">
      {showBack && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={backLabel}
          className="ui-press -ml-2.5 flex shrink-0 items-center justify-center rounded-[var(--r-control)] text-[color:var(--ink-500)] hover:bg-[color:var(--ink-100)] hover:text-[color:var(--ink-900)] sm:mt-0.5"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <ArrowLeft size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
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
        {description && <p className="tp-lead mt-3" style={{ color: 'var(--text-secondary)', maxWidth: '48ch' }}>{description}</p>}
      </div>
      </div>
      {/* Guarded, unlike the harness version: an unconditional wrapper is still
          a flex item when there is no action, and gap-5 would then add 20px of
          empty space under the header on every page that passes no action. */}
      {action && <div className="shrink-0">{action}</div>}
    </ScrollReveal>
  );
}