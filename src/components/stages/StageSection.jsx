import { ChevronDown } from 'lucide-react';

/**
 * A secondary block on a stage screen, folded away behind one titled row.
 *
 * The Test screen carried five full panels stacked one after another, so the one
 * instruction at the top scrolled off immediately and everything under it read
 * as an undifferentiated wall of text. Only the first two blocks are the work;
 * the rest are options. They keep their place in the order but arrive as a
 * single row each, which the student opens when they want it.
 *
 * The row is the control, not a card: whatever is inside already draws its own
 * panel, and a card inside a card reads as a mistake.
 *
 * <details> rather than React state, so it is keyboard operable and findable by
 * the browser's own in-page search.
 */
export default function StageSection({ title, hint, meta, defaultOpen = false, children }) {
  return (
    <details className="group" open={defaultOpen}>
      <summary
        className="app-card-flat ui-lift ui-press flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5"
        style={{ minHeight: '44px' }}
      >
        <span className="min-w-0">
          <span className="tp-card block" style={{ color: 'var(--text-primary)' }}>{title}</span>
          {hint && (
            <span className="tp-meta mt-1 block" style={{ color: 'var(--text-secondary)' }}>{hint}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2.5">
          {meta && <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>{meta}</span>}
          <ChevronDown
            size={18}
            className="transition-transform group-open:rotate-180"
            style={{ color: 'var(--ink-400)' }}
          />
        </span>
      </summary>
      <div className="app-stack mt-3">{children}</div>
    </details>
  );
}