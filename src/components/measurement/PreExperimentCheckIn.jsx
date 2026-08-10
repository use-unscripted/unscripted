/**
 * "Before You Start" — five taps, recorded before the work begins.
 *
 * Not skippable: without the expectation there is nothing to compare the
 * outcome against, which is the whole point of the measurement.
 */
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import ScaleInput from '@/components/measurement/ScaleInput';
import { PRE_FIELDS, savePreMeasurement } from '@/lib/experiment-measurement';

export default function PreExperimentCheckIn({ exp, onClose, onSaved }) {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const complete = PRE_FIELDS.every(f => values[f.key]);

  const submit = async () => {
    if (!complete || saving) return;
    setSaving(true);
    setError('');
    try {
      const row = await savePreMeasurement(exp, values);
      onSaved(row);
    } catch {
      setError('We could not save that just now. Try again.');
      setSaving(false);
    }
  };

  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      <div className="anim-modal w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-t-[24px] bg-white p-6 sm:rounded-[24px] sm:p-8">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="tp-section" style={{ color: 'var(--surface-dark-900)' }}>Before you start</h2>
          <button onClick={onClose} aria-label="Close" style={{ color: 'var(--ink-500)' }}><X size={18} /></button>
        </div>
        <p className="tp-lead mb-5" style={{ color: 'var(--text-secondary)' }}>
          Take a few seconds to tell us what you are expecting from {exp.title}. We will compare it to what actually happens.
        </p>

        <div className="space-y-5">
          {PRE_FIELDS.map(f => (
            <ScaleInput
              key={f.key}
              label={f.label}
              low={f.low}
              high={f.high}
              value={values[f.key]}
              onChange={(n) => setValues(v => ({ ...v, [f.key]: n }))}
            />
          ))}
        </div>

        {error && <p className="tp-body mt-4" style={{ color: 'var(--danger-700)' }}>{error}</p>}

        <button onClick={submit} disabled={!complete || saving}
          className="tp-body mt-6 flex w-full items-center justify-center gap-2 rounded-[10px] py-3.5 font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? 'Saving…' : 'Start the experiment'}
        </button>
        {!complete && (
          <p className="tp-meta mt-2 text-center" style={{ color: 'var(--text-muted)' }}>Answer all five to begin.</p>
        )}
      </div>
    </div>
  );
}