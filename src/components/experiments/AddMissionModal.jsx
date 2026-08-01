import { useState, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { linksForExperiment } from '@/lib/career-cycle';

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'skipped', label: 'Skipped' },
];

const inputCls = 'w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#1F3A5F]';

export default function AddMissionModal({ experiment, onClose, onSaved }) {
  const [data, setData] = useState({
    title: '',
    objective: '',
    description: '',
    status: 'planned',
    deadline: '',
    estimated_hours: '',
    proof_required: experiment?.proof_required || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  const ch = e => setData(d => ({ ...d, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (submittingRef.current) return;
    if (!data.title.trim()) { setError('Mission title is required.'); return; }
    setError('');
    submittingRef.current = true;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const links = await linksForExperiment(experiment);
      const mission = await base44.entities.Missions.create({
        ...links,
        user_id: user.id,
        experiment_id: experiment.id,
        path_name: experiment.path_name || '',
        title: data.title.trim(),
        objective: data.objective,
        description: data.description,
        status: data.status,
        deadline: data.deadline || undefined,
        estimated_hours: data.estimated_hours ? Number(data.estimated_hours) : undefined,
        proof_required: data.proof_required,
      });
      onSaved(mission);
    } catch (err) {
      setError('Failed to save mission. Please try again.');
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-xl font-bold text-[#050816]">Add Mission</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} className="text-[#64748B]" /></button>
        </div>
        <p className="text-sm text-[#64748B] mb-5">Define a specific mission within this experiment.</p>

        {/* Read-only experiment context */}
        <div className="mb-5 rounded-xl p-3 border border-[#E2E8F0] bg-[#F8FAFC]">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-0.5">Linked experiment</p>
          <p className="text-sm font-semibold text-[#050816]">{experiment.title}</p>
          {experiment.path_name && <p className="text-xs mt-0.5" style={{ color: 'var(--brand-navy-700)' }}>{experiment.path_name}</p>}
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">{error}</div>}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Mission title <span className="text-red-500">*</span></span>
            <input name="title" value={data.title} onChange={ch} placeholder="e.g. Complete 3 informational interviews"
              className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Objective</span>
            <input name="objective" value={data.objective} onChange={ch} placeholder="What specific outcome are you working toward?"
              className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Description</span>
            <textarea rows={2} name="description" value={data.description} onChange={ch} placeholder="More detail about what this mission involves..."
              className={inputCls} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Status</span>
              <select name="status" value={data.status} onChange={ch} className={inputCls}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Estimated hours</span>
              <input type="number" name="estimated_hours" value={data.estimated_hours} onChange={ch} placeholder="e.g. 4"
                min="0" className={inputCls} />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Deadline (optional)</span>
            <input type="date" name="deadline" value={data.deadline} onChange={ch} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Proof requirement</span>
            <input name="proof_required" value={data.proof_required} onChange={ch} placeholder="What document or artifact proves completion?"
              className={inputCls} />
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !data.title.trim()}
            className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Saving...</span> : 'Save Mission'}
          </button>
        </div>
      </div>
    </div>
  );
}