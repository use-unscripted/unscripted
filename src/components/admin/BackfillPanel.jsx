/**
 * Records backfill, team only.
 *
 * Two buttons on purpose: the preview writes nothing and reports exactly what
 * would be created, and only the second one commits. Every row it writes is
 * marked as a backfill and names the record it came from, and anything a record
 * cannot prove is listed as left unknown rather than filled in.
 */
import { useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function BackfillPanel({ onWritten }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const run = async (dryRun) => {
    setBusy(dryRun ? 'preview' : 'commit');
    setError('');
    try {
      const res = await base44.functions.invoke('analyticsBackfill', { dry_run: dryRun });
      setResult(res?.data || null);
      if (!dryRun) onWritten?.();
    } catch (err) {
      setError(err?.message || 'That did not run.');
    }
    setBusy('');
  };

  const rows = Object.entries(result?.by_event || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="app-stack">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => run(true)} disabled={!!busy}
          className="ui-press app-cta-secondary tp-control disabled:opacity-60">
          {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />} Preview backfill
        </button>
        <button type="button" onClick={() => run(false)} disabled={!!busy || !result || !result.events_pending}
          className="ui-press app-cta tp-control disabled:opacity-50">
          {busy === 'commit' ? <Loader2 size={14} className="animate-spin" /> : null}
          Write {result?.events_pending ?? 0} events
        </button>
      </div>

      {error && <p className="tp-body" style={{ color: 'var(--danger-700)' }}>{error}</p>}

      {result && (
        <div className="app-card-flat p-4">
          <p className="tp-body" style={{ color: 'var(--text-primary)' }}>
            {result.events_provable} provable from records · {result.events_already_on_file} already on file ·
            {' '}{result.events_pending} pending · {result.events_written} written
            {result.dry_run ? ' (preview only, nothing written)' : ''}
          </p>
          {rows.length > 0 && (
            <ul className="mt-3 space-y-1">
              {rows.map(([name, count]) => (
                <li key={name} className="tp-meta" style={{ color: 'var(--text-secondary)' }}>
                  {name.replace(/_/g, ' ')} · {count}
                </li>
              ))}
            </ul>
          )}
          <p className="tp-eyebrow mt-4" style={{ color: 'var(--text-muted)' }}>Left unknown</p>
          <ul className="mt-1.5 space-y-1">
            {(result.left_unknown || []).map(u => (
              <li key={u.event} className="tp-meta" style={{ color: 'var(--text-muted)' }}>
                {u.event.replace(/_/g, ' ')} — {u.why}
              </li>
            ))}
          </ul>
          <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>{result.note}</p>
        </div>
      )}
    </div>
  );
}