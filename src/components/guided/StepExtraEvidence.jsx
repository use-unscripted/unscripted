/**
 * The last step's "anything else to log?" section.
 *
 * One optional extra piece of evidence: a file, a link, or a written summary. It
 * saves into the records the experiment already uses, so the student can finish
 * and log the experiment without leaving the step.
 */
import { useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import StepEvidencePanel from '@/components/guided/StepEvidencePanel';

export default function StepExtraEvidence({
  guide, stepNumber, step, experiment, mission, path, onEvidenceSaved,
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState('');
  const [round, setRound] = useState(0);

  return (
    <div className="mt-4 rounded-[var(--r-control)] p-4" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
      <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>
        Anything else to log before you finish?
      </p>
      <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
        Add another piece of evidence from this experiment.
      </p>

      {saved && (
        <p className="tp-body mt-3 flex items-center gap-2 font-semibold" style={{ color: 'var(--success-700)' }}>
          <CheckCircle2 size={15} /> {saved}
        </p>
      )}

      {open ? (
        <StepEvidencePanel
          key={round}
          guide={guide}
          stepNumber={stepNumber}
          step={step}
          experiment={experiment}
          mission={mission}
          path={path}
          keySuffix={`extra-${round}`}
          heading="What else do you want to keep from this experiment?"
          existing={null}
          onSaved={async (proof) => {
            await onEvidenceSaved(proof);
            setSaved('Evidence saved to this experiment.');
            setRound(r => r + 1);
            setOpen(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setOpen(true); setSaved(''); }}
          className="tp-meta mt-3 inline-flex items-center gap-1.5 py-1 font-bold"
          style={{ color: 'var(--brand-navy-700)' }}
        >
          <Plus size={13} /> Add another piece of evidence
        </button>
      )}

      {!open && !saved && (
        <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
          Optional. You can finish without adding anything.
        </p>
      )}
    </div>
  );
}