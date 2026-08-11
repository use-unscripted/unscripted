import { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Pull-to-refresh for the iOS WebView. Touch only, and only from the very top
 * of the page, so it can never interfere with a pointer device or with normal
 * scrolling. Purely additive: the children render exactly as before.
 */
const THRESHOLD = 70;
const MAX = 96;

export default function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef(null);

  const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

  const onTouchStart = (e) => {
    if (busy || !atTop() || e.touches.length !== 1) { startY.current = null; return; }
    startY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    if (startY.current == null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) { setPull(0); return; }
    // Resisted, so it feels like a drag rather than a jump.
    setPull(Math.min(MAX, delta * 0.5));
  };

  const onTouchEnd = async () => {
    const pulled = pull;
    startY.current = null;
    setPull(0);
    if (pulled < THRESHOLD || busy) return;
    setBusy(true);
    try { await onRefresh?.(); } catch { /* the page keeps what it already has */ }
    setBusy(false);
  };

  const showing = busy || pull > 4;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <div
        aria-hidden={!showing}
        className="flex items-center justify-center overflow-hidden"
        style={{ height: busy ? 44 : pull, transition: startY.current == null ? 'height 200ms var(--ease-out)' : 'none' }}
      >
        {showing && (
          <span className="tp-meta inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
            {busy ? 'Refreshing' : pull >= THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}