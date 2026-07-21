import { useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Star, Pencil, Pause, Play, Archive, ChevronDown, ChevronUp, Clock, CheckCircle2, History, ArrowRight, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import CreatePathModal from '@/components/paths/CreatePathModal';
import EditPathModal from '@/components/paths/EditPathModal';
import ReactivationModal from '@/components/paths/ReactivationModal';
import { RiskBadge, ConfidenceBadge, RiskConfidenceLegend } from '@/components/paths/RiskConfidenceBadges';
import {
  SORT_OPTIONS, DEFAULT_FILTERS,
  sortPaths, filterPaths,
  filtersToParams, filtersFromParams,
  ACTIVE_STATUSES, PAUSED_STATUSES, HISTORY_STATUSES,
} from '@/lib/path-sort-filter';

const STATUS_CFG = {
  active:        { label: 'Active',         bg: '#F0FDF4', text: '#15803D' },
  draft:         { label: 'Draft',          bg: '#F1F5F9', text: '#64748B' },
  paused:        { label: 'Paused',         bg: '#FFFBEB', text: '#B45309' },
  completed:     { label: 'Completed',      bg: '#EFF6FF', text: '#1D4ED8' },
  archived:      { label: 'Archived',       bg: '#F1F5F9', text: '#94A3B8' },
  exploring:     { label: 'Exploring',      bg: '#F8ECEF', text: '#8B0C21' },
  deprioritized: { label: 'Deprioritized',  bg: '#F1F5F9', text: '#94A3B8' },
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusCfg(s) { return STATUS_CFG[s] || STATUS_CFG.exploring; }

// ── Paused / Completed path reopen panel ─────────────────────────────────────
function PausedPathPanel({ path, experiments, missions, proof, contacts, reflections, onResume, onArchive }) {
  const pathExps = experiments.filter(e => e.path_name === path.path_name);
  const completedExps = pathExps.filter(e => e.status === 'completed');
  const pathProof = proof.filter(p => p.path_tested === path.path_name || pathExps.some(e => e.id === p.experiment_id));
  const pathContacts = contacts.filter(c => c.path_being_tested === path.path_name || pathExps.some(e => e.id === c.experiment_id));
  const pathReflections = reflections.filter(r => r.path_name === path.path_name || pathExps.some(e => e.id === r.experiment_id));

  return (
    <div className="rounded-[20px] border-2 p-6 space-y-5" style={{ borderColor: 'rgba(180,83,9,0.3)', background: '#FFFDF7' }}>
      <div className="rounded-xl p-4" style={{ background: '#FFFBEB', border: '1px solid rgba(180,83,9,0.2)' }}>
        <p className="text-sm font-bold text-[#B45309]">You previously explored this path.</p>
        {path.last_active_at && <p className="text-xs text-[#334155] mt-1">Last active: {fmtDate(path.last_active_at)}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-4 text-center">
        {[
          { label: 'Experiments', val: pathExps.length },
          { label: 'Missions done', val: missions.filter(m => pathExps.some(e => e.id === m.experiment_id) && m.status === 'completed').length },
          { label: 'Proof submitted', val: pathProof.length },
          { label: 'Contacts', val: pathContacts.length },
        ].map(({ label, val }) => (
          <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <p className="font-heading text-2xl font-bold text-[#050816]">{val}</p>
            <p className="text-xs text-[#64748B] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {completedExps.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2">Completed experiments</p>
          <div className="space-y-1.5">
            {completedExps.map(e => (
              <div key={e.id} className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={13} className="text-green-600 shrink-0" />
                <span className="text-[#334155]">{e.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pathReflections.length > 0 && (
        <p className="text-xs text-[#64748B]">{pathReflections.length} reflection{pathReflections.length > 1 ? 's' : ''} saved on this path.</p>
      )}

      <div className="flex flex-wrap gap-3">
        <button onClick={onResume}
          className="flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.15)' }}>
          <RotateCcw size={14} /> Resume This Path
        </button>
        <button onClick={onArchive}
          className="flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] px-5 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
          <Archive size={14} /> Archive Path
        </button>
      </div>
    </div>
  );
}

// ── Path card ─────────────────────────────────────────────────────────────────
function PathCard({ path, experiments, missions, proof, contacts, reflections, onAction, expanded, onToggle }) {
  const cfg = statusCfg(path.status);
  const d = path.generated_detail || {};

  const pathExps = experiments.filter(e => e.path_name === path.path_name);
  const completedExps = pathExps.filter(e => e.status === 'completed');
  const pct = pathExps.length ? Math.round(completedExps.length / pathExps.length * 100) : 0;
  const isPausedOrCompleted = ['paused', 'completed'].includes(path.status);

  return (
    <div className="rounded-[20px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {path.is_primary_focus && (
                <span className="rounded-full px-2.5 py-1 text-xs font-bold flex items-center gap-1" style={{ background: '#F8ECEF', color: '#8B0C21' }}>
                  <Star size={11} /> Primary Focus
                </span>
              )}
              <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
              {path.risk_level && <RiskBadge riskLevel={path.risk_level} />}
              {path.confidence_level && <ConfidenceBadge confidenceLevel={path.confidence_level} />}
            </div>
            <h2 className="font-heading text-xl font-bold text-[#050816]">{path.path_name}</h2>
            {path.path_category && <p className="text-xs text-[#94A3B8] mt-0.5">{path.path_category}</p>}
            <p className="mt-2 text-sm text-[#334155] line-clamp-2">{path.why_it_fits || path.fit_reason}</p>

            {pathExps.length > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-[#94A3B8] mb-1">
                  <span>Experiment progress</span>
                  <span>{completedExps.length}/{pathExps.length}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-[#F1F5F9]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#8B0C21' }} />
                </div>
              </div>
            )}

            {path.last_active_at && (
              <p className="mt-2 text-xs text-[#94A3B8] flex items-center gap-1"><Clock size={11} /> Last active {fmtDate(path.last_active_at)}</p>
            )}
          </div>

          <button onClick={onToggle} className="shrink-0 rounded-xl border border-[#E2E8F0] p-2 hover:bg-[#F8FAFC]">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => onAction('edit', path)}
            className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]">
            <Pencil size={12} /> Edit
          </button>
          {!path.is_primary_focus && ACTIVE_STATUSES.includes(path.status) && (
            <button onClick={() => onAction('make_primary', path)}
              className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8ECEF]">
              <Star size={12} /> Make Primary
            </button>
          )}
          {ACTIVE_STATUSES.includes(path.status) && (
            <button onClick={() => onAction('pause', path)}
              className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]">
              <Pause size={12} /> Pause
            </button>
          )}
          {path.status === 'paused' && (
            <button onClick={() => onAction('resume', path)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: '#8B0C21' }}>
              <Play size={12} /> Resume
            </button>
          )}
          {path.status !== 'archived' && (
            <button onClick={() => onAction('complete', path)}
              className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]">
              <CheckCircle2 size={12} /> Mark Complete
            </button>
          )}
          {path.status !== 'archived' && (
            <button onClick={() => onAction('archive', path)}
              className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
              <Archive size={12} /> Archive
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#E2E8F0] p-6 space-y-5">
          {isPausedOrCompleted && (
            <PausedPathPanel
              path={path}
              experiments={experiments}
              missions={missions}
              proof={proof}
              contacts={contacts}
              reflections={reflections}
              onResume={() => onAction('resume', path)}
              onArchive={() => onAction('archive', path)}
            />
          )}

          {(path.why_it_may_not_fit || path.concern) && (
            <div className="rounded-xl p-3" style={{ background: '#FFFBEB', border: '1px solid rgba(180,83,9,0.2)' }}>
              <p className="text-xs font-bold text-[#B45309] uppercase tracking-wide mb-1">Potential concern</p>
              <p className="text-sm text-[#334155]">{path.why_it_may_not_fit || path.concern}</p>
            </div>
          )}

          {(path.lifestyle_implications || d.lifestyle) && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B] mb-2">Lifestyle</p>
              <p className="text-sm text-[#334155]">{path.lifestyle_implications || d.lifestyle}</p>
            </div>
          )}

          {d.income_trajectory && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B] mb-2">Income trajectory</p>
              <p className="text-sm text-[#334155]">{d.income_trajectory}</p>
            </div>
          )}

          {path.goals && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B] mb-2">Your goals</p>
              <p className="text-sm text-[#334155]">{path.goals}</p>
            </div>
          )}

          {(path.skill_gaps?.length > 0 || path.current_gaps?.length > 0) && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B] mb-2">Skill gaps</p>
              <div className="flex flex-wrap gap-2">
                {(path.skill_gaps || path.current_gaps || []).map((g, i) => (
                  <span key={i} className="rounded-full border border-[#E2E8F0] px-3 py-1 text-xs text-[#334155]">{g}</span>
                ))}
              </div>
            </div>
          )}

          {(path.first_experiment || d.day_to_day) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {path.first_experiment && (
                <div className="rounded-xl p-4" style={{ background: '#F8ECEF', border: '1px solid rgba(139,12,33,0.2)' }}>
                  <p className="text-xs font-bold uppercase tracking-[.12em] mb-2" style={{ color: '#8B0C21' }}>Suggested first experiment</p>
                  <p className="text-sm text-[#334155]">{path.first_experiment}</p>
                </div>
              )}
              {d.day_to_day && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B] mb-2">Day-to-day reality</p>
                  <p className="text-sm text-[#334155]">{d.day_to_day}</p>
                </div>
              )}
            </div>
          )}

          {path.notes && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B] mb-2">Notes</p>
              <p className="text-sm text-[#334155]">{path.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B] mb-3 flex items-center gap-1.5"><History size={12} /> Path history</p>
            <div className="space-y-1.5">
              {[
                path.created_date && { date: path.created_date, label: 'Path created' },
                path.started_at   && { date: path.started_at,   label: 'Became active' },
                path.paused_at    && { date: path.paused_at,    label: 'Paused' },
                path.completed_at && { date: path.completed_at, label: 'Completed' },
                path.last_active_at && path.status === 'active' && { date: path.last_active_at, label: 'Last active' },
              ].filter(Boolean).map((evt, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-[#64748B]">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#8B0C21' }} />
                  <span className="font-medium">{fmtDate(evt.date)}</span>
                  <span>{evt.label}</span>
                </div>
              ))}
              {pathExps.map(e => (
                <div key={e.id} className="flex items-center gap-3 text-xs text-[#94A3B8]">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#E2E8F0]" />
                  <span className="font-medium">{fmtDate(e.created_date)}</span>
                  <span>Experiment: {e.title}</span>
                  {e.status === 'completed' && <CheckCircle2 size={11} className="text-green-600" />}
                </div>
              ))}
            </div>
          </div>

          <a href={`/experiments/new?pathName=${encodeURIComponent(path.path_name)}`}
            className="inline-flex items-center gap-2 text-sm font-semibold transition hover:opacity-80"
            style={{ color: '#8B0C21' }}>
            Start an Experiment for This Path <ArrowRight size={15} />
          </a>
        </div>
      )}
    </div>
  );
}

