/**
 * Tradeoffs on one path. Every item is grounded in the Role Blueprint for this
 * career or in the path's own recorded information, so a path with neither shows
 * nothing here rather than a generic list of career worries.
 */
import { useState } from 'react';
import { Scale } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import TradeoffRow from '@/components/conviction/TradeoffRow';

export default function TradeoffsSection({ tradeoffs, path, onChanged }) {
  const [items, setItems] = useState(tradeoffs?.items || []);
  if (!items.length) return null;

  const open = items.filter(t => !t.resolved).length;

  const setStatus = async (tradeoff, statusId) => {
    const payload = {
      path_id: path?.id,
      path_name: path?.path_name,
      tradeoff_id: tradeoff.id,
      tradeoff_label: tradeoff.label,
      source: tradeoff.source,
      dimension_id: tradeoff.dimension || undefined,
      importance: tradeoff.importance,
      status: statusId,
      updated_at: new Date().toISOString(),
    };
    const saved = tradeoff.stanceId
      ? await base44.entities.TradeoffStance.update(tradeoff.stanceId, payload)
      : await base44.entities.TradeoffStance.create(payload);

    setItems(prev => prev.map(t => (t.id === tradeoff.id
      ? {
          ...t,
          stanceId: saved?.id || t.stanceId,
          status: statusId,
          statusLabel: LABELS[statusId],
          resolved: statusId === 'acceptable' || statusId === 'dealbreaker',
        }
      : t)));
    onChanged?.();
  };

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Scale size={17} style={{ color: 'var(--brand-navy-700)' }} /> Tradeoffs
      </h2>
      <p className="tp-prose mt-1.5" style={{ color: 'var(--text-secondary)' }}>
        The costs and conditions recorded for this kind of work. Say where you stand on each one.
        {open > 0 && ` ${open} of ${items.length} are still open.`}
      </p>

      <ul className="mt-4 space-y-3">
        {items.map(t => (
          <TradeoffRow key={t.id} tradeoff={t} onSetStatus={setStatus} />
        ))}
      </ul>
    </section>
  );
}

const LABELS = {
  unknown: 'Unknown',
  untested: 'Untested',
  acceptable: 'Acceptable',
  concern: 'Concern',
  dealbreaker: 'Dealbreaker',
  context_dependent: 'Context dependent',
};