/**
 * The post-experiment realism and usefulness survey. Four scales, two optional
 * notes and one question about what a professional told them.
 *
 * It rates the EXPERIMENT, not the student and not their hypothesis. Optional:
 * it never blocks the hypothesis update below it.
 */
import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { RATING_QUESTIONS, ALIGNMENT_OPTIONS, saveFeedback } from '@/lib/experiment-feedback';

const EMPTY = {
  realism_rating: null, career_understanding_rating: null, self_learning_rating: null,
  time_value_rating: null, realism_notes: '', missing_elements_notes: '',
  professional_alignment_rating: '',
};

function Scale({ q, value, onChange }) {
  return (
    <div>
      <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{q.label}</p>
      <div className="mt-2 flex gap-2">
        {[1, 2, 3, 4, 5].map(n => {
          const on = value === n;
          return (
            <button key={n} type="button" onClick={() => onChange(q.key, n)}
              className="ui-press tp-body flex-1 rounded-[var(--r-control)] font-bold"
              style={{
                minHeight: '46px',
                background: on ? 'var(--brand-navy-900)' : 'var(--background-primary)',
                color: on ? '#FFFFFF' : 'var(--text-secondary)',
                border: `1px solid ${on ? 'var(--brand-navy-900)' : 'var(--border-light)'}`,
              }}>
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between">
        <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>{q.low}</span>
        <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>{q.high}</span>
      </div>
    </div>
  );
}

export default function ExperimentFeedbackSurvey({ experiment, validation, existing, onSaved }) {
  const [answers, setAnswers] = useState({ ...EMPTY, ...(existing || {}) });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(existing?.submitted_at));
  const [error, setError] = useState('');

  const set = (key, value) => { setAnswers(a => ({ ...a, [key]: value })); setSaved(false); };
  const answeredAny = RATING_QUESTIONS.some(q => answers[q.key]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const row = await saveFeedback({ experiment, validation, answers, existing });
      setSaved(true);
      onSaved?.(row);
    } catch (err) {
      console.error('[feedback] save failed:', err?.message || err);
      setError("We couldn't save your feedback just now.");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <p className="tp-prose" style={{ color: 'var(--text-secondary)' }}>
        This rates the experiment, not you. It changes nothing about your hypothesis: it tells us which
        experiments are worth a student's time and which need rewriting. Optional, and about a minute.
      </p>

      {RATING_QUESTIONS.map(q => (
        <Scale key={q.key} q={q} value={answers[q.key]} onChange={set} />
      ))}

      <div>
        <label className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>
          What felt unrealistic or oversimplified? <span style={{ color: 'var(--text-muted)' }}>Optional</span>
        </label>
        <textarea rows={3} value={answers.realism_notes} onChange={e => set('realism_notes', e.target.value)}
          className="tp-body mt-2 w-full rounded-[var(--r-control)] p-3"
          style={{ border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          placeholder="The part that would not happen this way in the real job." />
      </div>

      <div>
        <label className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>
          What important part of the career do you think this experiment missed? <span style={{ color: 'var(--text-muted)' }}>Optional</span>
        </label>
        <textarea rows={3} value={answers.missing_elements_notes} onChange={e => set('missing_elements_notes', e.target.value)}
          className="tp-body mt-2 w-full rounded-[var(--r-control)] p-3"
          style={{ border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          placeholder="Something real about the work that never came up." />
      </div>

      <div>
        <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>
          If you spoke with a professional during or after this experiment, did their description of the real work
          support or contradict it?
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {ALIGNMENT_OPTIONS.map(o => {
            const on = answers.professional_alignment_rating === o.value;
            return (
              <button key={o.value} type="button" onClick={() => set('professional_alignment_rating', o.value)}
                className="ui-press tp-body rounded-[var(--r-control)] px-4 text-left font-semibold"
                style={{
                  minHeight: '46px',
                  background: on ? 'var(--background-tertiary)' : 'var(--background-primary)',
                  color: 'var(--text-primary)',
                  border: `1px solid ${on ? 'var(--brand-navy-700)' : 'var(--border-light)'}`,
                }}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="tp-meta" style={{ color: 'var(--danger-700)' }}>{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="button" onClick={submit} disabled={saving || !answeredAny}
          className="ui-press tp-body inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] px-5 font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
          {saved ? 'Feedback saved' : 'Send feedback'}
        </button>
        {!saved && (
          <button type="button" onClick={() => onSaved?.(null, { skipped: true })}
            className="tp-meta font-semibold sm:ml-2" style={{ color: 'var(--brand-navy-700)', minHeight: '44px' }}>
            Skip this
          </button>
        )}
      </div>
    </div>
  );
}