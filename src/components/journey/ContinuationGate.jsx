/**
 * What an independent beta student sees when they try to begin a second cycle.
 *
 * No credit balance, no price, no checkout — this phase records interest and a
 * preferred access type only. Payment processing is deliberately not implemented
 * here and must be approved separately.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { recordContinuationInterest, loadContinuationInterest } from '@/lib/pilot-access';

export const CONTINUATION_MESSAGE =
  'You completed your first Unscripted career experiment. Continue testing another direction and building evidence.';

const PREFERENCES = [
  ['monthly', 'Monthly access', 'Pay month to month once access opens.'],
  ['annual', 'Annual access', 'One payment for the year once access opens.'],
  ['institution_sponsored', 'Sponsored by my university', 'My school or program covers it.'],
];

export default function ContinuationGate() {
  const [saved, setSaved] = useState(null);
  const [wants, setWants] = useState(null);
  const [preference, setPreference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadContinuationInterest().then(setSaved).catch(() => setSaved(null)); }, []);

  const submit = async () => {
    if (busy || wants == null) return;
    if (wants && !preference) { setError('Pick which kind of access would suit you.'); return; }
    setBusy(true);
    setError('');
    try {
      const row = await recordContinuationInterest({
        wants_continued_access: wants,
        preferred_access: wants ? preference : 'undecided',
      });
      setSaved(row);
    } catch (err) {
      console.error('[pilot] continuation interest failed:', err?.message || err);
      setError("We couldn't record that. Nothing was lost. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <section className="rounded-[20px] bg-white p-6 text-center sm:p-8" style={{ border: '1px solid var(--border-light)' }}>
        <CheckCircle2 size={22} className="mx-auto" style={{ color: 'var(--success-700)' }} />
        <h2 className="tp-section mt-4" style={{ color: 'var(--text-primary)' }}>
          Thanks, that&apos;s recorded.
        </h2>
        <p className="tp-body mx-auto mt-2.5 max-w-md" style={{ color: 'var(--text-secondary)' }}>
          {saved.wants_continued_access
            ? 'We have your interest in continued access and your preferred option. We will be in touch before opening it.'
            : 'We have noted that you are not looking to continue right now. Everything you built stays in your Evidence Library.'}
        </p>
        <button type="button" onClick={() => setSaved(null)}
          className="tp-body mt-5 font-bold" style={{ color: 'var(--brand-navy-700)' }}>
          Change my answer
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-[20px] bg-white p-6 sm:p-8" style={{ border: '1px solid var(--border-light)' }}>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
        {CONTINUATION_MESSAGE}
      </h2>
      <p className="tp-prose mt-2.5" style={{ color: 'var(--text-secondary)' }}>
        Your first cycle is complete and everything you produced stays yours. Continued access is not open yet. Tell us
        whether you want it and which option fits, and nothing is charged.
      </p>

      <p className="mt-5 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Do you want continued access?</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {[[true, 'Yes, I want to keep going'], [false, 'Not right now']].map(([val, label]) => {
          const on = wants === val;
          return (
            <button key={String(val)} type="button" onClick={() => { setWants(val); setError(''); }}
              aria-pressed={on} className="ui-press tp-body rounded-[12px] p-3 text-left font-bold"
              style={on
                ? { background: 'var(--brand-navy-900)', color: '#fff', minHeight: '48px' }
                : { background: 'var(--background-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}>
              {label}
            </button>
          );
        })}
      </div>

      {wants === true && (
        <>
          <p className="mt-5 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Which would you prefer?</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {PREFERENCES.map(([val, label, sub]) => {
              const on = preference === val;
              return (
                <button key={val} type="button" onClick={() => { setPreference(val); setError(''); }}
                  aria-pressed={on} className="ui-press rounded-[12px] p-3 text-left"
                  style={on
                    ? { background: 'var(--brand-navy-900)', color: '#fff', minHeight: '48px' }
                    : { background: 'var(--background-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}>
                  <span className="tp-body block font-bold">{label}</span>
                  <span className="tp-meta mt-1 block" style={{ color: on ? 'rgba(255,255,255,.75)' : 'var(--text-muted)' }}>{sub}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-1.5 text-sm font-semibold text-red-600" role="alert">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />{error}
        </p>
      )}

      <button type="button" onClick={submit} disabled={busy || wants == null}
        className="ui-press tp-body mt-5 flex w-full items-center justify-center gap-2 rounded-[10px] font-bold text-white disabled:opacity-50"
        style={{ background: 'var(--brand-navy-900)', minHeight: '50px' }}>
        {busy ? <><Loader2 size={15} className="animate-spin" /> Recording…</> : 'Record my answer'}
      </button>
      <p className="tp-meta mt-2.5 text-center" style={{ color: 'var(--text-muted)' }}>
        No payment is taken and no card is requested in this phase.
      </p>
    </section>
  );
}