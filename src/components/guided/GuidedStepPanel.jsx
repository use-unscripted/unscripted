/**
 * One step, and only one step. It answers four questions and nothing else: what
 * am I doing, why, how, and what do I finish before moving on. Longer
 * explanations fold away underneath.
 */
import { Clock, CheckCircle2 } from 'lucide-react';
import LanguageLevelControl from '@/components/language/LanguageLevelControl';
import StepGlossary from '@/components/language/StepGlossary';
import useStepLanguage from '@/hooks/useStepLanguage';
import StepArtifact from '@/components/experiments/StepArtifact';
import MissionOutreachPanel from '@/components/experiment/MissionOutreachPanel';
import StepDisclosure from '@/components/guided/StepDisclosure';
import StepUncertaintyNote from '@/components/guided/StepUncertaintyNote';
import StepEvidencePanel from '@/components/guided/StepEvidencePanel';
import StepExtraEvidence from '@/components/guided/StepExtraEvidence';
import { isOutreachStep, needsEvidence } from '@/lib/guide-progress';

/** First sentence is the purpose; the rest is detail the student can open. */
function split(text) {
  const clean = String(text || '').trim();
  if (!clean) return { purpose: '', rest: '' };
  const end = clean.search(/[.!?](\s|$)/);
  if (end === -1) return { purpose: clean, rest: '' };
  return { purpose: clean.slice(0, end + 1), rest: clean.slice(end + 1).trim() };
}

export default function GuidedStepPanel({
  step, stepNumber, isDone, guide, experiment, mission, path, profile,
  contacts, evidence, note, onNote, onEvidenceSaved, onContactsChanged, isLastStep,
  level = 'balanced', onLevelChange, careerName,
}) {
  /* Wording only. The step number, `done_when`, the proof requirement, the
     outreach requirement and the artifact below are read straight off the guide
     at every level, so switching level cannot change what has to be done. */
  const worded = useStepLanguage({
    step,
    level,
    careerName,
    objective: guide.objective || experiment?.expected_learning,
    context: { path_id: path?.id || experiment?.path_id, experiment_id: experiment?.id },
  });
  const { purpose, rest } = split(worded.description);
  const minutes = step.estimated_minutes ? `${step.estimated_minutes} min` : step.estimated_time;

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tp-meta rounded-full px-2.5 py-1 font-bold" style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}>
          Step {stepNumber}
        </span>
        {minutes && (
          <span className="tp-meta inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <Clock size={12} /> {minutes}
          </span>
        )}
        {isDone && (
          <span className="tp-meta inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}>
            <CheckCircle2 size={12} /> Complete
          </span>
        )}
      </div>

      {onLevelChange && (
        <LanguageLevelControl level={level} onChange={onLevelChange} hint={false} className="mt-3" />
      )}

      <h2 className="tp-hero mt-3" style={{ color: 'var(--text-primary)' }}>{worded.title || `Step ${stepNumber}`}</h2>
      {purpose && <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>{purpose}</p>}
      {worded.loading && (
        <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }} role="status">Rewording this step…</p>
      )}

      {/* Each step says which uncertainty it is here to answer, and that we are
          measuring the reaction rather than the performance. */}
      <StepUncertaintyNote experiment={experiment} />

      {/* The thing to actually use: the written email, the questions, the search strings. */}
      <StepArtifact artifact={step.artifact} profile={profile} />

      {step.done_when && (
        <div className="mt-4 rounded-[var(--r-control)] p-3.5" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}>
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-900)' }}>Done when</p>
          <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>{step.done_when}</p>
        </div>
      )}

      <StepDisclosure label="Why am I doing this?">
        {guide.objective || experiment?.expected_learning || experiment?.objective || null}
      </StepDisclosure>
      {rest && <StepDisclosure label="Need more detail?">{rest}</StepDisclosure>}

      <StepGlossary
        terms={worded.terms}
        careerName={careerName}
        step={step}
        context={{ path, experiment, guideId: guide.id, stepNumber, field: careerName }}
      />

      {/* Outreach, inside the step that needs it, using the existing outreach
          records. Rendered whether or not the guide has a mission behind it:
          without this the step could ask for a contact and give nowhere to add
          one, which left the "add the person you contacted" note unclearable. */}
      {isOutreachStep(step) && (
        <MissionOutreachPanel
          mission={mission}
          experiment={experiment}
          path={path}
          contacts={contacts}
          onChanged={onContactsChanged}
        />
      )}

      {needsEvidence(step) && (
        <StepEvidencePanel
          guide={guide}
          stepNumber={stepNumber}
          step={step}
          experiment={experiment}
          mission={mission}
          path={path}
          existing={evidence}
          onSaved={onEvidenceSaved}
        />
      )}

      {/* Last step only: one more contact, file, link or summary before the
          experiment is logged. */}
      {isLastStep && (
        <StepExtraEvidence
          guide={guide}
          stepNumber={stepNumber}
          step={step}
          experiment={experiment}
          mission={mission}
          path={path}
          onContactsChanged={onContactsChanged}
          onEvidenceSaved={onEvidenceSaved}
        />
      )}

      <label className="mt-4 block">
        <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>Your notes on this step (saved automatically)</span>
        <textarea
          rows={3}
          value={note}
          onChange={e => onNote(e.target.value)}
          placeholder="What happened, what you noticed, anything to come back to…"
          className="mt-1 w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base outline-none md:text-sm"
          style={{ borderColor: 'var(--border-light)', background: 'var(--background-secondary)' }}
        />
      </label>
    </section>
  );
}