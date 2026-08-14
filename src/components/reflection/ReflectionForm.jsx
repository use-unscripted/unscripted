/**
 * The reflection, in seven sections, whose purpose is to update the career
 * hypothesis rather than to keep a journal.
 *
 * Sections 1, 2, 5 are written answers; 3 shows the pre/post comparison the
 * student already produced and asks one question about it; 4 asks about the
 * decision dimensions this experiment actually tested; 6 shows the evidence
 * created. Section 7, the hypothesis synthesis, comes after this form is saved,
 * because it is built from the recalculated evidence.
 *
 * Answers are mirrored to a per-experiment local draft, so a failed save or a
 * closed tab never costs the student their words.
 */
import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { readConclusionDraft, writeConclusionDraft } from '@/lib/student-drafts';
import { trackPilotEvent } from '@/lib/pilot-metrics';
import {
  REFLECTION_SECTIONS, EMPTY_ANSWERS, answersFromReflection, blockingAnswer,
} from '@/lib/reflection-sections';
import ReflectionSection from '@/components/reflection/ReflectionSection';
import DimensionQuestions from '@/components/reflection/DimensionQuestions';
import EvidenceReview from '@/components/reflection/EvidenceReview';
import ExpectationReality from '@/components/measurement/ExpectationReality';
import ReferencedExperiments from '@/components/reflection/ReferencedExperiments';

const INTEREST = [
  { value: 'more', label: 'More interested', desc: 'This made the direction look stronger.' },
  { value: 'same', label: 'About the same', desc: 'Nothing moved much either way.' },
  { value: 'less', label: 'Less interested', desc: 'Worth saying out loud early.' },
];

const field = 'w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base md:text-sm outline-none';
const fieldStyle = { borderColor: 'var(--border-light)', background: 'var(--background-secondary)' };

export default function ReflectionForm({ ctx, measurement, dimensions = [], onSaved, onSubmit }) {
  const experimentId = ctx.experiment.id;
  const userId = ctx.user?.id || '';
  const [answers, setAnswers] = useState(() =>
    answersFromReflection(ctx.existing) || { ...EMPTY_ANSWERS, ...(readConclusionDraft(userId, experimentId) || {}) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => { setAnswers(a => ({ ...a, [key]: value })); setError(''); };
  const patch = (fields) => { setAnswers(a => ({ ...a, ...fields })); setError(''); };
  const setNote = (dimension, note) => setAnswers(a => ({ ...a, dimensionNotes: { ...a.dimensionNotes, [dimension]: note } }));

  const referenceable = (ctx.completedExperiments || []).filter(e => e.id !== experimentId);
  const toggleReference = (id) => set(
    'references',
    answers.references.includes(id) ? answers.references.filter(r => r !== id) : [...answers.references, id],
  );

  useEffect(() => {
    trackPilotEvent('reflection_started', {
      experiment_id: experimentId, cycle_id: ctx.experiment.cycle_id, dedupe_key: experimentId,
    });
  }, [experimentId, ctx.experiment.cycle_id]);

  useEffect(() => {
    if (ctx.existing || !userId) return;
    const t = setTimeout(() => writeConclusionDraft(userId, experimentId, answers), 500);
    return () => clearTimeout(t);
  }, [answers, experimentId, userId, ctx.existing]);

  const blocked = blockingAnswer(answers);

  const submit = async () => {
    if (blocked) { setError(blocked); return; }
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const saved = await onSubmit(answers, dimensions);
      await trackPilotEvent('reflection_completed', {
        experiment_id: experimentId,
        cycle_id: ctx.experiment.cycle_id,
        value: typeof answers.clarity === 'number' ? answers.clarity : undefined,
        dedupe_key: experimentId,
      });
      onSaved(saved);
    } catch (err) {
      console.error('[reflection] save failed:', err?.message || err);
      setError("We couldn't save this. Your answers are still here. Try again.");
      setSaving(false);
    }
  };

  const extraFor = (id) => {
    if (id === 'expectation_reality') {
      return measurement
        ? <div className="mt-4 rounded-[var(--r-control)] bg-white p-4" style={{ border: '1px solid var(--border-light)' }}>
          <ExpectationReality m={measurement} />
        </div>
        : <p className="tp-body mt-3" style={{ color: 'var(--text-secondary)' }}>
          No check-in numbers were recorded for this experiment, so there is nothing to compare. Answer in your own words.
        </p>;
    }
    if (id === 'about_you') {
      return <DimensionQuestions dimensions={dimensions} notes={answers.dimensionNotes} onChange={setNote} />;
    }
    if (id === 'evidence_review') {
      return <EvidenceReview ctx={ctx} answers={answers} onChange={patch} />;
    }
    return null;
  };

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
        {ctx.existing ? 'Your reflection' : 'What did this experiment tell you?'}
      </h2>
      <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
        {ctx.existing
          ? 'Editing updates the reflection you already saved. It never adds a second one.'
          : 'Six sections here, then a suggested update to your hypothesis that you can correct before anything is recorded.'}
      </p>

      <div className="mt-5 space-y-4">
        {REFLECTION_SECTIONS.map(section => (
          <ReflectionSection key={section.id} section={section} answers={answers} onChange={set}>
            {extraFor(section.id)}
          </ReflectionSection>
        ))}

        <div>
          <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>Are you more or less interested in this direction?</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {INTEREST.map(o => {
              const on = answers.interest === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set('interest', o.value)}
                  aria-pressed={on}
                  className="ui-press rounded-[var(--r-control)] p-3 text-left"
                  style={on
                    ? { background: 'var(--brand-navy-900)', color: 'var(--brand-white)', minHeight: '48px' }
                    : { background: 'var(--background-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}
                >
                  <span className="tp-card block">{o.label}</span>
                  <span className="tp-meta mt-1 block" style={{ color: on ? 'rgba(255,255,255,.75)' : 'var(--text-muted)' }}>{o.desc}</span>
                </button>
              );
            })}
          </div>
          <input
            value={answers.interestNote}
            onChange={e => set('interestNote', e.target.value)}
            placeholder="Why? (optional)"
            className={`${field} mt-2`}
            style={fieldStyle}
          />
        </div>

        <ReferencedExperiments
          experiments={referenceable}
          selected={answers.references}
          onToggle={toggleReference}
        />

        <div>
          <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>What is your current career-clarity score?</p>
          <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
            1 = no idea, 10 = completely clear. Going down after a test is normal.
            {ctx.baselineClarity != null && ` You started this cycle at ${ctx.baselineClarity}.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => set('clarity', n)}
                aria-pressed={answers.clarity === n}
                className="tp-body h-12 w-12 rounded-[var(--r-control)] font-bold"
                style={answers.clarity === n
                  ? { background: 'var(--brand-navy-900)', color: 'var(--brand-white)' }
                  : { background: 'var(--background-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p className="tp-body mt-4 flex items-start gap-1.5 font-semibold text-red-600" role="alert">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />{error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="ui-press tp-body mt-5 flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] font-bold text-white disabled:opacity-50"
        style={{ background: 'var(--brand-navy-900)', minHeight: '52px' }}
      >
        {saving
          ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
          : <><Save size={15} /> Save and update my hypothesis</>}
      </button>
      {blocked && !error && (
        <p className="tp-meta mt-2 text-center font-semibold" style={{ color: 'var(--text-secondary)' }}>{blocked}</p>
      )}
    </section>
  );
}