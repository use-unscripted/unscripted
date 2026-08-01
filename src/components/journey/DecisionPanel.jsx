import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Compass } from 'lucide-react';

/**
 * Stage 6 — the decision the whole journey builds toward.
 * Commits the tested path (existing status + primary-focus fields, no new entity)
 * or sends the student back to compare directions. Never deletes anything.
 */
export default function DecisionPanel({ path, otherPaths, onDecided }) {
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    if (!path || saving) return;
    setSaving(true);
    try {
      await Promise.all(
        otherPaths
          .filter(p => p.is_primary_focus && p.id !== path.id)
          .map(p => base44.entities.PathRecommendations.update(p.id, { is_primary_focus: false }))
      );
      await base44.entities.PathRecommendations.update(path.id, {
        status: 'active',
        is_primary_focus: true,
        last_active_at: new Date().toISOString().split('T')[0],
      });
      onDecided?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="decision" className="rounded-[20px] bg-white p-6" style={{ border: '1px solid var(--border-light)' }}>
      <h3 className="font-heading text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
        Your decision
      </h3>
      <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        You tested {path?.path_name || 'this path'} and produced evidence. Two honest options — both are progress.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={commit}
          disabled={saving || !path}
          className="ui-press rounded-[14px] p-4 text-left disabled:opacity-60"
          style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)', minHeight: '48px' }}
        >
          <CheckCircle2 size={16} style={{ color: 'var(--brand-navy-700)' }} />
          <p className="mt-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {saving ? 'Saving…' : 'Keep building on this path'}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Sets it as your active direction and keeps every record you created.
          </p>
        </button>

        <Link
          to="/paths"
          className="ui-press rounded-[14px] p-4 text-left"
          style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)', minHeight: '48px' }}
        >
          <Compass size={16} style={{ color: 'var(--brand-navy-700)' }} />
          <p className="mt-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Test a different direction</p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Your current path is paused, not deleted. You can return to it any time.
          </p>
        </Link>
      </div>
    </section>
  );
}