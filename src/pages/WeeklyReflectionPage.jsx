import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowRight, CheckCircle, Plus, Search, X, ExternalLink, Trash2 } from 'lucide-react';
import SoftDeleteConfirm, { softDeletePayload } from '@/components/SoftDeleteConfirm';
import PageHeader from '@/components/PageHeader';
import { useNavigate } from 'react-router-dom';
import PathSwitcher from '@/components/PathSwitcher';

const QUESTIONS = [
  { name: 'completed_items', label: 'What did you complete this week?', placeholder: 'List the experiments, conversations, or outputs you finished' },
  { name: 'avoided_items', label: 'What did you avoid or not finish?', placeholder: 'Be honest — what stayed on the list?' },
  { name: 'energy_sources', label: 'What gave you energy this week?', placeholder: 'Work, conversations, or activities that felt engaging' },
  { name: 'energy_drains', label: 'What drained you?', placeholder: 'Tasks, situations, or environments that felt difficult or draining' },
  { name: 'path_feedback', label: 'Did the path match your expectations this week?', placeholder: 'Based on what you actually did and felt — not what you expected to feel' },
  { name: 'surprises', label: 'What surprised you?', placeholder: 'Unexpected reactions, results, or realizations' },
  { name: 'lessons', label: 'What did you actually learn?', placeholder: 'Be specific — a lesson is not just completing something' },
  { name: 'next_changes', label: 'What should change next week?', placeholder: 'What will you do differently, stop doing, or try for the first time?' },
];

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff)).toISOString().split('T')[0];
}

const inputCls = 'w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none focus:border-[#1F3A5F]';

