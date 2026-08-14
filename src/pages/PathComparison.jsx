import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Star, Pencil, Pause, Play, Archive, ArchiveRestore, ChevronDown, ChevronUp, Clock, CheckCircle2, History, ArrowRight, RotateCcw, SlidersHorizontal, X, Users, FlaskConical } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Sk, SkCards } from '@/components/PageSkeleton';
import CreatePathModal from '@/components/paths/CreatePathModal';
import EditPathModal from '@/components/paths/EditPathModal';
import ReactivationModal from '@/components/paths/ReactivationModal';
import PathRecoveryPanel from '@/components/paths/PathRecoveryPanel';
import FocusOverlay from '@/components/FocusOverlay';
import { loadOwnedPaths, authoritativeSet, loadOnboardingSubmission } from '@/lib/path-set';
import { selectPathForCycle } from '@/lib/career-cycle';
import { RiskBadge, ConfidenceBadge, RiskNotAssessed } from '@/components/paths/RiskConfidenceBadges';
import OutreachPlanModal from '@/components/outreach/OutreachPlanModal';
import { Search } from 'lucide-react';
import {
  SORT_OPTIONS, DEFAULT_FILTERS,
  sortPaths, filterPaths,
  filtersToParams, filtersFromParams,
  ACTIVE_STATUSES, PAUSED_STATUSES, HISTORY_STATUSES,
} from '@/lib/path-sort-filter';
import { autoAssessPathRisk } from '@/lib/risk-assessor';
import CareerHypothesisPanel from '@/components/paths/CareerHypothesisPanel';
import HypothesisCompareSummary from '@/components/paths/HypothesisCompareSummary';
import { deriveHypothesis, backfillHypotheses, syncFitDimensions, HYPOTHESIS_STATUS_LABELS, HYPOTHESIS_STATUS_MEANING } from '@/lib/career-hypothesis';
import { dimensionProgress, nextTestForPath } from '@/lib/dimension-progress';
import { loadMeasurements } from '@/lib/experiment-measurement';
import { characteristicSignals } from '@/lib/evidence-patterns';

