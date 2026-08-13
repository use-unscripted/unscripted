/**
 * The one decision that closes the cycle. Nothing is deleted: the path,
 * experiment, outreach, proof and reflection all stay in Journey
 * History, and the next cycle is opened linked back to this one.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { completeCycle } from '@/lib/career-cycle';
import { CheckCircle2, RefreshCw, Compass, AlertCircle } from 'lucide-react';

const OPTIONS = [
  {
    key: 'continue',
    Icon: CheckCircle2,
    label: 'Continue',
    sub: 'This path stays promising. Next: a deeper experiment that raises the difficulty.',
  },
  {
    key: 'adjust',
    Icon: RefreshCw,
    label: 'Adjust',
    sub: 'Same direction, different test: another role, environment, specialty or version of it.',
  },
  {
    key: 'stop_and_explore',
    Icon: Compass,
    label: 'Stop and explore',
    sub: 'The evidence says it may not fit. Back to path comparison, keeping everything you learned.',
  },
];

export default function DecisionStep({ ctx, reflection, onDecided }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const decide = async (decision) => {
    if (busy) return;
    setBusy(decision);
    setError('');
    try {
      const path = ctx.path;
      if (path) {
        if (decision === 'stop_and_explore') {
          await base44.entities.PathRecommendations.update(path.id, {
            status: 'paused',
            is_primary_focus: false,
            paused_at: new Date().toISOString().split('T')[0],
          });
        } else {
          await Promise.all(
            (ctx.paths || [])
              .filter(p => p.is_primary_focus && p.id !== path.id)
              .map(p => base44.entities.PathRecommendations.update(p.id, { is_primary_focus: false }).catch(() => null))
          );
          await base44.entities.PathRecommendations.update(path.id, {
            status: 'active',
            is_primary_focus: true,
            last_active_at: new Date().toISOString().split('T')[0],
          });
        }
      }
      const result = await completeCycle({
        final_decision: decision,
        post_cycle_clarity_score: reflection?.clarity_score ?? undefined,
        decision_note: reflection?.next_changes || undefined,
      });
      onDecided(decision, result);
    } catch (err) {
      console.error('[reflection] decision failed:', err?.message || err);
      setError("We couldn't record that decision. Your reflection is saved. Try again.");
      setBusy(null);
    }
  };

  return (
    <section id="decision" className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>One decision closes this cycle</h2>
      <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
        You tested {ctx.path?.path_name || ctx.experiment.path_name || 'this path'} and wrote it up. All three answers are progress. Nothing you built goes away.
      </p>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-sm font-semibold text-red-600" role="alert">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />{error}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {OPTIONS.map(({ key, Icon, label, sub }) => (
          <button
            key={key}
            type="button"
            onClick={() => decide(key)}
            disabled={!!busy}
            className="ui-press rounded-[var(--r-control)] p-4 text-left disabled:opacity-60"
            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)', minHeight: '48px' }}
          >
            <Icon size={16} style={{ color: 'var(--brand-navy-700)' }} />
            <p className="tp-card mt-2.5" style={{ color: 'var(--text-primary)' }}>
              {busy === key ? 'Saving…' : label}
            </p>
            <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
          </button>
        ))}
      </div>
    </section>
  );
}