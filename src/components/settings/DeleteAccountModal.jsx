import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { deleteMyAccount } from '@/lib/account-deletion';
import { clearCampusStore } from '@/lib/campus-store';
import { base44 } from '@/api/base44Client';

/**
 * Deletion is irreversible, so it asks for the word rather than a single tap.
 */
export default function DeleteAccountModal({ onClose }) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = confirmText.trim().toUpperCase() === 'DELETE';

  const run = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteMyAccount();
      clearCampusStore();
      try { localStorage.clear(); sessionStorage.clear(); } catch { /* private mode */ }
      // Drops the token and returns to the landing page.
      base44.auth.logout('/');
    } catch (err) {
      console.error('[settings] account deletion failed:', err?.message || 'unknown');
      setError('We could not finish deleting your account just now. Nothing else was changed. Try again in a moment.');
      setBusy(false);
    }
  };

  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      <div className="anim-modal w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-t-[var(--r-surface)] bg-white p-6 sm:rounded-[var(--r-surface)] sm:p-8">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" style={{ color: 'var(--danger-700)' }} />
          <div>
            <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Delete your account</h2>
            <p className="tp-prose mt-2 text-[color:var(--ink-700)]">
              This permanently deletes your paths, experiments, missions, proof of work, contacts,
              reflections and resumes, and clears the details on your account. It cannot be undone.
            </p>
          </div>
        </div>

        <label className="tp-body mt-6 block font-semibold text-[color:var(--ink-700)]">
          Type DELETE to confirm
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            autoCapitalize="characters"
            placeholder="DELETE"
            className="mt-1.5 w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--danger-700)]"
          />
        </label>

        {error && <p className="tp-meta mt-3 font-semibold" role="alert" style={{ color: 'var(--danger-700)' }}>{error}</p>}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button onClick={onClose} disabled={busy}
            className="tp-body touch-target flex-1 rounded-[var(--r-control)] border border-[color:var(--ink-200)] py-3 font-semibold text-[color:var(--ink-700)] disabled:opacity-60">
            Keep my account
          </button>
          <button onClick={run} disabled={!ready || busy}
            className="tp-body touch-target flex-1 rounded-[var(--r-control)] py-3 font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--danger-700)' }}>
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </div>
    </div>
  );
}