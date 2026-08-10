/**
 * The outcome measurement, collected the moment an experiment is marked
 * complete. Self-rated performance is asked here; the system's own score is
 * stored separately and never mixed into this answer.
 */
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import ScaleInput from '@/components/measurement/ScaleInput';
import { POST_FIELDS, savePostMeasurement } from '@/lib/experiment-measurement';

export default function PostExperimentCheckIn({ exp, measurement, onClose, onSaved }) {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const complete = POST_FIELDS.every(f => values[f.key]);

  const submit = async () => {
    if (!complete || saving) return;
    setSaving(true);
    setError('');
    try {
      const row = await savePostMeasurement(exp, measurement, values);
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
          <h2 className="tp-section" style={{ color: 'var(--surface-dark-900)' }}>How did that actually go?</h2>
          <button onClick={onClose} aria-label="Close" style={{ color: 'var(--ink-500)' }}><X size={18} /></button>
        </div>
        <p className="tp-lead mb-5" style={{ color: 'var(--text-secondary)' }}>
          Seven quick taps on the work itself, not on the career.
        </p>

        <div className="space-y-5">
          {POST_FIELDS.map(f => (
            <ScaleInput
              key={f.key}
              label={f.label}
              low={f.low}
              high={f.high}
              value={values[f.key]}
              onChange={(n) => setValues(v => ({ ...v, [f.key]: n }))}
            />
          ))}

          <label className="block">
            <span className="tp-body block font-semibold" style={{ color: 'var(--text-primary)' }}>
              What surprised you most about doing this work?
            </span>
            <span className="tp-meta mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Optional.</span>
            <textarea
              rows={3}
              value={values.surprise_reflection || ''}
              onChange={(e) => setValues(v => ({ ...v, surprise_reflection: e.target.value }))}
              placeholder="A sentence is plenty."
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-2.5 text-base outline-none focus:border-[color:var(--brand-navy-900)] md:text-sm"
            />
          </label>
        </div>

        {error && <p className="tp-body mt-4" style={{ color: 'var(--danger-700)' }}>{error}</p>}

        <button onClick={submit} disabled={!complete || saving}
          className="tp-body mt-6 flex w-full items-center justify-center gap-2 rounded-[10px] py-3.5 font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? 'Saving…' : 'See what you learned'}
        </button>
      </div>
    </div>
  );
}