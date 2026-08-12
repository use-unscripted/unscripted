/**
 * Optional explanation, folded away. The main action must make sense without
 * ever opening one of these — nothing essential goes in here, and nothing goes
 * in a tooltip.
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function StepDisclosure({ label, children }) {
  const [open, setOpen] = useState(false);
  if (!children) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-[var(--r-control)]" style={{ border: '1px solid var(--border-light)' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="tp-body flex w-full items-center justify-between gap-3 px-4 text-left font-semibold"
        style={{ color: 'var(--brand-navy-700)', minHeight: '48px' }}
      >
        {label}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="tp-prose border-t px-4 py-3" style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}>
          {children}
        </div>
      )}
    </div>
  );
}