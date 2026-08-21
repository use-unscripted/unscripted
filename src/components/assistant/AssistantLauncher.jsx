import { useState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import AssistantPanel from '@/components/assistant/AssistantPanel';

/**
 * The bottom-corner guide. Sits above the mobile tab bar so it never covers a
 * destination, and above the page content on desktop.
 */
export default function AssistantLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="fixed z-40 flex flex-col items-end gap-3"
      style={{
        right: 'calc(1rem + env(safe-area-inset-right))',
        bottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
        width: open ? 'min(380px, calc(100vw - 2rem))' : 'auto',
      }}
    >
      {open && <AssistantPanel onClose={() => setOpen(false)} />}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ui-press inline-flex items-center gap-2 rounded-full px-4 text-white"
          style={{ background: 'var(--brand-navy-900)', boxShadow: 'var(--elev-raise)', minHeight: 52 }}
        >
          <MessageCircleQuestion size={20} />
          <span className="tp-control font-bold">Ask the guide</span>
        </button>
      )}
    </div>
  );
}