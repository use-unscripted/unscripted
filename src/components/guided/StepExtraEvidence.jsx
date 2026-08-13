/**
 * The last step's "anything else to log?" section.
 *
 * One dropdown, the app's own: pick a person you spoke with, or a file, link or
 * written summary. Both save into the records the experiment already uses, so
 * the student can finish and log the experiment without leaving the step.
 */
import { useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import FieldSelect from '@/components/ui/FieldSelect';
import StepContactForm from '@/components/guided/StepContactForm';
import StepEvidencePanel from '@/components/guided/StepEvidencePanel';

const KINDS = [
  { value: 'contact', label: 'A person I spoke with' },
  { value: 'proof', label: 'A file, link or written summary' },
];

export default function StepExtraEvidence({
  guide, stepNumber, step, experiment, mission, path, onContactsChanged, onEvidenceSaved,
}) {
  const [kind, setKind] = useState('');
  const [saved, setSaved] = useState('');
  const [round, setRound] = useState(0);

  return (
    <div className="mt-4 rounded-[var(--r-control)] p-4" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
      <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>
        Anything else to log before you finish?
      </p>
      <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
        Add the person you spoke with, or another piece of evidence from this experiment.
      </p>

      {saved && (
        <p className="tp-body mt-3 flex items-center gap-2 font-semibold" style={{ color: 'var(--success-700)' }}>
          <CheckCircle2 size={15} /> {saved}
        </p>
      )}

      <label className="mt-3 block">
        <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>What are you adding?</span>
        <FieldSelect
          className="mt-1"
          ariaLabel="What are you adding"
          value={kind}
          onChange={(v) => { setKind(v); setSaved(''); }}
          placeholder="Choose one"
          options={KINDS}
        />
      </label>

      {kind === 'contact' && (
        <StepContactForm
          mission={mission}
          experiment={experiment}
          path={path}
          onSaved={async () => {
            await onContactsChanged();
            setSaved('Contact saved to this experiment.');
            setKind('');
          }}
          onCancel={() => setKind('')}
        />
      )}

      {kind === 'proof' && (
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
            setKind('');
          }}
        />
      )}

      {!kind && !saved && (
        <p className="tp-meta mt-3 inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <Plus size={13} /> Optional. You can finish without adding anything.
        </p>
      )}
    </div>
  );
}