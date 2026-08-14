/**
 * The outcome measurement, collected once the required evidence is in and before
 * the hypothesis is updated. Self-rated performance is asked here; the system's
 * own score is stored separately and never mixed into this answer.
 *
 * Answers are held locally as they are given, so closing this sheet and
 * returning does not lose the taps already made.
 */
import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import ScaleInput from '@/components/measurement/ScaleInput';
import TextAnswer from '@/components/measurement/TextAnswer';
import {
  POST_FIELDS, POST_TEXT_FIELDS, savePostMeasurement,
  loadDraft, saveDraft, clearDraft,
} from '@/lib/experiment-measurement';

export default function PostExperimentCheckIn({ exp, measurement, behavioral, onClose, onSaved }) {
  const [values, setValues] = useState(() => loadDraft('post', exp?.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { saveDraft('post', exp?.id, values); }, [values, exp?.id]);

  const set = (key, val) => setValues(v => ({ ...v, [key]: val }));
  const complete = POST_FIELDS.every(f => values[f.key]);
  const resumed = Object.keys(loadDraft('post', exp?.id)).length > 0;

  const submit = async () => {
    if (!complete || saving) return;
    setSaving(true);
    setError('');
    try {
      // The behavioural counts are recorded alongside, never merged into the
      // ratings above.
      const row = await savePostMeasurement(exp, measurement, { ...values, behavioral_snapshot: behavioral || undefined });
      clearDraft('post', exp?.id);
      onSaved(row);
    } catch {
      setError('We could not save that just now. Try again.');
      setSaving(false);
    }
  };

  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      <div className="anim-modal w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-t-[var(--r-surface)] bg-white p-6 sm:rounded-[var(--r-surface)] sm:p-8">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="tp-section" style={{ color: 'var(--surface-dark-900)' }}>How did that actually go?</h2>
          <button onClick={onClose} aria-label="Close" style={{ color: 'var(--ink-500)' }}><X size={18} /></button>
        </div>
        <p className="tp-lead mb-5" style={{ color: 'var(--text-secondary)' }}>
          Quick taps on the work itself, not on the career. Then a few optional lines.
        </p>
        {resumed && (
          <p className="tp-meta mb-4" style={{ color: 'var(--text-muted)' }}>Your earlier answers were kept.</p>
        )}

        <div className="space-y-5">
          {POST_FIELDS.map(f => (
            <ScaleInput
              key={f.key}
              label={f.label}
              low={f.low}
              high={f.high}
              value={values[f.key]}
              onChange={(n) => set(f.key, n)}
            />
          ))}

          {POST_TEXT_FIELDS.map(f => (
            <TextAnswer key={f.key} label={f.label} value={values[f.key]} onChange={(t) => set(f.key, t)} />
          ))}
        </div>

        {error && <p className="tp-body mt-4" style={{ color: 'var(--danger-700)' }}>{error}</p>}

        <button onClick={submit} disabled={!complete || saving}
          className="tp-body mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] py-3.5 font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? 'Saving…' : 'See what you learned'}
        </button>
        {!complete && (
          <p className="tp-meta mt-2 text-center" style={{ color: 'var(--text-muted)' }}>Answer the ratings to continue. The written questions are optional.</p>
        )}
      </div>
    </div>
  );
}