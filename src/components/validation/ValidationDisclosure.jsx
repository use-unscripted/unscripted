/**
 * Experiment strength, behind a button.
 *
 * Kept off the top of the workspace on purpose: a strength score of zero, or a
 * review count of none, is information about our library rather than about
 * whether the experiment is worth a student's afternoon, and leading with it
 * talked students out of work that would still teach them something. It is
 * still one tap away, unchanged, for anybody who wants to know how the
 * experiment was built.
 */
import { useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import ExperimentValidationCard from '@/components/validation/ExperimentValidationCard';

export default function ValidationDisclosure({ reading, pathName }) {
  const [open, setOpen] = useState(false);
  if (!reading) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="tp-meta inline-flex items-center gap-1.5 font-semibold"
        style={{ color: 'var(--brand-navy-700)', minHeight: '44px' }}
      >
        <ShieldCheck size={14} />
        {open ? 'Hide how this experiment was built' : 'How this experiment was built'}
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="mt-3">
          <ExperimentValidationCard reading={reading} pathName={pathName} />
        </div>
      )}
    </div>
  );
}