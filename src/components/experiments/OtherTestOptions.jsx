import { ChevronDown } from 'lucide-react';

/**
 * The other ways to test the same question, kept out of the way.
 *
 * Three full option cards under the recommended test tripled the reading before
 * a decision and competed with the one question the screen is steering toward.
 * They still matter, so they stay one tap away rather than gone.
 */
export default function OtherTestOptions({ count, open, onToggle, children }) {
  return (
    <div className="rounded-[var(--r-surface)] border" style={{ borderColor: 'var(--ink-200)', background: 'white' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="tp-body flex w-full items-center justify-between gap-3 px-4 py-4 text-left font-semibold"
        style={{ color: 'var(--surface-dark-900)', minHeight: 44 }}
      >
        <span>
          {open ? 'Other ways to test this' : `See ${count > 0 ? `${count} ` : ''}other ways to test this`}
          <span className="tp-meta mt-0.5 block font-normal" style={{ color: 'var(--ink-500)' }}>
            Each takes 15 to 45 minutes.
          </span>
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 transition-transform"
          style={{ color: 'var(--ink-500)', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </div>
  );
}