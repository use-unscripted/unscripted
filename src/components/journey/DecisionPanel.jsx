import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Compass, RefreshCw } from 'lucide-react';
import { completeCycle } from '@/lib/career-cycle';

/**
 * Stage 6 — the decision the whole journey builds toward.
 * Closes the current career cycle with one of the three controlled decisions and
 * opens the next one, linked back to this cycle. Never deletes anything: paths,
 * experiments, proof, reflections and outreach all stay exactly as they are.
 */
const OPTIONS = [
  {
    key: 'continue',
    icon: CheckCircle2,
    label: 'Keep building on this path',
    sub: 'Sets it as your active direction and keeps every record you created.',
  },
  {
    key: 'adjust',
    icon: RefreshCw,
    label: 'Same path, different test',
    sub: 'Stay on this direction but run a new experiment with what you learned.',
  },
  {
    key: 'stop_and_explore',
    icon: Compass,
    label: 'Test a different direction',
    sub: 'Your current path is paused, not deleted. You can return to it any time.',
  },
];

export default function DecisionPanel({ path, otherPaths, onDecided }) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(null);
  const [clarity, setClarity] = useState(null);

  const decide = async (decision) => {
    if (saving) return;
    setSaving(decision);
    try {
      if (decision !== 'stop_and_explore' && path) {
        await Promise.all(
          (otherPaths || [])
            .filter(p => p.is_primary_focus && p.id !== path.id)
            .map(p => base44.entities.PathRecommendations.update(p.id, { is_primary_focus: false }))
        );
        await base44.entities.PathRecommendations.update(path.id, {
          status: 'active',
          is_primary_focus: true,
          last_active_at: new Date().toISOString().split('T')[0],
        });
      } else if (path) {
        await base44.entities.PathRecommendations.update(path.id, {
          status: 'paused',
          is_primary_focus: false,
          paused_at: new Date().toISOString().split('T')[0],
        });
      }

      await completeCycle({ final_decision: decision, post_cycle_clarity_score: clarity ?? undefined });

      if (decision === 'stop_and_explore') navigate('/paths');
      else if (decision === 'adjust') {
        navigate(`/experiments/new${path?.path_name ? `?pathName=${encodeURIComponent(path.path_name)}` : ''}`);
      } else onDecided?.();
    } finally {
      setSaving(null);
    }
  };

  return (
    <section id="decision" className="rounded-[20px] bg-white p-6" style={{ border: '1px solid var(--border-light)' }}>
      <h3 className="font-heading text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
        Your decision
      </h3>
      <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        You tested {path?.path_name || 'this path'} and produced evidence. Three honest options — all of them are progress.
      </p>

      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-[.12em]" style={{ color: 'var(--text-secondary)' }}>
          How clear are you now? <span className="font-normal normal-case">· optional</span>
        </p>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setClarity(n)}
              aria-pressed={clarity === n}
              className="h-11 w-11 rounded-[10px] text-sm font-bold"
              style={clarity === n
                ? { background: 'var(--brand-navy-900)', color: '#FFFFFF' }
                : { background: 'var(--background-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {OPTIONS.map(({ key, icon: Icon, label, sub }) => (
          <button
            key={key}
            type="button"
            onClick={() => decide(key)}
            disabled={!!saving}
            className="ui-press rounded-[14px] p-4 text-left disabled:opacity-60"
            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)', minHeight: '48px' }}
          >
            <Icon size={16} style={{ color: 'var(--brand-navy-700)' }} />
            <p className="mt-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {saving === key ? 'Saving…' : label}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>
          </button>
        ))}
      </div>
    </section>
  );
}