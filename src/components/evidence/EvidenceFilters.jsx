import { SlidersHorizontal, X, Search } from 'lucide-react';
import { DEFAULT_FILTERS, typeLabel, VISIBILITY_LABELS, RESUME_STATUS } from '@/lib/evidence-library';

// w-full inside the grid below: on a phone each control takes its own cell instead
// of pushing the page sideways.
const sel = 'w-full min-w-0 sm:w-auto rounded-xl border border-[color:var(--ink-200)] bg-white px-3 py-2 text-sm text-[color:var(--ink-700)] outline-none focus:border-[color:var(--brand-navy-900)]';

export default function EvidenceFilters({ filters, setFilters, options, shown, total }) {
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const activeCount = Object.keys(DEFAULT_FILTERS).filter((k) => filters[k] !== DEFAULT_FILTERS[k]).length;

  return (
    <div className="mb-5 rounded-[16px] border border-[color:var(--ink-200)] bg-white p-4">
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-400)]" />
        <input value={filters.q} onChange={set('q')} placeholder="Search evidence by title, path, experiment, mission or skill…"
          className="w-full rounded-xl border border-[color:var(--ink-200)] bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
      </div>

      <div className="grid grid-cols-1 items-center gap-2 sm:flex sm:flex-wrap">
        <div className="flex shrink-0 items-center gap-2 sm:col-span-2">
          <SlidersHorizontal size={14} className="text-[color:var(--ink-500)]" />
          <span className="text-xs font-bold uppercase tracking-[.12em] text-[color:var(--ink-500)]">Organize by</span>
          {activeCount > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-700)' }}>
              {activeCount} active
            </span>
          )}
        </div>

        <select value={filters.path} onChange={set('path')} aria-label="Filter by career path" className={sel}>
          <option value="all">All paths</option>
          {options.paths.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={filters.cycle} onChange={set('cycle')} aria-label="Filter by career cycle" className={sel}>
          <option value="all">All cycles</option>
          {options.cycles.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>

        <select value={filters.experiment} onChange={set('experiment')} aria-label="Filter by experiment" className={sel}>
          <option value="all">All experiments</option>
          {options.experiments.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>

        <select value={filters.mission} onChange={set('mission')} aria-label="Filter by mission" className={sel}>
          <option value="all">All missions</option>
          {options.missions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>

        <select value={filters.type} onChange={set('type')} aria-label="Filter by evidence type" className={sel}>
          <option value="all">All evidence types</option>
          {options.types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </select>

        <select value={filters.skill} onChange={set('skill')} aria-label="Filter by skill demonstrated" className={sel}>
          <option value="all">All skills</option>
          {options.skills.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={filters.visibility} onChange={set('visibility')} aria-label="Filter by visibility" className={sel}>
          <option value="all">All visibility</option>
          {options.visibilities.map((v) => <option key={v} value={v}>{VISIBILITY_LABELS[v] || v}</option>)}
        </select>

        <select value={filters.resume} onChange={set('resume')} aria-label="Filter by resume eligibility" className={sel}>
          <option value="all">All resume statuses</option>
          {Object.entries(RESUME_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <label className="flex min-w-0 items-center gap-1.5 text-xs text-[color:var(--ink-500)]">
          From <input type="date" value={filters.from} onChange={set('from')} aria-label="From date" className={sel} />
        </label>
        <label className="flex min-w-0 items-center gap-1.5 text-xs text-[color:var(--ink-500)]">
          To <input type="date" value={filters.to} onChange={set('to')} aria-label="To date" className={sel} />
        </label>

        {activeCount > 0 && (
          <button onClick={() => setFilters(DEFAULT_FILTERS)}
            className="flex items-center gap-1 rounded-lg border border-[color:var(--ink-200)] px-3 py-2 text-xs font-semibold text-[color:var(--ink-500)] transition hover:border-red-200 hover:text-red-600">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-[color:var(--ink-400)]">
        {shown} piece{shown !== 1 ? 's' : ''} of evidence shown{total !== shown ? ` of ${total}` : ''}.
      </p>
    </div>
  );
}