const STATUS_CFG = {
  active:        { label: 'Active',         bg: 'var(--success-50)', text: 'var(--success-700)' },
  draft:         { label: 'Draft',          bg: 'var(--ink-100)', text: 'var(--ink-500)' },
  paused:        { label: 'Paused',         bg: 'var(--warning-50)', text: 'var(--warning-700)' },
  completed:     { label: 'Completed',      bg: 'var(--info-50)', text: 'var(--info-700)' },
  archived:      { label: 'Archived',       bg: 'var(--ink-100)', text: 'var(--ink-400)' },
  exploring:     { label: 'Exploring',      bg: 'var(--ink-100)', text: 'var(--brand-navy-700)' },
  deprioritized: { label: 'Deprioritized',  bg: 'var(--ink-100)', text: 'var(--ink-400)' },
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
    <div className="rounded-[var(--r-surface)] border-2 p-6 space-y-5" style={{ borderColor: 'rgba(180,83,9,0.3)', background: '#FFFDF7' }}>
      <div className="rounded-[var(--r-control)] p-4" style={{ background: 'var(--warning-50)', border: '1px solid rgba(180,83,9,0.2)' }}>
        <p className="tp-body font-bold text-[color:var(--warning-700)]">You previously explored this path.</p>
        {path.last_active_at && <p className="tp-meta text-[color:var(--ink-700)] mt-1">Last active: {fmtDate(path.last_active_at)}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-4 text-center">
        {[
          { label: 'Experiments', val: pathExps.length },
          { label: 'Missions done', val: missions.filter(m => pathExps.some(e => e.id === m.experiment_id) && m.status === 'completed').length },
          { label: 'Proof submitted', val: pathProof.length },
          { label: 'Contacts', val: pathContacts.length },
        ].map(({ label, val }) => (
          <div key={label} className="rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white p-3">
            <p className="font-heading text-2xl font-bold text-[color:var(--surface-dark-900)]">{val}</p>
            <p className="tp-meta text-[color:var(--ink-500)] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {completedExps.length > 0 && (
        <div>
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Completed experiments</p>
          <div className="space-y-1.5">
            {completedExps.map(e => (
              <div key={e.id} className="tp-body flex items-center gap-2">
                <CheckCircle2 size={13} className="text-green-600 shrink-0" />
                <span className="text-[color:var(--ink-700)]">{e.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pathReflections.length > 0 && (
        <p className="tp-meta text-[color:var(--ink-500)]">{pathReflections.length} reflection{pathReflections.length > 1 ? 's' : ''} saved on this path.</p>
      )}

      <div className="flex flex-wrap gap-3">
        <button onClick={onResume}
          className="touch-target flex items-center gap-2 rounded-[var(--r-control)] px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
          <RotateCcw size={14} /> Resume This Path
        </button>
        <button onClick={onArchive}
          className="flex items-center gap-2 rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
          <Archive size={14} /> Archive Path
        </button>
      </div>
    </div>
  );
}

// ── Path card ─────────────────────────────────────────────────────────────────
function PathCard({ path, experiments, missions, proof, contacts, reflections, profile, measurements, signals = [], onAction, expanded, onToggle, onBuildOutreachPlan, onAutoAssess, assessing }) {
  const cfg = statusCfg(path.status);
  const d = path.generated_detail || {};

  const pathExps = experiments.filter(e => e.path_name === path.path_name);
  const completedExps = pathExps.filter(e => e.status === 'completed');
  const pct = pathExps.length ? Math.round(completedExps.length / pathExps.length * 100) : 0;
  const isPausedOrCompleted = ['paused', 'completed'].includes(path.status);
  const hyp = deriveHypothesis(path, { experiments, proof, reflections, contacts, profile, measurements, signals });
  const progress = dimensionProgress({ hypothesis: hyp, signals });
  const nextTest = progress ? nextTestForPath({ path, hypothesis: hyp, progress }) : null;
  const statusLabel = HYPOTHESIS_STATUS_LABELS[hyp.hypothesis_status] || 'Untested';

  return (
    <div className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {path.is_primary_focus && (
                <span className="tp-meta rounded-full px-3 py-1 font-bold flex items-center gap-1.5" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>
                  <Star size={11} /> Primary Focus
                </span>
              )}
              <span className="tp-meta rounded-full px-3 py-1 font-bold" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
              {/* The hypothesis' own state, in the controlled vocabulary. */}
              <span className="tp-meta rounded-full px-3 py-1 font-bold" title={HYPOTHESIS_STATUS_MEANING[hyp.hypothesis_status] || ''}
                style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>
                {statusLabel}
              </span>
              {path.contrast_role && (
                <span className="tp-meta rounded-full px-3 py-1 font-semibold" style={{ background: 'var(--info-50)', color: 'var(--info-700)' }}>{path.contrast_role}</span>
              )}
              {path.risk_level ? <RiskBadge riskLevel={path.risk_level} /> : <RiskNotAssessed onAutoAssess={onAutoAssess} onAssess={() => onAction('edit', path)} assessing={assessing} />}
              {path.confidence_level && <ConfidenceBadge confidenceLevel={path.confidence_level} />}
            </div>
            <h2 className="tp-section text-[color:var(--surface-dark-900)]">{path.path_name}</h2>
            {path.path_category && <p className="tp-meta text-[color:var(--ink-400)] mt-1">{path.path_category}</p>}

            {/* The hypothesis headline: two separate numbers, never combined. */}
            <div className="tp-meta mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[color:var(--ink-500)]">
              <span>Current fit <strong className="text-[color:var(--surface-dark-900)]">{hyp.career_fit_score}%</strong></span>
              <span>Confidence in estimate <strong className="text-[color:var(--surface-dark-900)]">{hyp.fit_confidence_score}%</strong></span>
              <span>Experiments completed <strong className="text-[color:var(--surface-dark-900)]">{hyp.experiments_completed}</strong></span>
              <span>Evidence collected <strong className="text-[color:var(--surface-dark-900)]">{hyp.evidence_collected}</strong></span>
            </div>

            {/* The six things needed to compare hypotheses, same order every card. */}
            <HypothesisCompareSummary hypothesis={hyp} path={path} nextTest={nextTest} />

            {pathExps.length > 0 && (
              <div className="mt-3">
                <div className="tp-meta flex justify-between text-[color:var(--ink-400)] mb-1.5">
                  <span>Experiment progress</span>
                  <span>{completedExps.length}/{pathExps.length}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-[color:var(--ink-100)]">
                  <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: 'var(--brand-navy-900)' }} />
                </div>
              </div>
            )}

            {path.last_active_at && (
              <p className="tp-meta mt-2.5 text-[color:var(--ink-400)] flex items-center gap-1.5"><Clock size={11} /> Last active {fmtDate(path.last_active_at)}</p>
            )}
          </div>

          <button onClick={onToggle}
            className="tp-meta touch-target flex shrink-0 items-center gap-1.5 rounded-[var(--r-control)] border px-3 py-2 font-semibold transition"
            style={expanded
              ? { borderColor: 'var(--ink-200)', color: 'var(--ink-700)', background: 'white' }
              : { borderColor: 'var(--brand-navy-900)', color: 'var(--brand-navy-900)', background: 'white' }}>
            {expanded ? <>Close <ChevronUp size={14} /></> : <>Explore <ChevronDown size={14} /></>}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {/* The one primary action. Choosing a career is not what happens here;
              testing one is. */}
          <a href={`/experiments/new?pathId=${encodeURIComponent(path.id)}&pathName=${encodeURIComponent(path.path_name)}`}
            className="tp-meta touch-target flex items-center gap-1.5 rounded-[var(--r-control)] px-4 py-2 font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 6px 18px rgba(31,58,95,0.22)' }}>
            <FlaskConical size={12} /> Test This Hypothesis
          </a>
          <button onClick={onBuildOutreachPlan}
            className="tp-meta touch-target flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition"
            style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)', border: '1px solid var(--border-light)' }}>
            <Users size={12} /> Build Outreach Plan
          </button>
          <button onClick={() => onAction('edit', path)}
            className="tp-meta touch-target flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
            <Pencil size={12} /> Edit
          </button>
          {!path.is_primary_focus && ACTIVE_STATUSES.includes(path.status) && (
            <button onClick={() => onAction('make_primary', path)}
              className="tp-meta touch-target flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 font-semibold text-[color:var(--ink-700)] hover:bg-[#F8ECEF]">
              <Star size={12} /> Make Primary
            </button>
          )}
          {ACTIVE_STATUSES.includes(path.status) && (
            <button onClick={() => onAction('pause', path)}
              className="tp-meta touch-target flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
              <Pause size={12} /> Pause
            </button>
          )}
          {path.status === 'paused' && (
            <button onClick={() => onAction('resume', path)}
              className="tp-meta touch-target flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold text-white"
              style={{ background: 'var(--brand-navy-900)' }}>
              <Play size={12} /> Resume
            </button>
          )}
          {path.status !== 'archived' && path.status !== 'completed' && (
            <button onClick={() => onAction('complete', path)}
              className="tp-meta touch-target flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
              <CheckCircle2 size={12} /> Mark Complete
            </button>
          )}
          {path.status === 'completed' && (
            <button onClick={() => onAction('uncomplete', path)}
              className="tp-meta touch-target flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50 transition">
              <RotateCcw size={12} /> Mark Not Complete
            </button>
          )}
          {path.status !== 'archived' && (
            <button onClick={() => onAction('archive', path)}
              className="tp-meta touch-target flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 font-semibold text-[color:var(--ink-500)] hover:bg-[color:var(--ink-50)]">
              <Archive size={12} /> Archive
            </button>
          )}
          {path.status === 'archived' && (
            <button onClick={() => onAction('unarchive', path)}
              className="tp-meta touch-target flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--success-50)] hover:border-green-200 hover:text-green-700 transition">
              <ArchiveRestore size={12} /> Un-archive
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[color:var(--ink-200)] p-6 space-y-5">
          <CareerHypothesisPanel
            pathName={path.path_name}
            hypothesis={hyp}
            path={path}
            signals={signals}
          />

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
            <div className="rounded-[var(--r-control)] p-3" style={{ background: 'var(--warning-50)', border: '1px solid rgba(180,83,9,0.2)' }}>
              <p className="tp-eyebrow text-[color:var(--warning-700)] mb-1.5">Potential concern</p>
              <p className="tp-body text-[color:var(--ink-700)]">{path.why_it_may_not_fit || path.concern}</p>
            </div>
          )}

          {(path.lifestyle_implications || d.lifestyle) && (
            <div>
              <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Lifestyle</p>
              <p className="tp-body text-[color:var(--ink-700)]">{path.lifestyle_implications || d.lifestyle}</p>
            </div>
          )}

          {d.income_trajectory && (
            <div>
              <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Income trajectory</p>
              <p className="tp-body text-[color:var(--ink-700)]">{d.income_trajectory}</p>
            </div>
          )}

          {path.goals && (
            <div>
              <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Your goals</p>
              <p className="tp-body text-[color:var(--ink-700)]">{path.goals}</p>
            </div>
          )}

          {(path.skill_gaps?.length > 0 || path.current_gaps?.length > 0) && (
            <div>
              <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Skill gaps</p>
              <div className="flex flex-wrap gap-2">
                {(path.skill_gaps || path.current_gaps || []).map((g, i) => (
                  <span key={i} className="tp-meta rounded-full border border-[color:var(--ink-200)] px-3 py-1 text-[color:var(--ink-700)]">{g}</span>
                ))}
              </div>
            </div>
          )}

          {(path.first_experiment || d.day_to_day) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {path.first_experiment && (
                <div className="rounded-[var(--r-control)] p-4" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}>
                   <p className="tp-eyebrow mb-2" style={{ color: 'var(--brand-navy-900)' }}>Suggested first experiment</p>
                  <p className="tp-body text-[color:var(--ink-700)]">{path.first_experiment}</p>
                </div>
              )}
              {d.day_to_day && (
                <div>
                  <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Day-to-day reality</p>
                  <p className="tp-body text-[color:var(--ink-700)]">{d.day_to_day}</p>
                </div>
              )}
            </div>
          )}

          {path.notes && (
            <div>
              <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Notes</p>
              <p className="tp-body text-[color:var(--ink-700)]">{path.notes}</p>
            </div>
          )}

          <div>
            <p className="tp-eyebrow text-[color:var(--ink-500)] mb-3 flex items-center gap-1.5"><History size={12} /> Path history</p>
            <div className="space-y-1.5">
              {[
                path.created_date && { date: path.created_date, label: 'Path created' },
                path.started_at   && { date: path.started_at,   label: 'Became active' },
                path.paused_at    && { date: path.paused_at,    label: 'Paused' },
                path.completed_at && { date: path.completed_at, label: 'Completed' },
                path.last_active_at && path.status === 'active' && { date: path.last_active_at, label: 'Last active' },
              ].filter(Boolean).map((evt, i) => (
                <div key={i} className="tp-meta flex items-center gap-3 text-[color:var(--ink-500)]">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--brand-navy-900)' }} />
                  <span className="font-medium">{fmtDate(evt.date)}</span>
                  <span>{evt.label}</span>
                </div>
              ))}
              {pathExps.map(e => (
                <div key={e.id} className="tp-meta flex items-center gap-3 text-[color:var(--ink-400)]">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-[color:var(--ink-200)]" />
                  <span className="font-medium">{fmtDate(e.created_date)}</span>
                  <span>Experiment: {e.title}</span>
                  {e.status === 'completed' && <CheckCircle2 size={11} className="text-green-600" />}
                </div>
              ))}
            </div>
          </div>

          <a href={`/experiments/new?pathId=${encodeURIComponent(path.id)}&pathName=${encodeURIComponent(path.path_name)}`}
            className="inline-flex items-center gap-2 text-sm font-semibold transition hover:opacity-80"
            style={{ color: 'var(--brand-navy-900)' }}>
            Test This Hypothesis <ArrowRight size={15} />
          </a>
        </div>
      )}
    </div>
  );
}