// ── Success Toast ──────────────────────────────────────────────────────────────
function SuccessToast({ reflection, experiment, mission, onView, onOpenExp, onDismiss }) {
  return (
    <div role="alert" className="fixed bottom-6 right-6 z-[100] max-w-sm w-full rounded-[20px] bg-white border border-green-100 shadow-2xl p-5 flex flex-col gap-3"
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#F0FDF4' }}>
          <CheckCircle size={20} className="text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#050816]">Reflection saved successfully.</p>
          {experiment && <p className="text-xs text-[#64748B] mt-0.5 truncate">Experiment: {experiment.title}</p>}
          {mission && <p className="text-xs text-[#94A3B8] truncate">Mission: {mission.title}</p>}
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-[#94A3B8] hover:text-[#334155]">
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={onView} className="flex-1 rounded-[8px] py-2 text-xs font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>
          View Reflection
        </button>
        {experiment && (
          <button onClick={onOpenExp} className="flex-1 rounded-[8px] border border-[#E2E8F0] py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]">
            Open Experiment
          </button>
        )}
      </div>
    </div>
  );
}

// ── Reflection Form ────────────────────────────────────────────────────────────
function ReflectionForm({ experiments, missions, initialData, onSaved, onCancel }) {
  const submittingRef = useRef(false);
  const weekStart = getMonday(new Date());

  const [form, setForm] = useState({
    week_start: weekStart,
    experiment_id: '',
    mission_id: '',
    ...initialData,
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');

  const isEdit = !!initialData?.id;

  const ch = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const selectedExp = experiments.find(e => e.id === form.experiment_id) || null;
  const expMissions = missions.filter(m => m.experiment_id === form.experiment_id);

  const handleExpChange = (expId) => {
    setForm(f => ({ ...f, experiment_id: expId, mission_id: '', path_name: experiments.find(e => e.id === expId)?.path_name || '' }));
    setError('');
  };

  const handleMissionChange = (missionId) => {
    setForm(f => ({ ...f, mission_id: missionId }));
  };

  const hasContent = QUESTIONS.some(q => (form[q.name] || '').trim());

  const save = async () => {
    if (submittingRef.current) return;
    if (!form.experiment_id) { setError('Select the experiment this reflection relates to.'); return; }
    if (!hasContent) { setError('Complete at least one reflection question before saving.'); return; }

    // Validate mission belongs to experiment
    if (form.mission_id) {
      const mission = missions.find(m => m.id === form.mission_id);
      if (mission && mission.experiment_id !== form.experiment_id) {
        setError('The selected mission does not belong to this experiment.');
        return;
      }
    }

    setError('');
    setSaveError('');
    submittingRef.current = true;
    setSaving(true);

    try {
      const user = await base44.auth.me();
      console.log('[WeeklyReflectionPage] Save: auth resolved, user_id=' + user.id);

      // Normalize: entity schema expects arrays for completed_items, avoided_items, path_adjustments
      // but the form stores them as plain strings from textarea inputs — wrap non-empty strings
      const toArray = (val) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string' && val.trim()) return [val.trim()];
        return [];
      };

      // Only include fields that exist in the WeeklyReflections schema
      const payload = {
        user_id: user.id,
        experiment_id: form.experiment_id || undefined,
        mission_id: form.mission_id || undefined,
        path_name: selectedExp?.path_name || form.path_name || '',
        week_start: form.week_start,
        completed_items: toArray(form.completed_items),
        avoided_items: toArray(form.avoided_items),
        avoidance_reasons: form.avoidance_reasons?.trim() || undefined,
        energy_sources: form.energy_sources?.trim() || undefined,
        energy_drains: form.energy_drains?.trim() || undefined,
        surprises: form.surprises?.trim() || undefined,
        path_feedback: form.path_feedback?.trim() || undefined,
        skill_gaps_noticed: form.skill_gaps_noticed?.trim() || undefined,
        lessons: form.lessons?.trim() || undefined,
        next_changes: form.next_changes?.trim() || undefined,
        generated_summary: form.generated_summary?.trim() || undefined,
        path_adjustments: toArray(form.path_adjustments),
      };

      // Remove undefined keys to avoid sending nulls that schema may reject
      Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

      console.log('[WeeklyReflectionPage] Save: payload built, experiment_id=' + (payload.experiment_id || 'none'));

      let saved;
      if (isEdit) {
        await base44.entities.WeeklyReflections.update(initialData.id, payload);
        saved = { ...initialData, ...payload };
      } else {
        saved = await base44.entities.WeeklyReflections.create(payload);
      }
      console.log('[WeeklyReflectionPage] Save: success, record_id=' + saved?.id);
      onSaved(saved);
    } catch (err) {
      console.error('[WeeklyReflectionPage] Save failed:', err?.message || err);
      setSaveError("We couldn't save this reflection. Your answers are still here. Please try again.");
      setSaving(false);
      submittingRef.current = false;
    }
  };

  const generate = async () => {
    if (!form.experiment_id || !hasContent) return;
    setGenerating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Unscripted. Based on this student's weekly reflection, generate: 1) A direct weekly learning summary, 2) Path-fit adjustments (which paths feel stronger/weaker and why), 3) Workload adjustments, 4) Specific recommendations for next week. Be honest but constructive. Never shame. Reflection: ${JSON.stringify(form)}`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            path_adjustments: { type: 'array', items: { type: 'string' } },
          }
        }
      });
      setForm(f => ({ ...f, generated_summary: result.summary, path_adjustments: result.path_adjustments }));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="mb-6 rounded-[16px] p-4" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}>
        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--brand-navy-900)' }}>
          Week of {new Date(form.week_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
        </p>
        <p className="text-sm text-[#334155]">Answer honestly. These reflections adjust your roadmap over time. There are no correct answers.</p>
      </div>

      {(error || saveError) && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error || saveError}
        </div>
      )}

      {/* Experiment — required */}
      <div className="mb-5 rounded-[20px] border border-[#E2E8F0] bg-white p-5">
        <span className="text-sm font-semibold text-[#050816] block mb-2">
          Which experiment are you reflecting on? <span className="text-red-500">*</span>
        </span>
        {experiments.length === 0 ? (
          <p className="text-sm text-[#64748B] rounded-xl border border-[#E2E8F0] px-4 py-3">
            No experiments found. Create one first from the Missions page.
          </p>
        ) : (
          <select value={form.experiment_id} onChange={e => handleExpChange(e.target.value)}
            className="rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none focus:border-[#1F3A5F]"
            style={{ maxWidth: '480px', width: 'auto', minWidth: '200px' }}>
            <option value="">Select an experiment…</option>
            {experiments.map(exp => (
              <option key={exp.id} value={exp.id}>
                {exp.title}{exp.path_name ? ` — ${exp.path_name}` : ''}{exp.status ? ` (${exp.status.replace('_', ' ')})` : ''}
              </option>
            ))}
          </select>
        )}

        {/* Path — auto-populated read-only */}
        {form.experiment_id && (
          <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B] mb-0.5">Path</p>
            <p className="text-sm font-semibold text-[#050816]">
              {selectedExp?.path_name || <span className="text-[#94A3B8] font-normal">Path not linked to this experiment.</span>}
            </p>
          </div>
        )}

        {/* Mission — optional */}
        {form.experiment_id && (
          <div className="mt-3">
            <span className="text-sm font-semibold text-[#050816] block mb-1.5">
              Mission <span className="text-xs font-normal text-[#94A3B8]">(optional)</span>
            </span>
            {expMissions.length === 0 ? (
              <p className="text-xs text-[#94A3B8] rounded-xl border border-[#E2E8F0] px-4 py-3">
                No missions are currently linked to this experiment.
              </p>
            ) : (
              <select value={form.mission_id} onChange={e => handleMissionChange(e.target.value)} className={inputCls}>
                <option value="">No specific mission — overall experiment</option>
                {expMissions.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Reflection questions */}
      <div className="space-y-5">
        {QUESTIONS.map(q => (
          <label key={q.name} className="block rounded-[20px] border border-[#E2E8F0] bg-white p-5">
            <span className="text-sm font-semibold text-[#050816] block mb-3">{q.label}</span>
            <textarea rows={3} name={q.name} value={form[q.name] || ''} onChange={ch} placeholder={q.placeholder}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none focus:border-[#1F3A5F] resize-none" />
          </label>
        ))}

        {/* Path decision */}
        <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
          <span className="text-sm font-semibold text-[#050816] block mb-3">Continue, modify, or stop testing this path?</span>
          <div className="flex gap-2 flex-wrap mb-3">
            {[
              { val: 'continue', label: 'Continue testing', bg: '#F0FDF4', color: '#15803D' },
              { val: 'modify', label: 'Modify approach', bg: '#FFFBEB', color: '#B45309' },
              { val: 'stop', label: 'Stop — not a fit', bg: '#FEF2F2', color: '#B91C1C' },
            ].map(opt => (
              <button key={opt.val} type="button"
                onClick={() => setForm(f => ({ ...f, path_decision: opt.val }))}
                className="rounded-full px-4 py-2 text-sm font-semibold transition border"
                style={form.path_decision === opt.val
                  ? { background: opt.bg, color: opt.color, borderColor: opt.color }
                  : { background: 'white', color: '#334155', borderColor: '#E2E8F0' }}>
                {opt.label}
              </button>
            ))}
          </div>
          {form.path_decision === 'modify' && (
            <textarea rows={2} name="path_modification_note" value={form.path_modification_note || ''} onChange={ch}
              placeholder="What specifically would you change about how you are testing this path?"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none focus:border-[#1F3A5F] resize-none" />
          )}
          {form.path_decision === 'stop' && (
            <textarea rows={2} name="path_stop_reason" value={form.path_stop_reason || ''} onChange={ch}
              placeholder="What did you learn that made this path a poor fit?"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none focus:border-[#1F3A5F] resize-none" />
          )}
        </div>
      </div>

      {/* AI analysis output */}
      {form.generated_summary && (
        <div className="mt-6 rounded-[20px] p-6" style={{ background: '#081225', border: '1px solid rgba(31,58,95,0.5)' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-gold-500)' }}>Unscripted's analysis</p>
          <p className="text-sm text-slate-300 leading-6">{form.generated_summary}</p>
          {form.path_adjustments?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Path adjustments</p>
              <ul className="space-y-2">{form.path_adjustments.map((a, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-300">
                  <ArrowRight size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--brand-gold-500)' }} />{a}
                </li>
              ))}</ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {onCancel && (
          <button onClick={onCancel} className="rounded-[10px] border border-[#E2E8F0] px-5 py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
            Cancel
          </button>
        )}
        <button onClick={save} disabled={saving}
          className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white transition disabled:opacity-60"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
          {saving ? 'Saving...' : isEdit ? 'Update Reflection' : 'Save Reflection'}
        </button>
        <button onClick={generate} disabled={generating || !form.experiment_id || !hasContent}
          className="flex-1 rounded-[10px] border py-3 text-sm font-semibold transition disabled:opacity-60"
          style={{ borderColor: 'var(--brand-navy-700)', color: 'var(--brand-navy-700)', background: 'white' }}>
          {generating ? 'Generating...' : 'Generate Insights'} <ArrowRight size={14} className="inline ml-1" />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function WeeklyReflectionPage() {
  const navigate = useNavigate();
  const [userPaths, setUserPaths] = useState([]);
  const [selectedPathId, setSelectedPathId] = useState('all');
  const [reflections, setReflections] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('form'); // 'form' | 'history'
  const [editingReflection, setEditingReflection] = useState(null); // null = new form
  const [successToast, setSuccessToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toastTimer = useRef(null);

  // History filters
  const [search, setSearch] = useState('');
  const [filterExp, setFilterExp] = useState('all');

  const load = async () => {
    try {
      const [data, exps, mis, ps] = await Promise.all([
        base44.entities.WeeklyReflections.list('-created_date', 100).catch(() => []),
        base44.entities.Experiments.list('-created_date', 200).catch(() => []),
        base44.entities.Missions.list('-created_date', 200).catch(() => []),
        base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []),
      ]);
      setReflections(Array.isArray(data) ? data.filter(r => !r.deletion_status || r.deletion_status === 'active') : []);
      // Exclude deleted experiments; include active, in_progress, paused, completed — excludable only if permanently_deleted
      setExperiments(Array.isArray(exps) ? exps.filter(e => !e.deletion_status || e.deletion_status === 'active') : []);
      setMissions(Array.isArray(mis) ? mis : []);
      setUserPaths(Array.isArray(ps) ? ps : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const experimentsMap = Object.fromEntries(experiments.map(e => [e.id, e]));
  const missionsMap = Object.fromEntries(missions.map(m => [m.id, m]));

  const handleSaved = (saved) => {
    // Update local list immediately
    setReflections(prev => {
      const idx = prev.findIndex(r => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });

    const experiment = saved.experiment_id ? experimentsMap[saved.experiment_id] : null;
    const mission = saved.mission_id ? missionsMap[saved.mission_id] : null;

    setSuccessToast({ reflection: saved, experiment, mission });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSuccessToast(null), 8000);

    setEditingReflection(null);
    setView('history');
  };

  const selectedPath = selectedPathId === 'all' ? null : userPaths.find(p => p.id === selectedPathId);

  // History filtering
  const filteredReflections = reflections.filter(r => {
    if (selectedPath) {
      const exp = r.experiment_id ? experimentsMap[r.experiment_id] : null;
      const matchesPath = r.path_name === selectedPath.path_name || exp?.path_name === selectedPath.path_name;
      if (!matchesPath) return false;
    }
    if (filterExp !== 'all' && (r.experiment_id || '') !== filterExp) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const exp = r.experiment_id ? experimentsMap[r.experiment_id] : null;
      const mis = r.mission_id ? missionsMap[r.mission_id] : null;
      const text = [
        r.generated_summary, r.lessons, r.next_changes, r.path_feedback,
        exp?.title, exp?.path_name, mis?.title,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  const handleDeleteReflection = async () => {
    if (!deleteTarget) return;
    const user = await base44.auth.me();
    await base44.entities.WeeklyReflections.update(deleteTarget.id, softDeletePayload(user.id));
    setReflections(prev => prev.filter(r => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      {deleteTarget && (
        <SoftDeleteConfirm
          itemName={`Week of ${new Date(deleteTarget.week_start + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
          onConfirm={handleDeleteReflection}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {successToast && (
        <SuccessToast
          reflection={successToast.reflection}
          experiment={successToast.experiment}
          mission={successToast.mission}
          onView={() => { setSuccessToast(null); setView('history'); }}
          onOpenExp={() => { setSuccessToast(null); navigate('/experiments'); }}
          onDismiss={() => setSuccessToast(null)}
        />
      )}

      {userPaths.length > 0 && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <PathSwitcher
            paths={userPaths.filter(p => p.status !== 'archived')}
            selectedId={selectedPathId}
            onChange={setSelectedPathId}
            showAll
          />
          {selectedPath && <span className="text-xs text-[#94A3B8]">Reflections for <strong className="text-[#334155]">{selectedPath.path_name}</strong></span>}
        </div>
      )}

      <PageHeader
        eyebrow="Weekly reflection"
        title="Learn from what you actually did."
        description="A weekly reflection helps you adjust direction based on real experience, not guesswork."
        action={
          <div className="flex gap-2">
            <button onClick={() => { setEditingReflection(null); setView('form'); }}
              className="rounded-[10px] px-4 py-2.5 text-sm font-semibold transition"
              style={view === 'form' ? { background: 'var(--brand-navy-900)', color: '#fff' } : { background: '#F1F5F9', color: '#334155' }}>
              New Reflection
            </button>
            <button onClick={() => setView('history')}
              className="rounded-[10px] px-4 py-2.5 text-sm font-semibold transition"
              style={view === 'history' ? { background: 'var(--brand-navy-900)', color: '#fff' } : { background: '#F1F5F9', color: '#334155' }}>
              History {reflections.length > 0 && `(${reflections.length})`}
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="py-20 text-center text-[#64748B]">Loading reflections…</div>
      ) : view === 'form' ? (
        <ReflectionForm
          experiments={experiments}
          missions={missions}
          initialData={editingReflection}
          onSaved={handleSaved}
        />
      ) : (
        /* ── History view ── */
        <div>
          {/* Search + filter */}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search reflections…"
                className="w-full rounded-xl border border-[#E2E8F0] bg-white pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#1F3A5F]" />
            </div>
            {experiments.length > 0 && (
              <select value={filterExp} onChange={e => setFilterExp(e.target.value)}
                className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
                <option value="all">All experiments</option>
                {experiments.map(exp => <option key={exp.id} value={exp.id}>{exp.title}</option>)}
              </select>
            )}
            <button
              onClick={() => { setEditingReflection(null); setView('form'); }}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white shrink-0"
              style={{ background: 'var(--brand-navy-900)' }}>
              <Plus size={15} /> Add
            </button>
          </div>

          {filteredReflections.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#E2E8F0] p-12 text-center text-[#64748B]">
              {reflections.length === 0
                ? 'No past reflections yet. Complete your first weekly reflection above.'
                : 'No reflections match your search or filter.'}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReflections.map(r => {
                const linkedExp = r.experiment_id ? experimentsMap[r.experiment_id] : null;
                const linkedMission = r.mission_id ? missionsMap[r.mission_id] : null;
                return (
                  <div key={r.id} className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-bold text-[#050816]">
                          Week of {new Date(r.week_start + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>

                        {/* Experiment */}
                        {linkedExp ? (
                          <p className="mt-0.5 text-xs font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
                            {linkedExp.title}{linkedExp.path_name ? ` — ${linkedExp.path_name}` : ''}
                          </p>
                        ) : r.experiment_id ? (
                          <p className="mt-0.5 text-xs text-[#94A3B8]">Experiment not linked.</p>
                        ) : (
                          <p className="mt-0.5 text-xs text-[#94A3B8]">Experiment not linked.</p>
                        )}

                        {/* Mission */}
                        {linkedMission && (
                          <p className="mt-0.5 text-xs text-[#64748B]">Mission: {linkedMission.title}</p>
                        )}

                        {r.generated_summary && (
                          <p className="mt-2 text-sm text-[#64748B] line-clamp-2">{r.generated_summary}</p>
                        )}
                        {!r.generated_summary && r.lessons && (
                          <p className="mt-2 text-sm text-[#64748B] line-clamp-2">{r.lessons}</p>
                        )}
                      </div>
                      {r.generated_summary && <CheckCircle size={18} className="shrink-0 mt-1" style={{ color: '#15803D' }} />}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => { setEditingReflection(r); setView('form'); }}
                        className="rounded-[8px] border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC] transition">
                        View / Edit
                      </button>
                      {linkedExp && (
                        <button onClick={() => navigate('/experiments')}
                          className="rounded-[8px] border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC] transition flex items-center gap-1">
                          <ExternalLink size={11} /> Open Experiment
                        </button>
                      )}
                      {linkedMission && (
                        <button onClick={() => navigate('/experiments')}
                          className="rounded-[8px] border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC] transition flex items-center gap-1">
                          <ExternalLink size={11} /> Open Mission
                        </button>
                      )}
                      <button onClick={() => setDeleteTarget(r)}
                        className="rounded-[8px] border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-400 hover:border-red-400 hover:text-red-600 transition flex items-center gap-1">
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}