import { useState } from 'react';
import { SlidersHorizontal, X, Search, ChevronDown } from 'lucide-react';
import { DEFAULT_FILTERS, typeLabel, VISIBILITY_LABELS, RESUME_STATUS } from '@/lib/evidence-library';

// w-full inside the grid below: on a phone each control takes its own cell instead
// of pushing the page sideways.
const sel = 'w-full min-w-0 rounded-xl border border-[color:var(--ink-200)] bg-white px-3 py-2 text-base md:text-sm text-[color:var(--ink-700)] outline-none focus:border-[color:var(--brand-navy-900)]';

// Search stays on the surface; everything else lives behind one button. A student
// with four pieces of evidence should not be handed eleven controls.
export default function EvidenceFilters({ filters, setFilters, options, shown, total }) {
  const [open, setOpen] = useState(false);
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  // The search box is always visible, so it never counts toward the hidden badge.
  const activeCount = Object.keys(DEFAULT_FILTERS)
    .filter((k) => k !== 'q' && filters[k] !== DEFAULT_FILTERS[k]).length;

  // A dropdown that can only ever pick the one value already on screen narrows
  // nothing, so drop it rather than show a dead control.
  const drops = [
    options.paths.length > 1 && ['path', 'All paths', options.paths.map((p) => [p, p])],
    options.cycles.length > 1 && ['cycle', 'All cycles', options.cycles],
    options.experiments.length > 1 && ['experiment', 'All experiments', options.experiments],
    options.missions.length > 1 && ['mission', 'All missions', options.missions],
    options.types.length > 1 && ['type', 'All types', options.types.map((t) => [t, typeLabel(t)])],
    options.skills.length > 1 && ['skill', 'All skills', options.skills.map((s) => [s, s])],
    options.visibilities.length > 1 && ['visibility', 'All visibility', options.visibilities.map((v) => [v, VISIBILITY_LABELS[v] || v])],
    total > 1 && ['resume', 'All resume statuses', Object.entries(RESUME_STATUS).map(([k, v]) => [k, v.label])],
  ].filter(Boolean);

  return (
    <div className="mb-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-400)]" />
          <input value={filters.q} onChange={set('q')} placeholder="Search your evidence…"
            className="w-full rounded-xl border border-[color:var(--ink-200)] bg-white py-2.5 pl-9 pr-4 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
        </div>

        {drops.length > 0 && (
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="ui-press flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[color:var(--ink-200)] bg-white px-4 py-2.5 text-sm font-semibold text-[color:var(--ink-700)]">
            <SlidersHorizontal size={14} className="text-[color:var(--ink-500)]" />
            Filters
            {activeCount > 0 && (
              <span className="tp-meta rounded-full px-2 py-0.5 font-bold" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-700)' }}>
                {activeCount}
              </span>
            )}
            <ChevronDown size={14} className={`text-[color:var(--ink-400)] transition ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {open && drops.length > 0 && (
        <div className="mt-2 rounded-[16px] border border-[color:var(--ink-200)] bg-white p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {drops.map(([key, allLabel, opts]) => (
              <select key={key} value={filters[key]} onChange={set(key)} aria-label={allLabel} className={sel}>
                <option value="all">{allLabel}</option>
                {opts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            ))}

          </div>

          <div className="tp-meta mt-2 flex flex-wrap items-center gap-2 text-[color:var(--ink-500)]">
            <span className="shrink-0">Between</span>
            <input type="date" value={filters.from} onChange={set('from')} aria-label="From date" className={`${sel} sm:w-44`} />
            <span className="shrink-0">and</span>
            <input type="date" value={filters.to} onChange={set('to')} aria-label="To date" className={`${sel} sm:w-44`} />
          </div>

          {activeCount > 0 && (
            <button onClick={() => setFilters({ ...DEFAULT_FILTERS, q: filters.q })}
              className="tp-meta mt-3 flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-4 py-2 font-semibold text-[color:var(--ink-500)] transition hover:border-red-200 hover:text-red-600">
              <X size={13} /> Clear filters
            </button>
          )}
        </div>
      )}

      {shown !== total && (
        <p className="tp-meta mt-2 text-[color:var(--ink-400)]">
          {shown} of {total} shown.
        </p>
      )}
    </div>
  );
}