// ── Sort + Filter bar ─────────────────────────────────────────────────────────
function SortFilterBar({ paths, sortBy, setSortBy, filters, setFilters }) {
  const categories = useMemo(() => {
    const cats = [...new Set(paths.map(p => p.path_category).filter(Boolean))].sort();
    return cats;
  }, [paths]);

  const hasActiveFilters = Object.values(filters).some(v => v !== 'all');
  const activeCount = Object.values(filters).filter(v => v !== 'all').length;

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const sel = 'rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#334155] focus:border-[#8B0C21] focus:outline-none';

  return (
    <div className="mb-5 rounded-[16px] border border-[#E2E8F0] bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <SlidersHorizontal size={14} className="text-[#64748B]" />
          <span className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B]">Sort & Filter</span>
          {hasActiveFilters && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: '#F8ECEF', color: '#8B0C21' }}>
              {activeCount} active
            </span>
          )}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          aria-label="Sort paths by"
          className={sel}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Status group */}
        <select
          value={filters.statusGroup}
          onChange={e => setFilters(f => ({ ...f, statusGroup: e.target.value }))}
          aria-label="Filter by status"
          className={sel}
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="paused">Paused only</option>
          <option value="history">History</option>
        </select>

        {/* Risk */}
        <select
          value={filters.risk}
          onChange={e => setFilters(f => ({ ...f, risk: e.target.value }))}
          aria-label="Filter by risk level"
          className={sel}
        >
          <option value="all">All risk levels</option>
          <option value="low">Low risk</option>
          <option value="medium">Moderate risk</option>
          <option value="high">High risk</option>
        </select>

        {/* Confidence */}
        <select
          value={filters.confidence}
          onChange={e => setFilters(f => ({ ...f, confidence: e.target.value }))}
          aria-label="Filter by confidence level"
          className={sel}
        >
          <option value="all">All confidence levels</option>
          <option value="high">High confidence</option>
          <option value="medium">Moderate confidence</option>
          <option value="low">Low confidence</option>
        </select>

        {/* Category */}
        {categories.length > 0 && (
          <select
            value={filters.category}
            onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
            aria-label="Filter by category"
            className={sel}
          >
            <option value="all">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#64748B] hover:text-red-600 hover:border-red-200 transition"
            aria-label="Clear all filters"
          >
            <X size={12} /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PathComparison() {
  const location = useLocation();
  const navigate = useNavigate();

  // Initialise from URL so filters survive refresh
  const { sortBy: initSort, filters: initFilters } = filtersFromParams(location.search);

  const [paths, setPaths] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [missions, setMissions] = useState([]);
  const [proof, setProof] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [resumeTarget, setResumeTarget] = useState(null);

  const [sortBy, setSortByState] = useState(initSort);
  const [filters, setFiltersState] = useState(initFilters);

  // Keep URL in sync whenever sort/filter changes
  const setSortBy = useCallback((val) => {
    setSortByState(val);
  }, []);
  const setFilters = useCallback((updater) => {
    setFiltersState(updater);
  }, []);

  useEffect(() => {
    const qs = filtersToParams(sortBy, filters);
    const newSearch = qs ? `?${qs}` : '';
    if (location.search !== newSearch) {
      navigate({ search: newSearch }, { replace: true });
    }
  }, [sortBy, filters]);

  const load = async () => {
    const [ps, exps, mis, prf, cts, refs] = await Promise.all([
      base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []),
      base44.entities.Experiments.list('-created_date', 200).catch(() => []),
      base44.entities.Missions.list('-created_date', 200).catch(() => []),
      base44.entities.ProofOfWork.list('-created_date', 200).catch(() => []),
      base44.entities.OutreachContacts.list('-created_date', 200).catch(() => []),
      base44.entities.WeeklyReflections.list('-created_date', 200).catch(() => []),
    ]);
    setPaths(Array.isArray(ps) ? ps : []);
    setExperiments(Array.isArray(exps) ? exps : []);
    setMissions(Array.isArray(mis) ? mis : []);
    setProof(Array.isArray(prf) ? prf : []);
    setContacts(Array.isArray(cts) ? cts : []);
    setReflections(Array.isArray(refs) ? refs : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Derived: sorted then filtered — recomputed whenever sort, filters, or raw paths change
  const displayedPaths = useMemo(() => {
    const sorted = sortPaths(paths, sortBy);
    return filterPaths(sorted, filters);
  }, [paths, sortBy, filters]);

  const hasActiveFilters = Object.values(filters).some(v => v !== 'all');

  const handleAction = async (action, path) => {
    const today = new Date().toISOString().split('T')[0];

    if (action === 'edit') { setEditTarget(path); return; }
    if (action === 'resume') { setResumeTarget(path); return; }

    const updates = {
      make_primary: async () => {
        const primaries = paths.filter(p => p.is_primary_focus && p.id !== path.id);
        await Promise.all(primaries.map(p => base44.entities.PathRecommendations.update(p.id, { is_primary_focus: false })));
        await base44.entities.PathRecommendations.update(path.id, { is_primary_focus: true });
      },
      pause:    () => base44.entities.PathRecommendations.update(path.id, { status: 'paused',    paused_at: today,    is_primary_focus: false }),
      complete: () => base44.entities.PathRecommendations.update(path.id, { status: 'completed', completed_at: today, is_primary_focus: false }),
      archive:  () => base44.entities.PathRecommendations.update(path.id, { status: 'archived',  is_primary_focus: false }),
    };

    if (updates[action]) {
      await updates[action]();
      load();
    }
  };

  const cardProps = { experiments, missions, proof, contacts, reflections, onAction: handleAction };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      {showCreate && (
        <CreatePathModal
          existingRecommendations={paths}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
      {editTarget && (
        <EditPathModal
          path={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load(); }}
        />
      )}
      {resumeTarget && (
        <ReactivationModal
          path={resumeTarget}
          onClose={() => setResumeTarget(null)}
          onReactivated={() => { setResumeTarget(null); load(); }}
        />
      )}

      <PageHeader
        eyebrow="Paths"
        title="Your career paths."
        description="Explore multiple paths simultaneously. Test, pause, resume, and compare — none is permanent until you decide it is."
        action={
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white shrink-0"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
            <Plus size={16} /> Create Another Path
          </button>
        }
      />

      {loading ? (
        <div className="py-20 text-center text-[#64748B]">Loading your paths…</div>
      ) : paths.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#E2E8F0] p-16 text-center">
          <h3 className="font-heading text-xl font-bold text-[#050816]">No paths yet.</h3>
          <p className="mt-2 text-sm text-[#64748B]">Create your first path to start tracking experiments, reflections, and progress.</p>
          <button onClick={() => setShowCreate(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white"
            style={{ background: '#8B0C21' }}>
            <Plus size={16} /> Create a Path
          </button>
        </div>
      ) : (
        <>
          <RiskConfidenceLegend />

          <SortFilterBar
            paths={paths}
            sortBy={sortBy}
            setSortBy={setSortBy}
            filters={filters}
            setFilters={setFilters}
          />

          {/* Result count */}
          <p className="mb-4 text-xs text-[#94A3B8]">
            {displayedPaths.length} path{displayedPaths.length !== 1 ? 's' : ''} shown
            {paths.length !== displayedPaths.length ? ` of ${paths.length}` : ''}
          </p>

          {displayedPaths.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#E2E8F0] py-16 text-center">
              <p className="text-sm font-semibold text-[#050816]">No paths match these filters.</p>
              <p className="text-xs text-[#94A3B8] mt-1">Try adjusting your sort or filter options.</p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
              >
                <X size={12} /> Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedPaths.map(p => (
                <PathCard
                  key={p.id}
                  path={p}
                  {...cardProps}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                />
              ))}
            </div>
          )}

          <div className="mt-8 rounded-[20px] p-5 text-center text-sm text-[#64748B]"
            style={{ background: '#F8ECEF', border: '1px solid rgba(139,12,33,0.15)' }}>
            These paths are recommendations and tests — not permanent commitments. Your goal is to learn what fits you, not to pick one and stay forever.
          </div>
        </>
      )}
    </main>
  );
}