import { AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Path Validation Coverage: depth before breadth, per supported Path.
 *
 * "Covered" is deliberately strict. A dimension counts as covered only when an
 * experiment that has reached Professionally Reviewed maps to it — a draft that
 * claims to test something is listed separately as claimed but not reviewed.
 */
const Stat = ({ label, value, tone }) => (
  <div className="rounded-lg bg-[color:var(--ink-50)] px-2.5 py-2">
    <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--ink-400)]">{label}</p>
    <p className="text-base font-bold" style={{ color: tone || 'var(--surface-dark-900)' }}>{value}</p>
  </div>
);

const Chips = ({ items, tone }) => (
  <div className="mt-1 flex flex-wrap gap-1">
    {items.length === 0
      ? <span className="text-[11px] text-[color:var(--ink-400)]">None</span>
      : items.map(d => (
        <span key={d.id} className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={tone}>{d.label}</span>
      ))}
  </div>
);

export default function PathCoveragePanel({ paths = [] }) {
  if (!paths.length) {
    return <p className="text-sm text-[color:var(--ink-500)]">No validation records to group by Path yet.</p>;
  }

  return (
    <div className="space-y-2">
      {paths.map(p => (
        <div key={p.career_title} className="rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[color:var(--surface-dark-900)]">{p.career_title}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--ink-400)]">
              {p.students_on_path} real student{p.students_on_path === 1 ? '' : 's'} on this Path
            </span>
          </div>

          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: p.professionally_reviewed ? 'var(--ink-700)' : 'var(--warning-700)' }}>
            {p.professionally_reviewed
              ? <CheckCircle2 size={12} />
              : <AlertTriangle size={12} />}
            {p.verdict}
          </p>

          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Usable experiments" value={p.usable_experiments} />
            <Stat label="Source grounded" value={p.source_grounded} />
            <Stat label="Professionally reviewed" value={p.professionally_reviewed}
              tone={p.professionally_reviewed ? 'var(--success-700)' : 'var(--warning-700)'} />
            <Stat label="Multi-professional" value={p.multi_professional_validated}
              tone={p.multi_professional_validated ? 'var(--success-700)' : 'var(--ink-500)'} />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--ink-400)]">Dimensions covered</p>
              <Chips items={p.dimensions_covered} tone={{ background: 'var(--success-50)', color: 'var(--success-700)' }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--ink-400)]">Major dimensions not yet covered</p>
              <Chips items={p.major_dimensions_missing} tone={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--ink-400)]">Claimed but not reviewed</p>
              <Chips items={p.dimensions_claimed_not_reviewed} tone={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--ink-400)]">Kinds of work still untested</p>
              <Chips items={p.groups_missing} tone={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}