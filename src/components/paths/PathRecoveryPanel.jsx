import { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { generatePathTest } from '@/lib/path-generator';

/**
 * Shown when a student finished onboarding but their personalised paths could
 * not be loaded, or only part of a set was saved. It never generates anything
 * on its own — a replacement set is written only after explicit confirmation,
 * and is stored as a new set alongside the original records.
 */
export default function PathRecoveryPanel({ variant = 'missing', existingCount = 0, onRestored }) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  const incomplete = variant === 'incomplete';

  const restore = async () => {
    setWorking(true);
    setError(null);
    try {
      await generatePathTest({ force: true });
      onRestored?.();
    } catch (e) {
      setError(e?.message || 'Path generation failed. Your onboarding answers are still saved.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="rounded-[24px] border p-8 sm:p-10" style={{ borderColor: '#FDE68A', background: 'var(--warning-50)' }}>
      <div className="flex items-start gap-4">
        <AlertTriangle size={22} className="mt-0.5 shrink-0" style={{ color: 'var(--warning-700)' }} />
        <div className="flex-1">
          <h3 className="font-heading text-xl font-bold" style={{ color: 'var(--surface-dark-900)' }}>
            {incomplete ? 'Your path set is incomplete.' : 'We could not load your personalized paths.'}
          </h3>
          <p className="mt-2 text-sm leading-6" style={{ color: '#78350F' }}>
            {incomplete
              ? `Only ${existingCount} of 3 paths were saved when your recommendations were generated. The ${existingCount} you have are shown below and will not be changed or duplicated.`
              : 'Your onboarding answers are safe. We just could not find the path recommendations that were generated from them. Nothing has been deleted.'}
          </p>

          {error && <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--danger-700)' }}>{error}</p>}

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--brand-navy-900)' }}
            >
              <RefreshCw size={15} /> {incomplete ? 'Retry Path Generation' : 'Restore My Paths'}
            </button>
          ) : (
            <div className="mt-5 rounded-xl border bg-white p-4" style={{ borderColor: '#FDE68A' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--surface-dark-900)' }}>
                Generate a new set of paths from your saved onboarding answers?
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                Your original records and onboarding responses are kept. The new paths are saved as a separate set.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={restore}
                  disabled={working}
                  className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: 'var(--brand-navy-900)' }}
                >
                  <RefreshCw size={15} className={working ? 'animate-spin' : ''} />
                  {working ? 'Generating…' : 'Yes, generate a new set'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={working}
                  className="rounded-[10px] border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                  style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)', background: '#fff' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}