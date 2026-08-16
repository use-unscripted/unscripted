import { useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { LEVEL_LABEL } from '@/lib/validation-priority';

const TARGET = {
  professional_reviewed: 'Next: Professionally Reviewed (one approved review of this version)',
  multi_professional: 'Next: Multi-Professional Validated (a second independent review of this version)',
};

/** One ranked experiment, with every factor behind its score stated. */
export default function ValidationQueueRow({ row, factors = [], onStrategic, rank }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try { await onStrategic(row, !row.strategic_priority); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        {rank ? <span className="font-mono text-xs font-bold text-[color:var(--ink-400)]">#{rank}</span> : null}
        <span className="text-sm font-semibold text-[color:var(--surface-dark-900)]">{row.title}</span>
        <span className="rounded-full bg-[color:var(--ink-100)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--ink-500)]">
          {LEVEL_LABEL[row.validation_level]}
        </span>
        <span className="ml-auto font-mono text-sm font-bold text-[color:var(--brand-navy-900)]">{row.priority_score}</span>
      </div>

      <p className="mt-1 font-mono text-[11px] text-[color:var(--ink-500)]">
        {row.career_title || 'no blueprint'} · v{row.experiment_version} · {row.validation_status.replace(/_/g, ' ')}
        {' · '}{row.counts.recommended_students} recommended · {row.counts.selected_students} selected
      </p>

      {row.next_target && (
        <p className="mt-1 text-xs font-semibold text-[color:var(--ink-700)]">{TARGET[row.next_target]}</p>
      )}

      {row.shortlist_reason && (
        <p className="mt-1 text-xs text-[color:var(--brand-navy-700)]">{row.shortlist_reason}</p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {row.dimensions.length === 0
          ? <span className="text-[11px] text-[color:var(--ink-400)]">No dimensions mapped</span>
          : row.dimensions.map(d => (
            <span key={d} className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={row.major_dimension_gaps.includes(d)
                ? { background: 'var(--warning-50)', color: 'var(--warning-700)' }
                : { background: 'var(--ink-100)', color: 'var(--ink-500)' }}>
              {d.replace(/_/g, ' ')}{row.major_dimension_gaps.includes(d) ? ' · gap' : ''}
            </span>
          ))}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
          {open ? 'Hide why' : 'Why this rank'}
        </button>
        <button type="button" onClick={toggle} disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          style={row.strategic_priority
            ? { background: 'var(--brand-navy-900)', color: '#fff', borderColor: 'var(--brand-navy-900)' }
            : { background: 'white', color: 'var(--ink-700)', borderColor: 'var(--ink-200)' }}>
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Star size={11} />}
          {row.strategic_priority ? 'Strategic' : 'Mark strategic'}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-[color:var(--ink-200)] pt-3">
          <ul className="space-y-1">
            {factors.map(f => (
              <li key={f.key} className="flex items-center gap-2 text-[11px]">
                <span className="w-44 shrink-0 text-[color:var(--ink-500)]">{f.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--ink-100)]">
                  <span className="block h-full rounded-full"
                    style={{ width: `${Math.round((row.factors[f.key] || 0) * 100)}%`, background: 'var(--brand-navy-700)' }} />
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-[color:var(--ink-700)]">
                  {row.factor_contributions[f.key]}/{f.weight}
                </span>
              </li>
            ))}
          </ul>
          <ul className="space-y-0.5">
            {row.reasons.map((r, i) => (
              <li key={i} className="text-[11px] text-[color:var(--ink-500)]">{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}