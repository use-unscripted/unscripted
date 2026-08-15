/**
 * The decision that records the hypothesis update and closes the cycle.
 *
 * Three outcomes, all of them results. The update is appended to the
 * hypothesis's history — nothing earlier is overwritten — and the cycle is
 * closed with the equivalent decision it already understands.
 */
import { useState } from 'react';
import { CheckCircle2, RefreshCw, Compass, AlertCircle } from 'lucide-react';
import { completeCycle } from '@/lib/career-cycle';
import { DECISIONS, decisionMeta, recordHypothesisUpdate } from '@/lib/hypothesis-updates';

const ICONS = {
  continue_testing: CheckCircle2,
  modify_hypothesis: RefreshCw,
  eliminate_hypothesis: Compass,
};

export default function HypothesisDecision({ ctx, reflection, synthesis, dimensions = [], onDecided }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const decide = async (key) => {
    if (busy) return;
    setBusy(key);
    setError('');
    try {
      const meta = decisionMeta(key);
      if (ctx.path && synthesis) {
        await recordHypothesisUpdate({
          path: ctx.path,
          synthesis,
          decision: key,
          decisionNote: note,
          reflection,
          experiment: ctx.experiment,
          dimensions,
        });
      }
      const result = await completeCycle({
        final_decision: meta.cycle_decision,
        post_cycle_clarity_score: reflection?.clarity_score ?? undefined,
        decision_note: note.trim() || reflection?.still_unresolved || undefined,
      });
      onDecided(key, result);
    } catch (err) {
      console.error('[reflection] hypothesis decision failed:', err?.message || err);
      setError("We couldn't record that. Your reflection and your synthesis are saved. Try again.");
      setBusy(null);
    }
  };

  return (
    <section id="decision" className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>What happens to this path?</h2>
      <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
        All three are results. Your earlier position on {ctx.path?.path_name || ctx.experiment.path_name || 'this direction'} is kept either way.
      </p>

      {error && (
        <p className="tp-body mt-3 flex items-start gap-1.5 font-semibold text-red-600" role="alert">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />{error}
        </p>
      )}

      <textarea
        rows={2}
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="A note on why (optional). If you are modifying, say which version you would test instead."
        className="mt-4 w-full resize-none rounded-[var(--r-control)] border px-3 py-2.5 text-base outline-none md:text-sm"
        style={{ borderColor: 'var(--border-light)', background: 'var(--background-secondary)' }}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {DECISIONS.map(({ key, label, sub }) => {
          const Icon = ICONS[key];
          return (
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
          );
        })}
      </div>
    </section>
  );
}