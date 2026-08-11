import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Singles out one record. The list stays behind, dimmed and inert; clicking the
 * backdrop (or pressing Escape) returns to the aggregate list.
 *
 * z-40 on purpose: the modals a focused card can open (add proof, add mission,
 * check-ins) are z-50 and must sit above this, not behind it.
 */
export default function FocusOverlay({ onClose, label = 'Close', children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="anim-overlay fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      style={{ background: 'rgba(5,8,22,0.55)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="anim-modal w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="tp-meta font-semibold text-white/70">Click outside to go back</p>
          <button
            onClick={onClose}
            aria-label={label}
            className="touch-target-square flex items-center justify-center rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}