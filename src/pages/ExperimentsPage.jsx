import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, ChevronDown, ChevronUp, Clock, BookOpen, Target, FileText, Calendar, Trash2, Users, Wand2, PauseCircle, Play, Search } from 'lucide-react';
import MissionGuideGenerator from '@/components/experiments/MissionGuideGenerator';
import MissionGuideHistory from '@/components/experiments/MissionGuideHistory';
import OutreachPlanModal from '@/components/outreach/OutreachPlanModal';
import AddToCalendarModal from '@/components/calendar/AddToCalendarModal';
import { toText, STEP_TEXT_KEYS } from '@/lib/ai-validation';
import PageHeader from '@/components/PageHeader';
import { Sk, SkPills, SkCards } from '@/components/PageSkeleton';
import AddMissionModal from '@/components/experiments/AddMissionModal';
import AddProofModal, { ProofSuccessToast } from '@/components/experiments/AddProofModal';
import PathSwitcher from '@/components/PathSwitcher';
import SoftDeleteConfirm, { softDeletePayload } from '@/components/SoftDeleteConfirm';
import ExperimentActionsMenu from '@/components/experiments/ExperimentActionsMenu';
import ResumeExperimentModal from '@/components/experiments/ResumeExperimentModal';

const STATUS_STYLES = {
  planned:     { bg: 'var(--ink-100)', text: 'var(--ink-700)', label: 'Planned' },
  in_progress: { bg: 'var(--warning-50)', text: 'var(--warning-700)', label: 'In Progress' },
  completed:   { bg: 'var(--success-50)', text: 'var(--success-700)', label: 'Completed' },
  skipped:     { bg: 'var(--ink-50)', text: 'var(--ink-400)', label: 'Skipped' },
  paused:      { bg: 'var(--warning-50)', text: 'var(--warning-700)', label: 'Paused' },
};

// The 'active' filter chip means "not yet finished", not "not paused" (see allActive).
const NON_TERMINAL_STATUSES = ['draft', 'planned', 'in_progress'];

