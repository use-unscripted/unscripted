import { useState } from 'react';
import { ChevronDown, Map } from 'lucide-react';
import CycleRail from '@/components/nav/CycleRail';

/**
 * How the cycle rail sits on the page: a fixed column on a wide screen, and a
 * collapsible strip above the content on a narrow one, so a phone keeps the one
 * dominant action in the first viewport.
 */
export function CycleRailColumn() {
  return (
    <aside
      aria-label="Your cycle"
      className="fixed inset-y-0 right-0 z-20 hidden w-64 overflow-y-auto border-l px-5 py-8 xl:block"
      style={{ background: 'var(--background-primary)', borderColor: 'var(--border-light)' }}
    >
      <CycleRail />
    </aside>
  );
}

export function CycleRailStrip() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b px-5 py-2 xl:hidden" style={{ background: 'var(--background-primary)', borderColor: 'var(--border-light)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="touch-target tp-meta flex w-full items-center justify-between font-bold"
        style={{ color: 'var(--brand-navy-700)' }}
      >
        <span className="flex items-center gap-2"><Map size={14} /> Where I am in this cycle</span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
      </button>
      {open && <div className="pb-3 pt-1"><CycleRail /></div>}
    </div>
  );
}