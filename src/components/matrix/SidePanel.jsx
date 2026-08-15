import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * The drill-down surface: a panel off the right edge on a wide screen, a sheet
 * up from the bottom on a phone. It never navigates away, so a student can open
 * a score, read why, close it, and still be looking at the same table.
 */
export default function SidePanel({ open, title, eyebrow, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-end sm:items-stretch"
      style={{ background: 'rgba(5,8,22,0.45)' }} role="dialog" aria-modal="true" aria-label={title}
      onClick={onClose}>
      <div
        className="anim-slide-up flex max-h-[88vh] w-full flex-col rounded-t-[var(--r-surface)] bg-[color:var(--background-primary)] sm:anim-modal sm:max-h-none sm:h-full sm:max-w-[440px] sm:rounded-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b p-5 sm:p-6"
          style={{ borderColor: 'var(--border-light)' }}>
          <div className="min-w-0">
            {eyebrow && <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{eyebrow}</p>}
            <h2 className="tp-section mt-1.5" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="touch-target-square ui-press grid shrink-0 place-items-center rounded-[var(--r-control)] p-2 hover:bg-[color:var(--ink-100)]">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}