import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, ChevronDown, ChevronUp, Clock, BookOpen, Target, FileText, Loader2, Calendar, Trash2 } from 'lucide-react';
import AddToCalendarModal from '@/components/calendar/AddToCalendarModal';
import PageHeader from '@/components/PageHeader';
import AddMissionModal from '@/components/experiments/AddMissionModal';
import AddProofModal, { ProofSuccessToast } from '@/components/experiments/AddProofModal';
import PathSwitcher from '@/components/PathSwitcher';
import SoftDeleteConfirm, { softDeletePayload } from '@/components/SoftDeleteConfirm';
import ExperimentActionsMenu from '@/components/experiments/ExperimentActionsMenu';

const STATUS_STYLES = {
  planned:     { bg: '#F1F5F9', text: '#334155', label: 'Planned' },
  in_progress: { bg: '#FFFBEB', text: '#B45309', label: 'In Progress' },
  completed:   { bg: '#F0FDF4', text: '#15803D', label: 'Completed' },
  skipped:     { bg: '#F8FAFC', text: '#94A3B8', label: 'Skipped' },
  paused:      { bg: '#EFF6FF', text: '#1D4ED8', label: 'Paused' },
};

const EXPERIMENT_TYPES = [
  'Interview a professional', 'Complete a virtual simulation', 'Build a small project',
  'Publish content (article, post, or video)', 'Attend a relevant event',
  'Apply to a short-term project', 'Test a freelance service', 'Interview a founder',
  'Build a portfolio sample', 'Complete a skills workshop', 'Volunteer for a relevant role',
  'Complete a research project',
];

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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
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
          <span className="text-sm font-semibold text-[#050816] truncate">{mission.title}</span>
        </div>
        {mission.objective && <p className="mt-0.5 text-xs text-[#64748B] line-clamp-1">{mission.objective}</p>}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => setShowCal(true)}
          className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-white transition"
        >
          <Calendar size={12} /> Add to Calendar
        </button>
        <button
          onClick={() => setShowProof(true)}
          className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-white transition"
        >
          <FileText size={12} /> Add Proof
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-xs text-red-300 hover:text-red-500 hover:border-red-200 transition"
          title="Delete mission"
        >
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
    <div className="border-t border-[#E2E8F0] pt-4">
      {showAdd && (
        <AddMissionModal
          experiment={experiment}
          onClose={() => setShowAdd(false)}
          onSaved={(m) => { setShowAdd(false); onMissionAdded(m); }}
        />
      )}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
          Missions {hasMissions ? `(${missions.length})` : ''}
        </p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-px"
          style={{ background: '#8B0C21', boxShadow: '0 4px 12px rgba(139,12,33,0.18)' }}
        >
          <Plus size={12} /> {hasMissions ? 'Add Another Mission' : 'Add Mission'}
        </button>
      </div>
      {loadingMissions ? (
        <div className="flex items-center gap-2 text-xs text-[#64748B] py-2">
          <Loader2 size={13} className="animate-spin" /> Loading missions...
        </div>
      ) : hasMissions ? (
        <div className="space-y-2">
          {missions.map(m => (
            <MissionRow key={m.id} mission={m} experiment={experiment} onProofAdded={onProofAdded} onDeleted={onMissionDeleted} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#94A3B8] italic">No missions yet. Add one to track progress and submit proof.</p>
      )}
    </div>
  );
}

// ── Experiment card ───────────────────────────────────────────────────────────
function ExperimentCard({ exp, onStatusChange, onExpand, expanded, missions, loadingMissions, onMissionAdded, onProofAdded, onMissionDeleted, onDelete, onEdited }) {
  const s = STATUS_STYLES[exp.status] || STATUS_STYLES.planned;

  return (
    <div className="rounded-[20px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: s.bg, color: s.text }}>{s.label}</span>
              {exp.path_name && <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: '#F8ECEF', color: '#8B0C21' }}>{exp.path_name}</span>}
            </div>
            <h3 className="font-heading font-bold text-[#050816]">{exp.title}</h3>
            <p className="mt-1 text-sm text-[#334155]">{exp.objective}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ExperimentActionsMenu
              exp={exp}
              onDeleted={onDelete}
              onPaused={(id, status) => onStatusChange(id, status)}
              onEdited={onEdited}
            />
            <button onClick={onExpand} className="rounded-xl border border-[#E2E8F0] p-2 hover:bg-[#F8FAFC]">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-[#64748B]">
          {exp.estimated_hours && <span className="flex items-center gap-1"><Clock size={12} /> ~{exp.estimated_hours}h</span>}
          {exp.deadline && <span>Due {new Date(exp.deadline).toLocaleDateString()}</span>}
          {exp.deliverable && <span className="flex items-center gap-1"><BookOpen size={12} /> {exp.deliverable}</span>}
          {!expanded && missions.length > 0 && (
            <span className="flex items-center gap-1"><Target size={12} /> {missions.length} mission{missions.length > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#E2E8F0] p-5 space-y-4">
          {exp.expected_learning && (
            <div><p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-1">Expected learning</p><p className="text-sm text-[#334155]">{exp.expected_learning}</p></div>
          )}
          {exp.mission_steps?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2">Mission steps</p>
              <ol className="space-y-2">
                {exp.mission_steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[#334155]">
                    <span className="shrink-0 font-bold" style={{ color: '#8B0C21' }}>{i + 1}.</span>
                    <span>{typeof s === 'string' ? s : s.step || s.description || s.title || JSON.stringify(s)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {exp.proof_required && (
            <div className="rounded-xl p-3" style={{ background: '#F8ECEF', border: '1px solid rgba(139,12,33,0.2)' }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#8B0C21' }}>Proof required</p>
              <p className="text-sm text-[#334155]">{exp.proof_required}</p>
            </div>
          )}
          {exp.reflection_questions?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2">Reflection questions</p>
              <ul className="space-y-1">{exp.reflection_questions.map((q, i) => <li key={i} className="text-sm text-[#334155]">· {q}</li>)}</ul>
            </div>
          )}

          {/* Status buttons */}
          <div className="flex gap-2 flex-wrap">
            {['planned', 'in_progress', 'completed', 'skipped'].map(st => (
              <button key={st} onClick={() => onStatusChange(exp.id, st)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition border"
                style={exp.status === st ? { background: '#8B0C21', color: '#fff', borderColor: '#8B0C21' } : { background: 'white', color: '#334155', borderColor: '#E2E8F0' }}>
                {STATUS_STYLES[st].label}
              </button>
            ))}
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

// ── New experiment modal ──────────────────────────────────────────────────────
function NewExperimentModal({ onClose, onSave }) {
  const [data, setData] = useState({ title: '', objective: '', path_name: '', estimated_hours: 3, deliverable: '', experiment_type: '' });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);

  const generateGuide = async () => {
    if (!data.title) return;
    setGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are Unscripted. Generate a detailed Mission Guide for this experiment: "${data.title}" related to path: "${data.path_name}". Include specific step-by-step instructions a college student can follow. Be practical and specific.`,
      response_json_schema: {
        type: 'object',
        properties: {
          expected_learning: { type: 'string' },
          estimated_hours: { type: 'number' },
          prerequisites: { type: 'string' },
          tools: { type: 'array', items: { type: 'string' } },
          mission_steps: { type: 'array', items: { type: 'string' } },
          proof_required: { type: 'string' },
          reflection_questions: { type: 'array', items: { type: 'string' } },
          common_mistakes: { type: 'array', items: { type: 'string' } },
          alternative_version: { type: 'string' },
          completion_criteria: { type: 'string' },
        }
      }
    });
    setData(d => ({ ...d, ...result }));
    setGenerating(false);
  };

  const handleSave = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try { await onSave(data); } finally { setSaving(false); submittingRef.current = false; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-bold text-[#050816] mb-1">New Experiment</h2>
        <p className="text-sm text-[#64748B] mb-6">Define what you want to test. We'll generate a step-by-step Mission Guide.</p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-[#334155] block mb-1">Choose an experiment type</label>
            <select className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]"
              value={data.experiment_type} onChange={e => setData(d => ({ ...d, experiment_type: e.target.value, title: d.title || e.target.value }))}>
              <option value="">Select or type your own below</option>
              {EXPERIMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {[
            { name: 'title', label: 'Experiment title', placeholder: 'e.g. Interview 3 investment bankers' },
            { name: 'path_name', label: 'Path being tested', placeholder: 'e.g. Investment Banking, Startup Operations...' },
            { name: 'objective', label: 'What do you want to learn?', placeholder: 'What question are you trying to answer?' },
            { name: 'deliverable', label: 'Deliverable', placeholder: 'What will you produce or submit?' },
          ].map(f => (
            <label key={f.name} className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">{f.label}</span>
              <input className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]"
                placeholder={f.placeholder} value={data[f.name] || ''} onChange={e => setData(d => ({ ...d, [f.name]: e.target.value }))} />
            </label>
          ))}
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Deadline</span>
            <input type="date" className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]"
              value={data.deadline || ''} onChange={e => setData(d => ({ ...d, deadline: e.target.value }))} />
          </label>
          {data.mission_steps?.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: '#F8ECEF', border: '1px solid rgba(139,12,33,0.2)' }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#8B0C21' }}>Mission Guide generated</p>
              <ol className="space-y-1">{data.mission_steps.map((s, i) => <li key={i} className="text-sm text-[#334155]">{i+1}. {typeof s === 'string' ? s : s.title || s.description}</li>)}</ol>
            </div>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC]">Cancel</button>
          <button onClick={generateGuide} disabled={generating || !data.title}
            className="flex-1 rounded-[10px] border py-3 text-sm font-semibold transition disabled:opacity-60"
            style={{ borderColor: '#8B0C21', color: '#8B0C21', background: 'white' }}>
            {generating ? 'Generating guide...' : 'Generate Mission Guide'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-60"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
            {saving ? 'Saving...' : 'Save Experiment'}
          </button>
        </div>
      </div>
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
  const [filter, setFilter] = useState('all');
  // missions keyed by experiment_id
  const [missionsMap, setMissionsMap] = useState({});
  const [loadingMissionsFor, setLoadingMissionsFor] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const toastTimer = useRef(null);

  const load = async () => {
    const [data, ps] = await Promise.all([
      base44.entities.Experiments.list('-created_date', 50).catch(() => []),
      base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []),
    ]);
    setExperiments(Array.isArray(data) ? data.filter(e => !e.deletion_status || e.deletion_status === 'active') : []);
    setPaths(Array.isArray(ps) ? ps : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadMissionsForExp = useCallback(async (expId) => {
    if (missionsMap[expId] !== undefined) return; // already loaded
    setLoadingMissionsFor(expId);
    const ms = await base44.entities.Missions.filter({ experiment_id: expId }, '-created_date', 50);
    // Exclude soft-deleted missions
    const active = (ms || []).filter(m => !m.deletion_status || m.deletion_status === 'active');
    setMissionsMap(prev => ({ ...prev, [expId]: active }));
    setLoadingMissionsFor(null);
  }, [missionsMap]);

  const handleExpand = (expId) => {
    const next = expandedId === expId ? null : expId;
    setExpandedId(next);
    if (next) loadMissionsForExp(next);
  };

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

  const handleProofAdded = (proof, missionTitle) => {
    setSuccessToast({ proof, missionTitle });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSuccessToast(null), 8000);
  };

  const selectedPath = selectedPathId === 'all' ? null : paths.find(p => p.id === selectedPathId);
  const pathFiltered = selectedPath
    ? experiments.filter(e => e.path_name === selectedPath.path_name)
    : experiments;
  const filtered = filter === 'all' ? pathFiltered : pathFiltered.filter(e => e.status === filter);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      {showNew && <NewExperimentModal onClose={() => setShowNew(false)} onSave={save} />}
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
        eyebrow="Experiments"
        title="Test paths. Learn from results."
        description="Every experiment is a controlled test. You are not committing to a path — you are gathering evidence."
        action={
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-[10px] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-px"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
            <Plus size={16} /> New Experiment
          </button>
        }
      />

      {paths.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <PathSwitcher
            paths={paths.filter(p => p.status !== 'archived')}
            selectedId={selectedPathId}
            onChange={setSelectedPathId}
            showAll
          />
          {selectedPath && <span className="text-xs text-[#94A3B8]">Showing experiments for <strong className="text-[#334155]">{selectedPath.path_name}</strong></span>}
        </div>
      )}

      <div className="mb-6 flex gap-2 flex-wrap">
        {['all', 'planned', 'in_progress', 'completed', 'skipped'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="rounded-full px-4 py-1.5 text-xs font-semibold transition border"
            style={filter === f ? { background: '#8B0C21', color: '#fff', borderColor: '#8B0C21' } : { background: 'white', color: '#334155', borderColor: '#E2E8F0' }}>
            {f === 'all' ? 'All' : STATUS_STYLES[f].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#64748B]">Loading experiments...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#E2E8F0] p-16 text-center">
          <h3 className="font-heading text-xl font-bold text-[#050816]">No experiments yet.</h3>
          <p className="mt-2 text-sm text-[#64748B]">Start your first experiment to test a path in the real world.</p>
          <button onClick={() => setShowNew(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
            <Plus size={16} /> Create first experiment
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(exp => (
            <ExperimentCard
              key={exp.id}
              exp={exp}
              expanded={expandedId === exp.id}
              onExpand={() => handleExpand(exp.id)}
              onStatusChange={updateStatus}
              missions={missionsMap[exp.id] || []}
              loadingMissions={loadingMissionsFor === exp.id}
              onMissionAdded={(m) => handleMissionAdded(exp.id, m)}
              onProofAdded={handleProofAdded}
              onMissionDeleted={(missionId) => handleMissionDeleted(exp.id, missionId)}
              onDelete={handleExperimentDeleted}
              onEdited={handleExperimentEdited}
            />
          ))}
        </div>
      )}
    </main>
  );
}