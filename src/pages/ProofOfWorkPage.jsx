import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, ExternalLink, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const CATEGORIES = ['report', 'model', 'case_study', 'article', 'post', 'newsletter', 'video', 'podcast', 'prototype', 'landing_page', 'service_pilot', 'interview_notes', 'simulation', 'presentation', 'database', 'community', 'volunteer', 'other'];
const CAT_LABELS = { report: 'Research Report', model: 'Financial Model', case_study: 'Case Study', article: 'Article', post: 'Post', newsletter: 'Newsletter', video: 'Video', podcast: 'Podcast', prototype: 'Prototype', landing_page: 'Landing Page', service_pilot: 'Service Pilot', interview_notes: 'Interview Notes', simulation: 'Simulation', presentation: 'Presentation', database: 'Database', community: 'Community', volunteer: 'Volunteer', other: 'Other' };

function EntryModal({ onClose, onSave }) {
  const [data, setData] = useState({ title: '', category: 'article', path_tested: '', description: '', skills_demonstrated: '', external_url: '', outcome: '', reflection: '', visibility: 'private', completed_at: '' });
  const [saving, setSaving] = useState(false);
  const ch = e => setData(d => ({ ...d, [e.target.name]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      await onSave({ ...data, skills_demonstrated: data.skills_demonstrated ? data.skills_demonstrated.split(',').map(s => s.trim()) : [] });
    } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex justify-between mb-6">
          <h2 className="font-heading text-xl font-bold text-[#050816]">Add Proof of Work</h2>
          <button onClick={onClose}><X size={20} className="text-[#64748B]" /></button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Title</span>
            <input name="title" value={data.title} onChange={ch} placeholder="What did you build, create, or complete?"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Category</span>
              <select name="category" value={data.category} onChange={ch}
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]">
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Path tested</span>
              <input name="path_tested" value={data.path_tested} onChange={ch} placeholder="e.g. Investment Banking"
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Description</span>
            <textarea rows={3} name="description" value={data.description} onChange={ch} placeholder="What is this, and why did you make it?"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Skills demonstrated (comma-separated)</span>
            <input name="skills_demonstrated" value={data.skills_demonstrated} onChange={ch} placeholder="Financial modeling, writing, Python..."
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">External link (optional)</span>
              <input name="external_url" value={data.external_url} onChange={ch} placeholder="https://..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Date completed</span>
              <input type="date" name="completed_at" value={data.completed_at} onChange={ch}
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Outcome</span>
            <input name="outcome" value={data.outcome} onChange={ch} placeholder="What happened? What did you learn?"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Reflection</span>
            <textarea rows={2} name="reflection" value={data.reflection} onChange={ch} placeholder="What would you do differently?"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]" />
          </label>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="vis" checked={data.visibility === 'public'} onChange={e => setData(d => ({ ...d, visibility: e.target.checked ? 'public' : 'private' }))} className="h-4 w-4 rounded accent-[#8B0C21]" />
            <label htmlFor="vis" className="text-sm text-[#334155]">Mark as public</label>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">Cancel</button>
          <button onClick={save} disabled={saving || !data.title.trim()} className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>{saving ? 'Saving...' : 'Save Entry'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Proof card with mission/experiment context ─────────────────────────────────
function ProofCard({ entry, missionsMap, experimentsMap }) {
  const mission = entry.mission_id ? missionsMap[entry.mission_id] : null;
  const experiment = entry.experiment_id ? experimentsMap[entry.experiment_id] : (mission?.experiment_id ? experimentsMap[mission.experiment_id] : null);

  return (
    <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: '#F8ECEF', color: '#8B0C21' }}>{CAT_LABELS[entry.category] || entry.category}</span>
            {entry.path_tested && <span className="rounded-full px-2.5 py-1 text-xs text-[#64748B] border border-[#E2E8F0]">{entry.path_tested}</span>}
            {entry.visibility === 'public' && <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: '#F0FDF4', color: '#15803D' }}>Public</span>}
          </div>
          <h3 className="font-heading font-bold text-[#050816]">{entry.title}</h3>
          {entry.description && <p className="mt-1 text-sm text-[#334155] line-clamp-2">{entry.description}</p>}
        </div>
        {entry.external_url && (
          <a href={entry.external_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[#64748B] hover:text-[#8B0C21] transition">
            <ExternalLink size={16} />
          </a>
        )}
      </div>

      {entry.skills_demonstrated?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.skills_demonstrated.map((s, i) => (
            <span key={i} className="rounded-full border border-[#E2E8F0] px-2.5 py-0.5 text-xs text-[#334155]">{s}</span>
          ))}
        </div>
      )}
      {entry.outcome && <p className="mt-3 text-xs text-[#64748B]"><strong>Outcome:</strong> {entry.outcome}</p>}
      {entry.completion_note && <p className="mt-1 text-xs text-[#64748B]"><strong>Note:</strong> {entry.completion_note}</p>}

      {/* Mission / experiment links */}
      {(mission || experiment) && (
        <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex flex-wrap gap-3 text-xs text-[#64748B]">
          {mission && <span>Mission: <span className="font-semibold text-[#334155]">{mission.title}</span></span>}
          {experiment && <span>Experiment: <span className="font-semibold text-[#334155]">{experiment.title}</span></span>}
        </div>
      )}
      {entry.completed_at && <p className="mt-2 text-xs text-[#94A3B8]">{new Date(entry.completed_at).toLocaleDateString()}</p>}
    </div>
  );
}

