import { STAGES, STAGE_INDEX } from '@/lib/journey';

/**
 * The at-a-glance state of the cycle: what you're testing, what you're running,
 * where you are, how far through, and what's required next.
 */
function Row({ label, value, muted }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold" style={{ color: muted ? 'var(--text-muted)' : 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  );
}

export default function JourneyStatusHeader({ stage, path, experiment, action, effort }) {
  const idx = STAGE_INDEX[stage] ?? 0;
  const pct = Math.round(((idx + 1) / STAGES.length) * 100);

  return (
    <section className="rounded-[18px] bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Row label="Current path" value={path?.path_name || 'None selected'} muted={!path} />
        <Row label="Current experiment" value={experiment?.title || 'Not started'} muted={!experiment} />
        <Row label="Current stage" value={`${STAGES[idx].label} · stage ${idx + 1} of ${STAGES.length}`} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--text-muted)' }}>
            Cycle progress
          </p>
          <p className="text-xs font-bold" style={{ color: 'var(--brand-navy-700)' }}>{pct}%</p>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--background-tertiary)' }}>
          <div className="progress-fill h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-gold-500)' }} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2" style={{ borderColor: 'var(--border-light)' }}>
        <Row label="Next required action" value={action?.label || '—'} />
        {effort && <Row label="Remaining effort" value={effort} />}
      </div>
    </section>
  );
}