const EXPERIMENT_TYPES = [
  'Interview a professional', 'Complete a virtual simulation', 'Build a small project',
  'Publish content (article, post, or video)', 'Attend a relevant event',
  'Apply to a short-term project', 'Test a freelance service', 'Interview a founder',
  'Build a portfolio sample', 'Complete a skills workshop', 'Volunteer for a relevant role',
  'Complete a research project',
];

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Path dropdown for New Experiment form ─────────────────────────────────────
function PathDropdown({ paths, value, onChange, error }) {
  const [search, setSearch] = useState('');

  const eligible = paths.filter(p =>
    !['archived', 'deprioritized'].includes(p.status) &&
    (!search || p.path_name.toLowerCase().includes(search.toLowerCase()))
  );

  const primaryPath = paths.find(p => p.is_primary_focus && !['archived', 'deprioritized'].includes(p.status));

  if (paths.filter(p => !['archived', 'deprioritized'].includes(p.status)).length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-4 text-center">
        <p className="text-sm font-semibold text-[color:var(--ink-700)] mb-1">No paths available</p>
        <p className="text-xs text-[color:var(--ink-500)]">You need to create or activate a path before creating an experiment.</p>
        <div className="mt-3 flex gap-2 justify-center flex-wrap">
          <a href="/paths" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>Create a Path</a>
          <a href="/paths" className="rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-700)]">View Path Recommendations</a>
        </div>
      </div>
    );
  }

  const statusLabel = (s) => {
    const map = { active: 'Active', exploring: 'Exploring', draft: 'Draft', paused: 'Paused', completed: 'Completed' };
    return map[s] || s;
  };

  return (
    <div>
      {eligible.length > 4 && (
        <div className="relative mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-400)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search paths..."
            className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] pl-8 pr-4 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
          />
        </div>
      )}
      <select
        className={`w-full rounded-xl border bg-[color:var(--page-surface)] px-4 py-3 text-sm outline-none focus:border-[color:var(--brand-navy-900)] ${error ? 'border-red-400' : 'border-[color:var(--ink-200)]'}`}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Select the path this experiment is testing…</option>
        {eligible.map(p => (
          <option key={p.id} value={p.path_name}>
            {p.path_name}
            {p.path_category ? ` · ${p.path_category}` : ''}
            {` · ${statusLabel(p.status)}`}
            {p.is_primary_focus ? ' · Primary Focus' : ''}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">Select the path this experiment is testing.</p>}
    </div>
  );
}

// ── Mission row inside expanded card ──────────────────────────────────────────
function MissionRow({ mission, experiment, onProofAdded, onDeleted }) {
  const [showProof, setShowProof] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const s = STATUS_STYLES[mission.status] || STATUS_STYLES.planned;

  const handleSoftDelete = async () => {
    const user = await base44.auth.me();
    await base44.entities.Missions.update(mission.id, softDeletePayload(user.id));
    setConfirmDelete(false);
    onDeleted(mission.id);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3">
      {confirmDelete && (
        <SoftDeleteConfirm
          itemName={mission.title}
          onConfirm={handleSoftDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {showProof && (
        <AddProofModal
          mission={mission}
          experiment={experiment}
          onClose={() => setShowProof(false)}
          onSaved={(proof) => { setShowProof(false); onProofAdded(proof, mission.title); }}
        />
      )}
      {showCal && (
        <AddToCalendarModal
          item={mission}
          itemType="mission"
          onClose={() => setShowCal(false)}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: s.bg, color: s.text }}>{s.label}</span>
          <span className="text-sm font-semibold text-[color:var(--surface-dark-900)] truncate">{mission.title}</span>
        </div>
        {mission.objective && <p className="mt-0.5 text-xs text-[color:var(--ink-500)] line-clamp-1">{mission.objective}</p>}
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => setShowCal(true)} className="flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-700)] hover:bg-white transition">
          <Calendar size={12} /> Add to Calendar
        </button>
        <button onClick={() => setShowProof(true)} className="flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-700)] hover:bg-white transition">
          <FileText size={12} /> Add Proof
        </button>
        <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-2 py-1.5 text-xs text-red-300 hover:text-red-500 hover:border-red-200 transition" title="Delete mission">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Missions section inside expanded card ─────────────────────────────────────
function MissionsSection({ experiment, missions, loadingMissions, onMissionAdded, onProofAdded, onMissionDeleted }) {
  const [showAdd, setShowAdd] = useState(false);
  const hasMissions = missions.length > 0;

  return (
    <div className="border-t border-[color:var(--ink-200)] pt-4">
      {showAdd && (
        <AddMissionModal
          experiment={experiment}
          onClose={() => setShowAdd(false)}
          onSaved={(m) => { setShowAdd(false); onMissionAdded(m); }}
        />
      )}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)]">
          Missions {hasMissions ? `(${missions.length})` : ''}
        </p>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-px"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 4px 12px rgba(31,58,95,0.25)' }}>
          <Plus size={12} /> {hasMissions ? 'Add Another Mission' : 'Add Mission'}
        </button>
      </div>
      {loadingMissions ? (
        <SkCards count={2} h={54} gap={8} r={12} />
      ) : hasMissions ? (
        <div className="space-y-2">
          {missions.map(m => (
            <MissionRow key={m.id} mission={m} experiment={experiment} onProofAdded={onProofAdded} onDeleted={onMissionDeleted} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-[color:var(--ink-400)] italic">No missions yet. Add one to track progress and submit proof.</p>
      )}
    </div>
  );
}

// ── Experiment card ───────────────────────────────────────────────────────────
function ExperimentCard({ exp, onStatusChange, onExpand, expanded, missions, loadingMissions, onMissionAdded, onProofAdded, onMissionDeleted, onDelete, onEdited, onFindPeople, paths, guides, onGenerateGuide, onGuideSetActive, onGuideDeleted, onGuideDuplicated, onGuideRenamed, onPaused, onResumed }) {
  const s = STATUS_STYLES[exp.status] || STATUS_STYLES.planned;
  const hasGuides = guides && guides.length > 0;
  const activeGuide = guides?.find(g => g.is_active);
  const isPaused = exp.status === 'paused';

  return (
    <div className={`rounded-[20px] border bg-white overflow-hidden ${isPaused ? 'border-amber-200' : 'border-[color:var(--ink-200)]'}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: s.bg, color: s.text }}>{s.label}</span>
              {exp.path_name && <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}>{exp.path_name}</span>}
              {isPaused && exp.paused_at && (
                <span className="text-xs text-[color:var(--ink-400)]">Paused {fmtDate(exp.paused_at)}</span>
              )}
            </div>
            <h3 className="font-heading font-bold text-[color:var(--surface-dark-900)]">{exp.title}</h3>
            <p className="mt-1 text-sm text-[color:var(--ink-700)]">{exp.objective}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ExperimentActionsMenu
              exp={exp}
              onDeleted={onDelete}
              onPaused={(id, status, updated) => onPaused(id, updated)}
              onResumed={onResumed}
              onEdited={onEdited}
            />
            <button onClick={onExpand} className="rounded-xl border border-[color:var(--ink-200)] p-2 hover:bg-[color:var(--ink-50)]">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-[color:var(--ink-500)] flex-wrap">
          {exp.estimated_hours && <span className="flex items-center gap-1"><Clock size={12} /> ~{exp.estimated_hours}h</span>}
          {exp.deadline && <span>Due {new Date(exp.deadline).toLocaleDateString()}</span>}
          {exp.deliverable && <span className="flex items-center gap-1"><BookOpen size={12} /> {exp.deliverable}</span>}
          {!expanded && missions.length > 0 && (
            <span className="flex items-center gap-1"><Target size={12} /> {missions.length} mission{missions.length > 1 ? 's' : ''}</span>
          )}
          {!expanded && guides && guides.length > 0 && (
            <span className="flex items-center gap-1"><Wand2 size={12} /> {guides.length} guide{guides.length > 1 ? 's' : ''}</span>
          )}
          {!isPaused && (
            <button onClick={onFindPeople}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition"
              style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)', border: '1px solid var(--border-light)' }}>
              <Users size={11} /> Find People to Learn From
            </button>
          )}
          {isPaused && (
            <button onClick={() => onResumed(exp)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold text-white transition"
              style={{ background: 'var(--success-700)' }}>
              <Play size={11} /> Resume Experiment
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[color:var(--ink-200)] p-5 space-y-4">
          {isPaused && (
            <div className="rounded-xl p-3 flex items-start gap-3" style={{ background: 'var(--warning-50)', border: '1px solid rgba(180,83,9,0.2)' }}>
              <PauseCircle size={16} className="text-[color:var(--warning-700)] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[color:var(--warning-700)]">This experiment is paused</p>
                {exp.pause_reason && <p className="text-xs text-[color:var(--ink-700)] mt-0.5">{exp.pause_reason}</p>}
                {exp.paused_at && <p className="text-xs text-[color:var(--ink-400)] mt-0.5">Paused on {fmtDate(exp.paused_at)}</p>}
                <button onClick={() => onResumed(exp)}
                  className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: 'var(--success-700)' }}>
                  <Play size={11} /> Resume Experiment
                </button>
              </div>
            </div>
          )}

          {exp.expected_learning && (
            <div><p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-1">Expected learning</p><p className="text-sm text-[color:var(--ink-700)]">{exp.expected_learning}</p></div>
          )}
          {exp.mission_steps?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-2">Mission steps</p>
              <ol className="space-y-2">
                {exp.mission_steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[color:var(--ink-700)]">
                    <span className="shrink-0 font-bold" style={{ color: 'var(--brand-navy-900)' }}>{i + 1}.</span>
                    <span>{toText(step, STEP_TEXT_KEYS)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {exp.proof_required && (
            <div className="rounded-xl p-3" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--brand-navy-900)' }}>Proof required</p>
              <p className="text-sm text-[color:var(--ink-700)]">{exp.proof_required}</p>
            </div>
          )}
          {exp.reflection_questions?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-2">Reflection questions</p>
              <ul className="space-y-1">{exp.reflection_questions.map((q, i) => <li key={i} className="text-sm text-[color:var(--ink-700)]">· {q}</li>)}</ul>
            </div>
          )}

          {/* Status buttons — hide pause/resume here, handled by actions menu */}
          {!isPaused && (
            <div className="flex gap-2 flex-wrap">
              {['planned', 'in_progress', 'completed', 'skipped'].map(st => (
                <button key={st} onClick={() => onStatusChange(exp.id, st)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition border"
                  style={exp.status === st ? { background: 'var(--brand-navy-900)', color: '#fff', borderColor: 'var(--brand-navy-900)' } : { background: 'white', color: 'var(--ink-700)', borderColor: 'var(--ink-200)' }}>
                  {STATUS_STYLES[st].label}
                </button>
              ))}
            </div>
          )}

          {/* Mission Guide */}
          <div className="border-t border-[color:var(--ink-200)] pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] flex items-center gap-1.5">
                <Wand2 size={12} /> Mission Guide
                {activeGuide && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}>Active: v{activeGuide.version_number}</span>}
              </p>
              <button onClick={onGenerateGuide}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-px"
                style={{ background: 'var(--brand-navy-900)', boxShadow: '0 4px 12px rgba(31,58,95,0.25)' }}>
                <Wand2 size={11} />
                {hasGuides ? 'Generate Another Mission Guide' : 'Generate Mission Guide'}
              </button>
            </div>
            {hasGuides ? (
              <MissionGuideHistory
                guides={guides}
                onSetActive={onGuideSetActive}
                onDeleted={onGuideDeleted}
                onDuplicated={onGuideDuplicated}
                onRenamed={onGuideRenamed}
                onGenerateAnother={onGenerateGuide}
              />
            ) : (
              <p className="text-xs text-[color:var(--ink-400)] italic">No guides yet. Generate one to get step-by-step instructions.</p>
            )}
          </div>

          {/* Missions */}
          <MissionsSection
            experiment={exp}
            missions={missions}
            loadingMissions={loadingMissions}
            onMissionAdded={onMissionAdded}
            onProofAdded={onProofAdded}
            onMissionDeleted={onMissionDeleted}
          />
        </div>
      )}
    </div>
  );
}

// ── Paused experiments section ────────────────────────────────────────────────
function PausedSection({ experiments, missions, guides, onResumed, onDelete, onEdited }) {
  const [expandedId, setExpandedId] = useState(null);
  const [open, setOpen] = useState(true);

  if (experiments.length === 0) {
    return (
      <div className="mb-8">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 mb-3">
          <PauseCircle size={15} className="text-[color:var(--warning-700)]" />
          <h2 className="font-heading text-base font-bold text-[color:var(--surface-dark-900)]">Paused</h2>
          {open ? <ChevronUp size={14} className="text-[color:var(--ink-400)]" /> : <ChevronDown size={14} className="text-[color:var(--ink-400)]" />}
        </button>
        {open && (
          <div className="rounded-[16px] border border-dashed border-amber-200 bg-amber-50/40 p-6 text-center">
            <p className="text-sm font-semibold text-[color:var(--ink-700)]">No paused experiments.</p>
            <p className="text-xs text-[color:var(--ink-400)] mt-1">Experiments you pause will appear here so you can return to them later.</p>
          </div>
        )}
      </div>
    );
  }

  const completedCount = (expId) => (missions[expId] || []).filter(m => m.status === 'completed').length;
  const totalCount = (expId) => (missions[expId] || []).length;

  return (
    <div className="mb-8">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 mb-3">
        <PauseCircle size={15} className="text-[color:var(--warning-700)]" />
        <h2 className="font-heading text-base font-bold text-[color:var(--surface-dark-900)]">Paused</h2>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }}>{experiments.length}</span>
        {open ? <ChevronUp size={14} className="text-[color:var(--ink-400)]" /> : <ChevronDown size={14} className="text-[color:var(--ink-400)]" />}
      </button>
      {open && (
        <div className="space-y-3">
          {experiments.map(exp => {
            const isExpanded = expandedId === exp.id;
            const expMissions = missions[exp.id] || [];
            const expGuides = guides[exp.id] || [];
            const activeGuide = expGuides.find(g => g.is_active);
            const s = STATUS_STYLES.paused;
            return (
              <div key={exp.id} className="rounded-[20px] border border-amber-200 bg-white overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="rounded-full px-2.5 py-1 text-xs font-bold flex items-center gap-1" style={{ background: s.bg, color: s.text }}>
                          <PauseCircle size={10} /> {s.label}
                        </span>
                        {exp.path_name && <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}>{exp.path_name}</span>}
                      </div>
                      <h3 className="font-heading font-bold text-[color:var(--surface-dark-900)]">{exp.title}</h3>
                      <p className="mt-1 text-sm text-[color:var(--ink-700)] line-clamp-2">{exp.objective}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[color:var(--ink-400)]">
                        {exp.paused_at && <span className="flex items-center gap-1"><PauseCircle size={11} /> Paused {fmtDate(exp.paused_at)}</span>}
                        {totalCount(exp.id) > 0 && <span><Target size={11} className="inline mr-0.5" />{completedCount(exp.id)}/{totalCount(exp.id)} missions done</span>}
                        {activeGuide && <span className="flex items-center gap-1"><Wand2 size={11} /> Guide v{activeGuide.version_number}</span>}
                      </div>
                      {exp.pause_reason && <p className="mt-1 text-xs text-[color:var(--ink-500)] italic">"{exp.pause_reason}"</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ExperimentActionsMenu
                        exp={exp}
                        onDeleted={onDelete}
                        onPaused={() => {}}
                        onResumed={onResumed}
                        onEdited={onEdited}
                      />
                      <button onClick={() => setExpandedId(isExpanded ? null : exp.id)} className="rounded-xl border border-[color:var(--ink-200)] p-2 hover:bg-[color:var(--ink-50)]">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button onClick={() => onResumed(exp)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition"
                      style={{ background: 'var(--success-700)' }}>
                      <Play size={12} /> Resume Experiment
                    </button>
                    <button onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-2 text-xs font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition">
                      View Details
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-amber-100 p-5 space-y-3">
                    {exp.proof_required && (
                      <div><p className="text-xs font-bold text-[color:var(--ink-500)] uppercase tracking-wide mb-1">Proof required</p><p className="text-sm text-[color:var(--ink-700)]">{exp.proof_required}</p></div>
                    )}
                    {expMissions.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-2">Missions ({expMissions.length})</p>
                        <div className="space-y-1.5">
                          {expMissions.map(m => {
                            const ms = STATUS_STYLES[m.status] || STATUS_STYLES.planned;
                            return (
                              <div key={m.id} className="flex items-center gap-2 rounded-lg border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-3 py-2">
                                <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: ms.bg, color: ms.text }}>{ms.label}</span>
                                <span className="text-sm text-[color:var(--ink-700)]">{m.title}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {expGuides.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-1">Mission Guides ({expGuides.length})</p>
                        {expGuides.map(g => (
                          <div key={g.id} className="flex items-center gap-2 text-xs text-[color:var(--ink-700)]">
                            <Wand2 size={11} style={{ color: 'var(--brand-navy-700)' }} />
                            <span>{g.guide_title} (v{g.version_number})</span>
                            {g.is_active && <span className="rounded-full px-1.5 py-0.5 font-bold" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}>Active</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── New experiment modal ──────────────────────────────────────────────────────
function NewExperimentModal({ onClose, onSave, paths }) {
  const [data, setData] = useState({ title: '', objective: '', path_name: '', path_id: '', estimated_hours: 3, deliverable: '', experiment_type: '' });
  const [saving, setSaving] = useState(false);
  const [pathError, setPathError] = useState(false);
  const submittingRef = useRef(false);

  // Preselect primary or single active path
  useEffect(() => {
    const eligible = paths.filter(p => !['archived', 'deprioritized'].includes(p.status));
    const primary = eligible.find(p => p.is_primary_focus);
    const preselect = primary || (eligible.length === 1 ? eligible[0] : null);
    if (preselect) {
      setData(d => ({ ...d, path_name: preselect.path_name, path_id: preselect.id }));
    }
  }, []);

  const handlePathChange = (pathName) => {
    const matched = paths.find(p => p.path_name === pathName);
    setData(d => ({ ...d, path_name: pathName, path_id: matched ? matched.id : '' }));
    setPathError(false);
  };

  const handleSave = async () => {
    if (!data.path_name) { setPathError(true); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try { await onSave(data); } finally { setSaving(false); submittingRef.current = false; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-bold text-[color:var(--surface-dark-900)] mb-1">New Experiment</h2>
        <p className="text-sm text-[color:var(--ink-500)] mb-6">Define what you want to test. Open the experiment after saving to generate a Mission Guide.</p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-[color:var(--ink-700)] block mb-1">Choose an experiment type</label>
            <select className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
              value={data.experiment_type} onChange={e => setData(d => ({ ...d, experiment_type: e.target.value, title: d.title || e.target.value }))}>
              <option value="">Select or type your own below</option>
              {EXPERIMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-[color:var(--ink-700)] block mb-1">Experiment title</span>
            <input className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
              placeholder="e.g. Interview 3 investment bankers" value={data.title || ''} onChange={e => setData(d => ({ ...d, title: e.target.value }))} />
          </label>

          <div>
            <label className="text-sm font-semibold text-[color:var(--ink-700)] block mb-1">Path being tested <span className="text-red-500">*</span></label>
            <PathDropdown paths={paths} value={data.path_name} onChange={handlePathChange} error={pathError} />
          </div>

          {[
            { name: 'objective', label: 'What do you want to learn?', placeholder: 'What question are you trying to answer?' },
            { name: 'deliverable', label: 'Deliverable', placeholder: 'What will you produce or submit?' },
          ].map(f => (
            <label key={f.name} className="block">
              <span className="text-sm font-semibold text-[color:var(--ink-700)] block mb-1">{f.label}</span>
              <input className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
                placeholder={f.placeholder} value={data[f.name] || ''} onChange={e => setData(d => ({ ...d, [f.name]: e.target.value }))} />
            </label>
          ))}
          <label className="block">
            <span className="text-sm font-semibold text-[color:var(--ink-700)] block mb-1">Deadline</span>
            <input type="date" className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
              value={data.deadline || ''} onChange={e => setData(d => ({ ...d, deadline: e.target.value }))} />
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-3 text-sm font-semibold text-[color:var(--ink-700)] transition hover:bg-[color:var(--ink-50)]">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-60"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            {saving ? 'Saving...' : 'Save Experiment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, count, color = 'var(--ink-700)' }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="font-heading text-base font-bold" style={{ color }}>{label}</h2>
      {count > 0 && (
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-[color:var(--ink-100)] text-[color:var(--ink-500)]">{count}</span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExperimentsPage() {
  const navigate = useNavigate();
  const [paths, setPaths] = useState([]);
  const [selectedPathId, setSelectedPathId] = useState('all');
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('active'); // 'active' | 'completed' | 'skipped' | 'all'
  const [missionsMap, setMissionsMap] = useState({});
  const [loadingMissionsFor, setLoadingMissionsFor] = useState(null);
  const [guidesMap, setGuidesMap] = useState({});
  const [showGuideGeneratorFor, setShowGuideGeneratorFor] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const toastTimer = useRef(null);
  const [outreachPlanTarget, setOutreachPlanTarget] = useState(null);
  const [resumeTarget, setResumeTarget] = useState(null); // experiment to resume

  const load = async () => {
    const [data, ps] = await Promise.all([
      base44.entities.Experiments.list('-created_date', 100).catch(() => []),
      base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []),
    ]);
    setExperiments(Array.isArray(data) ? data.filter(e => !e.deletion_status || e.deletion_status === 'active') : []);
    setPaths(Array.isArray(ps) ? ps : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadMissionsForExp = useCallback(async (expId) => {
    if (missionsMap[expId] !== undefined) return;
    setLoadingMissionsFor(expId);
    const ms = await base44.entities.Missions.filter({ experiment_id: expId }, '-created_date', 50);
    const active = (ms || []).filter(m => !m.deletion_status || m.deletion_status === 'active');
    setMissionsMap(prev => ({ ...prev, [expId]: active }));
    setLoadingMissionsFor(null);
  }, [missionsMap]);

  const loadGuidesForExp = useCallback(async (expId) => {
    const gs = await base44.entities.MissionGuides.filter({ experiment_id: expId }, '-version_number', 50).catch(() => []);
    const active = (gs || []).filter(g => !g.deletion_status || g.deletion_status === 'active');
    setGuidesMap(prev => ({ ...prev, [expId]: active }));
  }, []);

  const handleExpand = (expId) => {
    const next = expandedId === expId ? null : expId;
    setExpandedId(next);
    if (next) { loadMissionsForExp(next); loadGuidesForExp(next); }
  };

  // Deep link: /experiments?experimentId=… opens that experiment directly
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current || !experiments.length) return;
    const target = new URLSearchParams(window.location.search).get('experimentId');
    if (!target || !experiments.some(e => e.id === target)) return;
    deepLinkedRef.current = true;
    setFilter('all');
    handleExpand(target);
  }, [experiments]);

  // Load missions/guides for all paused experiments upfront so the paused section has data
  const pausedExps = experiments.filter(e => e.status === 'paused');
  useEffect(() => {
    pausedExps.forEach(e => {
      if (missionsMap[e.id] === undefined) loadMissionsForExp(e.id);
      if (guidesMap[e.id] === undefined) loadGuidesForExp(e.id);
    });
  }, [experiments]);

  const save = async (data) => {
    await base44.entities.Experiments.create({ ...data, status: 'planned' });
    setShowNew(false);
    load();
  };

  const updateStatus = async (id, status) => {
    await base44.entities.Experiments.update(id, { status });
    setExperiments(prev => prev.map(e => e.id === id ? { ...e, status } : e));
  };

  const handleMissionAdded = (expId, mission) => {
    setMissionsMap(prev => ({ ...prev, [expId]: [...(prev[expId] || []), mission] }));
  };

  const handleMissionDeleted = (expId, missionId) => {
    setMissionsMap(prev => ({ ...prev, [expId]: (prev[expId] || []).filter(m => m.id !== missionId) }));
  };

  const handleExperimentDeleted = (expId) => {
    setExperiments(prev => prev.filter(e => e.id !== expId));
    if (expandedId === expId) setExpandedId(null);
  };

  const handleExperimentEdited = (updated) => {
    setExperiments(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
  };

  const handlePaused = (expId, updatedExp) => {
    setExperiments(prev => prev.map(e => e.id === expId ? { ...e, ...updatedExp } : e));
    if (expandedId === expId) setExpandedId(null);
    // Ensure missions/guides are loaded for the paused section
    loadMissionsForExp(expId);
    loadGuidesForExp(expId);
  };

  const handleResumed = (updatedExp) => {
    setExperiments(prev => prev.map(e => e.id === updatedExp.id ? { ...e, ...updatedExp } : e));
    setResumeTarget(null);
  };

  // deactivatedIds is the guides the generator actually retired in the database,
  // not the ones it meant to. Assuming every active guide was retired put this
  // map out of step with the database whenever one of those writes failed.
  const handleGuideGenerated = (expId, newGuide, makeActive, deactivatedIds = []) => {
    const retired = new Set(deactivatedIds);
    setGuidesMap(prev => {
      const existing = (prev[expId] || []).map(g =>
        retired.has(g.id) ? { ...g, is_active: false, status: 'inactive' } : g
      );
      return { ...prev, [expId]: [...existing, newGuide] };
    });
    setShowGuideGeneratorFor(null);
  };

  const handleGuideSetActive = (expId, guide) => {
    setGuidesMap(prev => ({
      ...prev,
      [expId]: (prev[expId] || []).map(g =>
        g.id === guide.id
          ? { ...g, is_active: true, status: 'active' }
          : { ...g, is_active: false, status: g.status === 'active' ? 'inactive' : g.status }
      ),
    }));
  };

  const handleGuideDeleted = (expId, guideId) => {
    setGuidesMap(prev => ({ ...prev, [expId]: (prev[expId] || []).filter(g => g.id !== guideId) }));
  };

  const handleGuideDuplicated = (expId, newGuide) => {
    setGuidesMap(prev => ({ ...prev, [expId]: [...(prev[expId] || []), newGuide] }));
  };

  const handleGuideRenamed = (expId, updatedGuide) => {
    setGuidesMap(prev => ({
      ...prev,
      [expId]: (prev[expId] || []).map(g => g.id === updatedGuide.id ? { ...g, guide_title: updatedGuide.guide_title } : g),
    }));
  };

  const handleProofAdded = (proof, missionTitle) => {
    setSuccessToast({ proof, missionTitle });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSuccessToast(null), 8000);
  };

  const selectedPath = selectedPathId === 'all' ? null : paths.find(p => p.id === selectedPathId);

  // Split active (non-paused) vs paused
  const allActive = experiments.filter(e => e.status !== 'paused');
  const allPaused = experiments.filter(e => e.status === 'paused');

  const pathFiltered = (list) => selectedPath
    ? list.filter(e => e.path_name === selectedPath.path_name)
    : list;

  const activeFiltered = filter === 'all'
    ? pathFiltered(allActive)
    : filter === 'active'
      ? pathFiltered(allActive.filter(e => NON_TERMINAL_STATUSES.includes(e.status)))
      : pathFiltered(allActive.filter(e => e.status === filter));

  const pausedFiltered = pathFiltered(allPaused);

  const sharedCardProps = (exp) => ({
    exp,
    expanded: expandedId === exp.id,
    onExpand: () => handleExpand(exp.id),
    onStatusChange: updateStatus,
    missions: missionsMap[exp.id] || [],
    loadingMissions: loadingMissionsFor === exp.id,
    onMissionAdded: (m) => handleMissionAdded(exp.id, m),
    onProofAdded: handleProofAdded,
    onMissionDeleted: (missionId) => handleMissionDeleted(exp.id, missionId),
    onDelete: handleExperimentDeleted,
    onEdited: handleExperimentEdited,
    paths,
    onFindPeople: () => {
      const matchedPath = paths.find(p => p.path_name === exp.path_name);
      setOutreachPlanTarget({ exp, path: matchedPath || { path_name: exp.path_name || 'This Path' } });
    },
    guides: guidesMap[exp.id] || [],
    onGenerateGuide: () => setShowGuideGeneratorFor(exp.id),
    onGuideSetActive: (guide) => handleGuideSetActive(exp.id, guide),
    onGuideDeleted: (guideId) => handleGuideDeleted(exp.id, guideId),
    onGuideDuplicated: (newGuide) => handleGuideDuplicated(exp.id, newGuide),
    onGuideRenamed: (updatedGuide) => handleGuideRenamed(exp.id, updatedGuide),
    onPaused: (expId, updated) => handlePaused(expId, updated),
    onResumed: (e) => setResumeTarget(e),
  });

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      {showGuideGeneratorFor && (() => {
        const exp = experiments.find(e => e.id === showGuideGeneratorFor);
        if (!exp) return null;
        return (
          <MissionGuideGenerator
            experiment={exp}
            existingGuides={guidesMap[showGuideGeneratorFor] || []}
            onGenerated={(guide, makeActive, deactivatedIds) => handleGuideGenerated(showGuideGeneratorFor, guide, makeActive, deactivatedIds)}
            onClose={() => setShowGuideGeneratorFor(null)}
          />
        );
      })()}
      {outreachPlanTarget && (
        <OutreachPlanModal
          path={outreachPlanTarget.path || { path_name: outreachPlanTarget.exp?.path_name || 'This Path', id: outreachPlanTarget.exp?.path_recommendation_id }}
          experiment={outreachPlanTarget.exp}
          onClose={() => setOutreachPlanTarget(null)}
          onContactSaved={() => {}}
        />
      )}
      {showNew && <NewExperimentModal onClose={() => setShowNew(false)} onSave={save} paths={paths} />}
      {resumeTarget && (
        <ResumeExperimentModal
          exp={resumeTarget}
          missions={missionsMap[resumeTarget.id] || []}
          onClose={() => setResumeTarget(null)}
          onResumed={handleResumed}
        />
      )}
      {successToast && (
        <ProofSuccessToast
          proof={successToast.proof}
          missionTitle={successToast.missionTitle}
          onViewProof={() => { setSuccessToast(null); navigate('/proof'); }}
          onReturnToMission={() => setSuccessToast(null)}
          onDismiss={() => setSuccessToast(null)}
        />
      )}
      <PageHeader
        title="Test paths. Learn from results."
        description="Every experiment is a controlled test. You are not committing to a path. You are gathering evidence."
        action={
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-[10px] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-px"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            <Plus size={16} /> New Experiment
          </button>
        }
      />

      {/* The path switcher only exists once paths are loaded, so during the
          fetch it stands in as a block of the same height — otherwise the
          whole experiment list dropped 52px the instant the data arrived. */}
      {loading && (
        <div className="mb-4 flex items-center gap-3">
          <Sk h={38} w={230} r={12} />
          <Sk h={13} w={200} r={5} />
        </div>
      )}

      {!loading && paths.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <PathSwitcher
            paths={paths.filter(p => p.status !== 'archived')}
            selectedId={selectedPathId}
            onChange={setSelectedPathId}
            showAll
          />
          {selectedPath && <span className="text-xs text-[color:var(--ink-400)]">Showing experiments for <strong className="text-[color:var(--ink-700)]">{selectedPath.path_name}</strong></span>}
        </div>
      )}

      {loading ? (
        <>
          {/* Section heading + filter pills + experiment cards, in place */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Sk h={18} w={210} r={6} />
            <SkPills count={6} className="" />
          </div>
          <SkCards count={3} h={186} r={24} />
        </>
      ) : (
        <>
          {/* Paused section — always visible */}
          <PausedSection
            experiments={pausedFiltered}
            missions={missionsMap}
            guides={guidesMap}
            onResumed={(e) => setResumeTarget(e)}
            onDelete={handleExperimentDeleted}
            onEdited={handleExperimentEdited}
          />

          {/* Active / filter section */}
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <SectionHeader label="Active Experiments" count={allActive.length} />
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'active', label: 'Active' },
                { key: 'planned', label: 'Planned' },
                { key: 'in_progress', label: 'In Progress' },
                { key: 'completed', label: 'Completed' },
                { key: 'skipped', label: 'Skipped' },
                { key: 'all', label: 'All' },
              ].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className="rounded-full px-3 py-1 text-xs font-semibold transition border"
                  style={filter === f.key ? { background: 'var(--brand-navy-900)', color: '#fff', borderColor: 'var(--brand-navy-900)' } : { background: 'white', color: 'var(--text-secondary)', borderColor: 'var(--border-light)' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {activeFiltered.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[color:var(--ink-200)] p-16 text-center">
              {filter !== 'all' ? (
                <>
                  <h3 className="font-heading text-xl font-bold text-[color:var(--surface-dark-900)]">No {filter.replace('_', ' ')} experiments.</h3>
                  <button onClick={() => setFilter('all')} className="mt-4 text-sm font-semibold" style={{ color: 'var(--brand-navy-900)' }}>Show all</button>
                </>
              ) : (
                <>
                  <h3 className="font-heading text-xl font-bold text-[color:var(--surface-dark-900)]">No experiments yet.</h3>
                  <p className="mt-2 text-sm text-[color:var(--ink-500)]">Start your first experiment to test a path in the real world.</p>
                  <button onClick={() => setShowNew(true)}
                    className="mt-6 inline-flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white"
                    style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
                                      <Plus size={16} /> Create first experiment
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {activeFiltered.map(exp => (
                <ExperimentCard key={exp.id} {...sharedCardProps(exp)} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}