/**
 * One tradeoff, and the student's own reading of it. The six statuses are the
 * whole interaction: nothing here rates the student, and choosing a status is
 * recorded as a position they can change later, not as a finding.
 */
import { useState } from 'react';
import { TRADEOFF_STATUSES, tradeoffTest } from '@/lib/tradeoffs';

const TONE = {
  unknown: 'var(--ink-100)',
  untested: 'var(--ink-100)',
  acceptable: 'var(--success-50)',
  concern: 'var(--warning-50)',
  dealbreaker: 'var(--danger-50)',
  context_dependent: 'var(--info-50)',
};

const INK = {
  unknown: 'var(--ink-500)',
  untested: 'var(--ink-500)',
  acceptable: 'var(--success-700)',
  concern: 'var(--warning-700)',
  dealbreaker: 'var(--danger-700)',
  context_dependent: 'var(--info-700)',
};

export default function TradeoffRow({ tradeoff, onSetStatus }) {
  const [saving, setSaving] = useState('');

  const choose = async (statusId) => {
    if (saving || statusId === tradeoff.status) return;
    setSaving(statusId);
    await onSetStatus(tradeoff, statusId);
    setSaving('');
  };

  return (
    <li
      className="rounded-[var(--r-control)] p-4"
      style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{tradeoff.label}</p>
        <span
          className="tp-meta rounded-full px-2.5 py-1 font-semibold"
          style={{ background: TONE[tradeoff.status], color: INK[tradeoff.status] }}
        >
          {tradeoff.statusLabel}
        </span>
      </div>

      <p className="tp-meta mt-1.5" style={{ color: 'var(--text-secondary)' }}>{tradeoff.detail}</p>
      <p className="tp-meta mt-1.5 uppercase" style={{ color: 'var(--ink-400)', letterSpacing: '0.06em' }}>
        {tradeoff.source}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {TRADEOFF_STATUSES.map(s => {
          const active = s.id === tradeoff.status;
          return (
            <button
              key={s.id}
              type="button"
              title={s.help}
              onClick={() => choose(s.id)}
              disabled={Boolean(saving)}
              className="tp-meta touch-target rounded-full px-3 py-1.5 font-semibold disabled:opacity-60"
              style={{
                background: active ? 'var(--brand-navy-900)' : 'var(--background-primary)',
                color: active ? 'var(--brand-white)' : 'var(--text-secondary)',
                border: `1px solid ${active ? 'var(--brand-navy-900)' : 'var(--border-light)'}`,
              }}
            >
              {saving === s.id ? 'Saving' : s.label}
            </button>
          );
        })}
      </div>

      {!tradeoff.resolved && (
        <p className="tp-meta mt-3" style={{ color: 'var(--ink-400)' }}>
          Still open. {tradeoffTest(tradeoff)}
        </p>
      )}
    </li>
  );
}