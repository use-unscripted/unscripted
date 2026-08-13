/**
 * The nine conclusion questions. Answers are held in local state and mirrored to
 * a per-experiment local draft, so a failed save (or a closed tab) never costs
 * the student their words.
 */
import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { loadDraft, saveDraft } from '@/lib/experiment-conclusion';
import { trackPilotEvent } from '@/lib/pilot-metrics';
import ReferencedExperiments from '@/components/reflection/ReferencedExperiments';

const EMPTY = {
  lessons: '', surprises: '', enjoyed: '', disliked: '', assumptions: '',
  evidence: '', interest: '', interestNote: '', next: '', clarity: null,
  references: [],
};

const QUESTIONS = [
  { key: 'lessons', label: 'What did you learn about the work?', required: true, rows: 4, hint: 'The work itself, not how the experiment went.', placeholder: 'Be specific about what the day-to-day actually involves.' },
  { key: 'surprises', label: 'What surprised you?', rows: 3, placeholder: 'Anything that did not match what you expected going in.' },
  { key: 'enjoyed', label: 'Which activities did you enjoy?', rows: 3, placeholder: 'The parts you would happily do again.' },
  { key: 'disliked', label: 'Which activities did you dislike?', rows: 3, placeholder: 'The parts you avoided or dreaded.' },
  { key: 'assumptions', label: 'Which assumptions changed?', rows: 3, placeholder: 'What you believed before, and what you believe now.' },
  { key: 'evidence', label: 'What evidence supports your conclusion?', rows: 3, placeholder: 'Point to the proof, conversations or results behind your answer.' },
];

const INTEREST = [
  { value: 'more', label: 'More interested', desc: 'This made the path look stronger.' },
  { value: 'same', label: 'About the same', desc: 'Nothing moved much either way.' },
  { value: 'less', label: 'Less interested', desc: 'Worth saying out loud early.' },
];

const field = 'w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base md:text-sm outline-none';
const fieldStyle = { borderColor: 'var(--border-light)', background: 'var(--background-secondary)' };

export default function ReflectionForm({ ctx, onSaved, onSubmit }) {
  const experimentId = ctx.experiment.id;
  const [answers, setAnswers] = useState(() => {
    const e = ctx.existing;
    if (e) {
      return {
        lessons: e.lessons || '', surprises: e.surprises || '', enjoyed: e.energy_sources || '',
        disliked: e.energy_drains || '', assumptions: e.assumptions_changed || '',
        evidence: e.supporting_evidence || '', interest: e.interest_direction || '',
        interestNote: '', next: e.next_changes || '',
        clarity: typeof e.clarity_score === 'number' ? e.clarity_score : null,
        references: e.referenced_experiment_ids || [],
      };
    }
    return { ...EMPTY, ...(loadDraft(experimentId) || {}) };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => { setAnswers(a => ({ ...a, [key]: value })); setError(''); };

  /* Completed experiments only, and never the one being concluded here. */
  const referenceable = (ctx.completedExperiments || []).filter(e => e.id !== experimentId);
  const toggleReference = (id) => set(
    'references',
    answers.references.includes(id) ? answers.references.filter(r => r !== id) : [...answers.references, id],
  );

  // Opening the conclusion form is the start of the reflection stage.
  useEffect(() => {
    trackPilotEvent('reflection_started', {
      experiment_id: experimentId, cycle_id: ctx.experiment.cycle_id, dedupe_key: experimentId,
    });
  }, [experimentId, ctx.experiment.cycle_id]);

  // Draft only for a first-time conclusion; an edit already has a stored row.
  useEffect(() => {
    if (ctx.existing) return;
    const t = setTimeout(() => saveDraft(experimentId, answers), 500);
    return () => clearTimeout(t);
  }, [answers, experimentId, ctx.existing]);

  const blocked = !answers.lessons.trim()
    ? 'Answer the first question: what you learned about the work.'
    : !answers.interest
      ? 'Say whether you are more or less interested in this path.'
      : answers.clarity == null
        ? 'Set your current career-clarity score.'
        : null;

  const submit = async () => {
    if (blocked) { setError(blocked); return; }
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const saved = await onSubmit(answers);
      // Numbers and ids only. None of the nine answers leaves the student's own
      // records.
      await trackPilotEvent('reflection_completed', {
        experiment_id: experimentId,
        cycle_id: ctx.experiment.cycle_id,
        value: typeof answers.clarity === 'number' ? answers.clarity : undefined,
        dedupe_key: experimentId,
      });
      onSaved(saved);
    } catch (err) {
      console.error('[reflection] save failed:', err?.message || err);
      // State is untouched, so every answer is still on screen.
      setError("We couldn't save this. Your answers are still here. Try again.");
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
        {ctx.existing ? 'Your reflection' : 'What did this experiment tell you?'}
      </h2>
      <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
        {ctx.existing
          ? 'Editing updates the reflection you already saved. It never adds a second one.'
          : 'Nine questions. The first, your interest and your clarity score are required; the rest help you decide.'}
      </p>

      <div className="mt-5 space-y-5">
        {QUESTIONS.map((q, i) => (
          <label key={q.key} className="block">
            <span className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>
              {i + 1}. {q.label}{!q.required && <span className="font-normal" style={{ color: 'var(--text-muted)' }}> · optional</span>}
            </span>
            {q.hint && <span className="tp-meta mt-1 block" style={{ color: 'var(--text-muted)' }}>{q.hint}</span>}
            <textarea
              rows={q.rows}
              value={answers[q.key]}
              onChange={e => set(q.key, e.target.value)}
              placeholder={q.placeholder}
              className={`${field} mt-1.5 resize-none`}
              style={fieldStyle}
            />
          </label>
        ))}

        <div>
          <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>7. Are you more or less interested in this path?</p>
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

        <label className="block">
          <span className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>8. What should you do next?</span>
          <textarea
            rows={3}
            value={answers.next}
            onChange={e => set('next', e.target.value)}
            placeholder="The single next action this experiment points to."
            className={`${field} mt-1.5 resize-none`}
            style={fieldStyle}
          />
        </label>

        <div>
          <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>
            9. What is your current career-clarity score?
          </p>
          <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
            1 = no idea, 10 = completely clear.
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
          : <><Save size={15} /> {ctx.existing ? 'Save and continue to my decision' : 'Save reflection and decide'}</>}
      </button>
      {blocked && !error && (
        <p className="tp-meta mt-2 text-center font-semibold" style={{ color: 'var(--text-secondary)' }}>{blocked}</p>
      )}
    </section>
  );
}