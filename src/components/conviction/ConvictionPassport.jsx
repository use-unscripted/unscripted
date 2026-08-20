/**
 * The Career Conviction Passport, offered once a path is Decision Ready.
 *
 * The generated wording is a DRAFT until the student approves it. Nothing is
 * marked final on their behalf, and the draft can be regenerated or discarded.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Sparkles, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import {
  loadPassport, generatePassport, approvePassport, discardPassport, PASSPORT_FIELDS,
} from '@/lib/conviction-passport';

export default function ConvictionPassport({ path, review, ready }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState('');

  const { data: passport, isLoading } = useQuery({
    queryKey: ['conviction-passport', path.id],
    queryFn: () => loadPassport(path.id),
    staleTime: 30_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['conviction-passport', path.id] });

  const run = async (kind, fn) => {
    setBusy(kind);
    await fn();
    await refresh();
    setBusy('');
  };

  if (!ready && !passport) return null;

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <BadgeCheck size={17} style={{ color: 'var(--brand-navy-700)' }} /> Career Conviction Passport
      </h2>
      <p className="tp-prose mt-1.5" style={{ color: 'var(--text-secondary)' }}>
A written record of how you reached your decision about {path.path_name}, from your own evidence.
      </p>

      {isLoading ? (
        <p className="tp-meta mt-4" style={{ color: 'var(--ink-400)' }}>Loading…</p>
      ) : !passport ? (
        <button
          type="button"
          className="app-cta tp-body mt-4 font-semibold"
          disabled={busy === 'generate'}
          onClick={() => run('generate', () => generatePassport({ path, review }))}
        >
          {busy === 'generate'
            ? <><Loader2 size={15} className="animate-spin" /> Writing your draft…</>
            : <><Sparkles size={15} /> Generate my passport</>}
        </button>
      ) : (
        <>
          <p
            className="tp-meta mt-4 rounded-[var(--r-control)] px-3 py-2 font-semibold"
            style={{
              background: passport.status === 'approved' ? 'var(--success-50)' : 'var(--warning-50)',
              color: passport.status === 'approved' ? 'var(--success-700)' : 'var(--warning-700)',
            }}
          >
            {passport.status === 'approved'
              ? 'Approved by you. This is your final record.'
              : 'Draft, written for you. Nothing is final until you approve it.'}
          </p>

          <div className="mt-4 space-y-3.5">
            {PASSPORT_FIELDS.filter(f => passport[f.id]).map(f => (
              <div key={f.id}>
                <p className="tp-meta font-semibold uppercase" style={{ color: 'var(--ink-400)', letterSpacing: '0.06em' }}>{f.label}</p>
                <p className="tp-body mt-1" style={{ color: 'var(--text-primary)' }}>{passport[f.id]}</p>
              </div>
            ))}
          </div>

          {passport.status !== 'approved' && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="app-cta tp-body font-semibold"
                disabled={Boolean(busy)}
                onClick={() => run('approve', () => approvePassport(passport.id))}
              >
                {busy === 'approve' ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />}
                Approve this record
              </button>
              <button
                type="button"
                className="app-cta-secondary tp-body font-semibold"
                disabled={Boolean(busy)}
                onClick={() => run('regen', () => generatePassport({ path, review, existingId: passport.id }))}
              >
                {busy === 'regen' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Write it again
              </button>
              <button
                type="button"
                className="app-cta-secondary tp-body font-semibold"
                disabled={Boolean(busy)}
                onClick={() => run('discard', () => discardPassport(passport.id))}
              >
                <Trash2 size={15} /> Discard
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}