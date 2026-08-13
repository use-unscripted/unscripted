/**
 * The gate: the reflection opens when the experiment itself is finished, or when
 * the student deliberately ends it early and says why.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, FlaskConical } from 'lucide-react';

export default function ConclusionGate({ availability, experiment, onEndEarly }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!reason.trim()) { setError('Add a short reason so this is recorded honestly.'); return; }
    setError('');
    setBusy(true);
    try {
      await onEndEarly(reason.trim());
    } catch {
      setError("We couldn't end the experiment just now. Your reason is still here. Try again.");
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
        Reflection opens once the work is done
      </h2>
      <p className="tp-lead mt-2.5" style={{ color: 'var(--text-secondary)' }}>
        {availability.stepsTotal > 0
          ? `${availability.stepsDone} of ${availability.stepsTotal} steps done on ${experiment.title}. Finish the experiment, or end it early and tell us why.`
          : `${experiment.title} is not finished yet. Work through it, or end it early and tell us why.`}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to={`/experiment?experimentId=${experiment.id}`}
          className="ui-press inline-flex items-center gap-2 rounded-[var(--r-control)] px-5 text-sm font-bold text-white"
          style={{ background: 'var(--brand-navy-900)', minHeight: '48px', paddingTop: 12, paddingBottom: 12 }}
        >
          <FlaskConical size={15} /> Back to my experiment
        </Link>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-[var(--r-control)] border px-5 text-sm font-bold"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}
          >
            End this experiment early
          </button>
        )}
      </div>

      {open && (
        <div className="anim-slide-up mt-4 rounded-[var(--r-control)] p-4" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
          <label className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Why are you ending it early?
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            autoFocus
            placeholder="e.g. two weeks of outreach with no replies. I've learned what I needed to."
            className="mt-2 w-full rounded-[var(--r-control)] border bg-white px-3 py-2.5 text-base md:text-sm outline-none"
            style={{ borderColor: 'var(--border-light)' }}
          />
          {error && (
            <p className="tp-meta mt-2 flex items-start gap-1.5 font-semibold text-red-600" role="alert">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />{error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="ui-press rounded-[var(--r-control)] px-5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
            >
              {busy ? 'Ending…' : 'End early and reflect'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}