export default function ProofOfWorkPage() {
  const [entries, setEntries] = useState([]);
  const [missions, setMissions] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    const [proofData, missionData, expData] = await Promise.all([
      base44.entities.ProofOfWork.list('-created_date', 100),
      base44.entities.Missions.list('-created_date', 100),
      base44.entities.Experiments.list('-created_date', 100),
    ]);
    setEntries(proofData);
    setMissions(missionData);
    setExperiments(expData);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (data) => {
    await base44.entities.ProofOfWork.create(data);
    setShowNew(false);
    load();
  };

  // Build lookup maps
  const missionsMap = Object.fromEntries(missions.map(m => [m.id, m]));
  const experimentsMap = Object.fromEntries(experiments.map(e => [e.id, e]));

  const categories = ['all', ...new Set(entries.map(e => e.category))];
  const filtered = filter === 'all' ? entries : entries.filter(e => e.category === filter);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      {showNew && <EntryModal onClose={() => setShowNew(false)} onSave={save} />}
      <PageHeader
        eyebrow="Proof of work"
        title="Your real-world evidence."
        description="Every completed experiment, project, and published piece — documented and owned by you."
        action={
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-[10px] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-px"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
            <Plus size={16} /> Add Entry
          </button>
        }
      />

      <div className="mb-6 flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className="rounded-full px-4 py-1.5 text-xs font-semibold transition border"
            style={filter === c ? { background: '#8B0C21', color: '#fff', borderColor: '#8B0C21' } : { background: 'white', color: '#334155', borderColor: '#E2E8F0' }}>
            {c === 'all' ? 'All' : CAT_LABELS[c] || c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#64748B]">Loading portfolio...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#E2E8F0] p-16 text-center">
          <h3 className="font-heading text-xl font-bold text-[#050816]">No entries yet.</h3>
          <p className="mt-2 text-sm text-[#64748B]">Every project, case study, article, or interview counts. Start documenting.</p>
          <button onClick={() => setShowNew(true)} className="mt-6 inline-flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white"
            style={{ background: '#8B0C21' }}><Plus size={16} /> Add first entry</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(e => (
            <ProofCard key={e.id} entry={e} missionsMap={missionsMap} experimentsMap={experimentsMap} />
          ))}
        </div>
      )}
    </main>
  );
}