// ── Sort + Filter bar ─────────────────────────────────────────────────────────
const sel = 'field-select rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white px-3 py-2 text-base md:text-sm text-[color:var(--ink-700)] focus:border-[color:var(--brand-navy-900)] focus:outline-none';

// A real select, because the iOS wheel picker beats anything we would build.
// The wrapper only exists to hold the chevron, which stands in for the platform
// arrow that clearing the native appearance takes away. See `.field-select`.
function FilterSelect({ children, ...props }) {
  return (
    <span className="relative inline-flex">
      <select {...props} className={sel}>{children}</select>
      <ChevronDown
        size={14}
        aria-hidden="true"
        className="field-select-chevron pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-400)]"
      />
    </span>
  );
}

function SortFilterBar({ paths, sortBy, setSortBy, filters, setFilters }) {
  const categories = useMemo(() => {
    const cats = [...new Set(paths.map(p => p.path_category).filter(Boolean))].sort();
    return cats;
  }, [paths]);

  const hasActiveFilters = Object.values(filters).some(v => v !== 'all');
  const activeCount = Object.values(filters).filter(v => v !== 'all').length;

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <div className="mb-5 rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <SlidersHorizontal size={14} className="text-[color:var(--ink-500)]" />
          <span className="tp-eyebrow text-[color:var(--ink-500)]">Sort & Filter</span>
          {hasActiveFilters && (
            <span className="tp-meta rounded-full px-2.5 py-0.5 font-bold" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-700)' }}>
              {activeCount} active
            </span>
          )}
        </div>

        {/* Sort */}
        <FilterSelect
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          aria-label="Sort paths by"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </FilterSelect>

        {/* Status group */}
        <FilterSelect
          value={filters.statusGroup}
          onChange={e => setFilters(f => ({ ...f, statusGroup: e.target.value }))}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="paused">Paused only</option>
          <option value="history">History</option>
        </FilterSelect>

        {/* Risk */}
        <FilterSelect
          value={filters.risk}
          onChange={e => setFilters(f => ({ ...f, risk: e.target.value }))}
          aria-label="Filter by risk level"
        >
          <option value="all">All risk levels</option>
          <option value="low">Low risk</option>
          <option value="medium">Moderate risk</option>
          <option value="high">High risk</option>
        </FilterSelect>

        {/* Confidence */}
        <FilterSelect
          value={filters.confidence}
          onChange={e => setFilters(f => ({ ...f, confidence: e.target.value }))}
          aria-label="Filter by confidence level"
        >
          <option value="all">All confidence levels</option>
          <option value="high">High confidence</option>
          <option value="medium">Moderate confidence</option>
          <option value="low">Low confidence</option>
        </FilterSelect>

        {/* Category */}
        {categories.length > 0 && (
          <FilterSelect
            value={filters.category}
            onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </FilterSelect>
        )}

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="tp-meta touch-target flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-2 font-semibold text-[color:var(--ink-500)] hover:text-red-600 hover:border-red-200 transition"
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
  const [profile, setProfile] = useState({});
  const [measurements, setMeasurements] = useState({});
  // Rated work characteristics, so each card can show which dimensions of that
  // career already have evidence.
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [activeSet, setActiveSet] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [resumeTarget, setResumeTarget] = useState(null);
  const [outreachPlanTarget, setOutreachPlanTarget] = useState(null);

  const [assessingIds, setAssessingIds] = useState(new Set());
  const [assessError, setAssessError] = useState('');
  const [sortBy, setSortByState] = useState(initSort);
  const [filters, setFiltersState] = useState(initFilters);
  const [search, setSearch] = useState('');

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
    // Paths come from the owner-scoped loader: it resolves auth first, keeps only
    // this student's records, and identifies the generated set they came from.
    // A read failure is surfaced, never mistaken for "no paths".
    let owned = null;
    try {
      owned = await loadOwnedPaths();
      setLoadFailed(false);
    } catch (e) {
      console.error('Failed to load paths:', e);
      setLoadFailed(true);
    }

    const [sub, exps, mis, prf, cts, refs, profs] = await Promise.all([
      loadOnboardingSubmission(),
      base44.entities.Experiments.list('-created_date', 200).catch(() => []),
      base44.entities.Missions.list('-created_date', 200).catch(() => []),
      base44.entities.ProofOfWork.list('-created_date', 200).catch(() => []),
      base44.entities.OutreachContacts.list('-created_date', 200).catch(() => []),
      base44.entities.WeeklyReflections.list('-created_date', 200).catch(() => []),
      base44.entities.StudentProfile.list('-created_date', 1).catch(() => []),
    ]);
    const studentProfile = (Array.isArray(profs) ? profs[0] : null) || {};
    setProfile(studentProfile);
    const ownedPaths = owned?.paths || [];
    setPaths(ownedPaths);
    setActiveSet(authoritativeSet(ownedPaths));
    setSubmission(sub);
    setExperiments(Array.isArray(exps) ? exps : []);
    setMissions(Array.isArray(mis) ? mis : []);
    setProof(Array.isArray(prf) ? prf : []);
    setContacts(Array.isArray(cts) ? cts : []);
    setReflections(Array.isArray(refs) ? refs : []);
    setLoading(false);

    // Paths created before the hypothesis fields existed get them filled in from
    // their own onboarding answers and activity. Nothing existing is changed.
    const measurements = await loadMeasurements().catch(() => ({}));
    setMeasurements(measurements);
    const ctx = {
      experiments: Array.isArray(exps) ? exps : [],
      proof: Array.isArray(prf) ? prf : [],
      reflections: Array.isArray(refs) ? refs : [],
      profile: studentProfile,
      measurements,
      signals: characteristicSignals({
        experiments: Array.isArray(exps) ? exps : [],
        measurements,
        reflections: Array.isArray(refs) ? refs : [],
      }),
    };
    setSignals(ctx.signals);
    const wrote = await backfillHypotheses(ownedPaths, ctx).catch(() => false);
    // Ability and enjoyment are stored as their own fields, so they stay
    // separate from the overall score and from each other.
    await syncFitDimensions(ownedPaths, ctx).catch(() => null);
    if (wrote) {
      const refreshed = await loadOwnedPaths().catch(() => null);
      if (refreshed?.paths) setPaths(refreshed.paths);
    }
  };

  useEffect(() => { load(); }, []);

  // Derived: sorted then filtered, recomputed whenever sort, filters, or raw paths change
  const displayedPaths = useMemo(() => {
    const sorted = sortPaths(paths, sortBy);
    const filtered = filterPaths(sorted, filters);
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(p =>
      p.path_name?.toLowerCase().includes(q) ||
      p.path_category?.toLowerCase().includes(q) ||
      p.fit_reason?.toLowerCase().includes(q) ||
      p.why_it_fits?.toLowerCase().includes(q)
    );
  }, [paths, sortBy, filters, search]);

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
        // The cycle records which path is being tested, so everything created
        // afterwards is filed against it.
        await selectPathForCycle(path);
      },
      pause:    () => base44.entities.PathRecommendations.update(path.id, { status: 'paused',    paused_at: today,    is_primary_focus: false }),
      complete: () => base44.entities.PathRecommendations.update(path.id, { status: 'completed', completed_at: today, is_primary_focus: false }),
      archive:    () => base44.entities.PathRecommendations.update(path.id, { status: 'archived',  is_primary_focus: false }),
      unarchive:  () => base44.entities.PathRecommendations.update(path.id, { status: 'exploring' }),
      uncomplete: () => base44.entities.PathRecommendations.update(path.id, { status: 'exploring', completed_at: null }),
    };

    if (updates[action]) {
      await updates[action]();
      load();
    }
  };

  const handleAutoAssess = async (path) => {
    setAssessingIds(prev => new Set([...prev, path.id]));
    setAssessError('');
    try {
      await autoAssessPathRisk(path);
      load();
    } catch (e) {
      // Without this the spinner just stopped and nothing changed, which reads
      // as the button doing nothing.
      console.error(`[paths] auto-assess failed (${e?.name || 'error'})`);
      setAssessError(e?.name === 'RiskAssessmentError'
        ? 'That assessment came back in a form we could not use, so nothing was changed. Try it again.'
        : 'We could not assess that path just now. Nothing was changed.');
    } finally {
      setAssessingIds(prev => { const next = new Set(prev); next.delete(path.id); return next; });
    }
  };

  const cardProps = { experiments, missions, proof, contacts, reflections, profile, measurements, signals, onAction: handleAction };

  return (
    <main className="app-page">
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
          onDeleted={() => { setEditTarget(null); load(); }}
        />
      )}
      {resumeTarget && (
        <ReactivationModal
          path={resumeTarget}
          onClose={() => setResumeTarget(null)}
          onReactivated={() => { setResumeTarget(null); load(); }}
        />
      )}
      {outreachPlanTarget && (
        <OutreachPlanModal
          path={outreachPlanTarget}
          onClose={() => setOutreachPlanTarget(null)}
          onContactSaved={() => {}}
        />
      )}
      {/* One path at a time: the comparison list stays behind, and clicking
          outside the panel returns to it. */}
      {expandedId && (() => {
        const p = paths.find(x => x.id === expandedId);
        if (!p) return null;
        return (
          <FocusOverlay onClose={() => setExpandedId(null)} label="Back to all paths">
            <PathCard
              path={p}
              {...cardProps}
              expanded
              onToggle={() => setExpandedId(null)}
              onBuildOutreachPlan={() => setOutreachPlanTarget(p)}
              onAutoAssess={() => handleAutoAssess(p)}
              assessing={assessingIds.has(p.id)}
            />
          </FocusOverlay>
        );
      })()}

      <PageHeader
        title="Your career hypotheses."
        description="A career hypothesis is a direction worth testing, not a prediction of what you should become. Compare them on what is known, what is still unknown, and how much evidence sits behind each one."
        action={
          <button onClick={() => setShowCreate(true)}
            className="touch-target flex items-center gap-2 rounded-[var(--r-control)] px-5 py-2.5 text-sm font-semibold text-white shrink-0"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            <Plus size={16} /> Add a Hypothesis
          </button>
        }
      />

      {assessError && (
        <div className="tp-body mb-4 flex items-start justify-between gap-3 rounded-[var(--r-control)] px-4 py-3"
          style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-700)', color: 'var(--warning-700)' }}>
          <span>{assessError}</span>
          <button onClick={() => setAssessError('')} className="shrink-0 font-semibold underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <>
          <Sk h={42} r={12} className="mb-4" />
          <Sk h={46} r={12} className="mb-5" />
          <SkCards count={3} h={210} r={24} />
        </>
      ) : loadFailed || (paths.length === 0 && submission) ? (
        // Onboarding was completed but no paths came back. Recoverable, never blank,
        // and never silently regenerated.
        <PathRecoveryPanel variant="missing" onRestored={load} />
      ) : paths.length === 0 ? (
        <div className="rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] p-16 text-center">
          <h3 className="tp-section text-[color:var(--surface-dark-900)]">No hypotheses yet.</h3>
          <p className="tp-body mt-2.5 text-[color:var(--ink-500)]">Add your first career hypothesis to start testing it and collecting evidence.</p>
          <button onClick={() => setShowCreate(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-[var(--r-control)] px-6 py-3 text-sm font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)' }}>
            <Plus size={16} /> Add a Hypothesis
          </button>
        </div>
      ) : (
        <>
          {activeSet && activeSet.paths.length < 3 && (
            <div className="mb-6">
              <PathRecoveryPanel variant="incomplete" existingCount={activeSet.paths.length} onRestored={load} />
            </div>
          )}

          {/* Search bar */}
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-400)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search hypotheses by name, category, or description…"
              className="w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white pl-9 pr-4 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)]">
                <X size={14} />
              </button>
            )}
          </div>

          <SortFilterBar
            paths={paths}
            sortBy={sortBy}
            setSortBy={setSortBy}
            filters={filters}
            setFilters={setFilters}
          />

          {/* Result count */}
          <p className="tp-meta mb-4 text-[color:var(--ink-400)]">
            {displayedPaths.length} hypothes{displayedPaths.length !== 1 ? 'es' : 'is'} shown
            {paths.length !== displayedPaths.length ? ` of ${paths.length}` : ''}
          </p>

          {displayedPaths.length === 0 ? (
            <div className="rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] py-16 text-center">
              <p className="tp-body font-semibold text-[color:var(--surface-dark-900)]">No hypotheses match these filters.</p>
              <p className="tp-meta text-[color:var(--ink-400)] mt-1.5">Try adjusting your sort or filter options.</p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="tp-meta mt-4 inline-flex items-center gap-1.5 rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-4 py-2 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]"
              >
                <X size={12} /> Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {displayedPaths.map(p => (
                <PathCard
                  key={p.id}
                  path={p}
                  {...cardProps}
                  expanded={false}
                  onToggle={() => setExpandedId(p.id)}
                  onBuildOutreachPlan={() => setOutreachPlanTarget(p)}
                  onAutoAssess={() => handleAutoAssess(p)}
                  assessing={assessingIds.has(p.id)}
                />
              ))}
            </div>
          )}

          <div className="tp-body mt-8 rounded-[var(--r-surface)] p-5 text-center text-[color:var(--ink-500)]"
            style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}>
            These are hypotheses to test, not commitments to make. A hypothesis you rule out is as useful as one you strengthen.
          </div>
        </>
      )}
    </main>
  );
}