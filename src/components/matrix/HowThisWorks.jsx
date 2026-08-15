import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/** What the numbers on this page mean, in the student's own terms. */
const POINTS = [
  'Scores change as you complete experiments and reflect on them.',
  'Onboarding gives an initial signal only. It never counts as evidence.',
  'Real experiences provide the strongest evidence.',
  'Conflicting experiences lower confidence rather than being averaged away.',
  'Missing evidence shows up as uncertainty, not as a low score.',
  'You control your career decisions. Nothing here is a prediction.',
];

export default function HowThisWorks({ onOpen }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button type="button"
        onClick={() => { setOpen(o => !o); if (!open) onOpen?.(); }}
        aria-expanded={open}
        className="touch-target tp-control inline-flex items-center gap-1.5 rounded-[var(--r-control)]"
        style={{ color: 'var(--brand-navy-700)' }}>
        How this works
        <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} aria-hidden="true" />
      </button>
      {open && (
        <ul className="anim-fade-in app-card-flat mt-3 space-y-2 p-4">
          {POINTS.map(p => (
            <li key={p} className="tp-body" style={{ color: 'var(--text-secondary)' }}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}