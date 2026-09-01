/**
 * "Before You Start" — the expectation ratings and three optional lines,
 * recorded before the work begins.
 *
 * Not skippable on the scales: without the expectation there is nothing to
 * compare the outcome against, which is the whole point of the measurement. The
 * written answers are optional so the form never becomes the reason somebody
 * stops. Answers are kept locally as they are given, so closing this and coming
 * back later does not lose taps already made.
 */
import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import ScaleInput from '@/components/measurement/ScaleInput';
import TextAnswer from '@/components/measurement/TextAnswer';
import CheckInGapHeader from '@/components/measurement/CheckInGapHeader';
import {
  PRE_FIELDS, PRE_TEXT_FIELDS, PRE_KEY_KEYS, savePreMeasurement,
  loadDraft, saveDraft, clearDraft,
} from '@/lib/experiment-measurement';

const isKey = (f) => PRE_KEY_KEYS.includes(f.key);

export default function PreExperimentCheckIn({ exp, onClose, onSaved }) {
  const [values, setValues] = useState(() => loadDraft('pre', exp?.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { saveDraft('pre', exp?.id, values); }, [values, exp?.id]);

  const set = (key, val) => setValues(v => ({ ...v, [key]: val }));
  const complete = PRE_FIELDS.every(f => values[f.key]);
  const resumed = Object.keys(loadDraft('pre', exp?.id)).length > 0;

  const submit = async () => {
    if (!complete || saving) return;
    setSaving(true);
    setError('');
    try {
      const row = await savePreMeasurement(exp, values);
      clearDraft('pre', exp?.id);
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
          <h2 className="tp-section" style={{ color: 'var(--surface-dark-900)' }}>Before you start</h2>
          <button onClick={onClose} aria-label="Close" style={{ color: 'var(--ink-500)' }}><X size={18} /></button>
        </div>
        <p className="tp-lead mb-5" style={{ color: 'var(--text-secondary)' }}>
          Take a few seconds to tell us what you are expecting from {exp.title}. We will compare it to what actually happens.
        </p>
        <CheckInGapHeader exp={exp} />
        {resumed && (
          <p className="tp-meta mb-4" style={{ color: 'var(--text-muted)' }}>Your earlier answers were kept.</p>
        )}

        {/* The four that carry the comparison afterwards, first and on their own
            surface. The rest are still asked, below. */}
        <div className="app-card-flat space-y-5 p-4 sm:p-5">
          {PRE_FIELDS.filter(isKey).map(f => (
            <ScaleInput
              key={f.key}
              label={f.label}
              low={f.low}
              high={f.high}
              value={values[f.key]}
              onChange={(n) => set(f.key, n)}
            />
          ))}
          {PRE_TEXT_FIELDS.filter(isKey).map(f => (
            <TextAnswer key={f.key} label={f.label} value={values[f.key]} onChange={(t) => set(f.key, t)} />
          ))}
        </div>

        <p className="tp-meta mb-3 mt-6" style={{ color: 'var(--text-muted)' }}>A few more, to fill out the picture.</p>
        <div className="space-y-5">
          {PRE_FIELDS.filter(f => !isKey(f)).map(f => (
            <ScaleInput
              key={f.key}
              label={f.label}
              low={f.low}
              high={f.high}
              value={values[f.key]}
              onChange={(n) => set(f.key, n)}
            />
          ))}

          {PRE_TEXT_FIELDS.filter(f => !isKey(f)).map(f => (
            <TextAnswer key={f.key} label={f.label} value={values[f.key]} onChange={(t) => set(f.key, t)} />
          ))}
        </div>

        {error && <p className="tp-body mt-4" style={{ color: 'var(--danger-700)' }}>{error}</p>}

        <button onClick={submit} disabled={!complete || saving}
          className="tp-body mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] py-3.5 font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? 'Saving…' : 'Start the experiment'}
        </button>
        {!complete && (
          <p className="tp-meta mt-2 text-center" style={{ color: 'var(--text-muted)' }}>Answer every rating to begin. The written questions are optional.</p>
        )}
      </div>
    </div>
  );
}