import { useState, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const CATEGORIES = ['report', 'model', 'case_study', 'article', 'post', 'newsletter', 'video', 'podcast', 'prototype', 'landing_page', 'service_pilot', 'interview_notes', 'simulation', 'presentation', 'database', 'community', 'volunteer', 'other'];
const CAT_LABELS = { report: 'Research Report', model: 'Financial Model', case_study: 'Case Study', article: 'Article', post: 'Post', newsletter: 'Newsletter', video: 'Video', podcast: 'Podcast', prototype: 'Prototype', landing_page: 'Landing Page', service_pilot: 'Service Pilot', interview_notes: 'Interview Notes', simulation: 'Simulation', presentation: 'Presentation', database: 'Database', community: 'Community', volunteer: 'Volunteer', other: 'Other' };

const inputCls = 'w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]';

export default function AddProofModal({ mission, experiment, onClose, onSaved }) {
  const [data, setData] = useState({
    title: '',
    category: 'other',
    description: '',
    external_url: '',
    completion_note: '',
    completed_at: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  const ch = e => setData(d => ({ ...d, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (submittingRef.current) return;
    if (!data.title.trim()) { setError('Title is required.'); return; }
    setError('');
    submittingRef.current = true;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const proof = await base44.entities.ProofOfWork.create({
        user_id: user.id,
        mission_id: mission.id,
        experiment_id: experiment.id,
        path_tested: experiment.path_name || '',
        title: data.title.trim(),
        category: data.category,
        description: data.description,
        external_url: data.external_url || undefined,
        completion_note: data.completion_note,
        completed_at: data.completed_at || undefined,
      });
      onSaved(proof);
    } catch (err) {
      setError('Failed to save proof. Please try again.');
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-xl font-bold text-[#050816]">Add Proof of Work</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} className="text-[#64748B]" /></button>
        </div>
        <p className="text-sm text-[#64748B] mb-5">Document evidence of completing this mission.</p>

        {/* Read-only context */}
        <div className="mb-5 rounded-xl p-3 border border-[#E2E8F0] bg-[#F8FAFC] space-y-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Mission</p>
            <p className="text-sm font-semibold text-[#050816]">{mission.title}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Experiment</p>
            <p className="text-sm text-[#334155]">{experiment.title}</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">{error}</div>}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Title <span className="text-red-500">*</span></span>
            <input name="title" value={data.title} onChange={ch} placeholder="What did you produce or complete?"
              className={inputCls} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Category</span>
              <select name="category" value={data.category} onChange={ch} className={inputCls}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Date completed</span>
              <input type="date" name="completed_at" value={data.completed_at} onChange={ch} className={inputCls} />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Description</span>
            <textarea rows={2} name="description" value={data.description} onChange={ch} placeholder="What is this and what does it show?"
              className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Link (optional)</span>
            <input name="external_url" value={data.external_url} onChange={ch} placeholder="https://..."
              className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Completion note</span>
            <textarea rows={2} name="completion_note" value={data.completion_note} onChange={ch} placeholder="What did you learn or what was the outcome?"
              className={inputCls} />
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !data.title.trim()}
            className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
            {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Saving...</span> : 'Save Proof'}
          </button>
        </div>
      </div>
    </div>
  );
}