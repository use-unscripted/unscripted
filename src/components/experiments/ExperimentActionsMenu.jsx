import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Pencil, PauseCircle, Trash2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { softDeletePayload } from '@/components/SoftDeleteConfirm';

// ── Experiment-specific soft-delete confirmation ──────────────────────────────
function ExperimentDeleteConfirm({ expTitle, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      <div className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-heading text-lg font-bold text-[#050816]">Move this experiment to Recently Deleted?</h3>
          <button onClick={onCancel}><X size={18} className="text-[#94A3B8]" /></button>
        </div>
        {expTitle && <p className="text-sm font-semibold text-[#334155] mb-2">"{expTitle}"</p>}
        <p className="text-sm text-[#64748B] mb-5">
          It will no longer appear in Missions, but you can restore it for 30 days. Its missions, proof, contacts, and reflections will be preserved.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold text-white transition"
            style={{ background: '#8B0C21' }}>
            Move to Recently Deleted
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Experiment Modal ─────────────────────────────────────────────────────
function EditExperimentModal({ exp, onClose, onSaved }) {
  const [data, setData] = useState({
    title: exp.title || '',
    objective: exp.objective || '',
    path_name: exp.path_name || '',
    estimated_hours: exp.estimated_hours || '',
    deliverable: exp.deliverable || '',
    deadline: exp.deadline || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const updated = await base44.entities.Experiments.update(exp.id, data);
    setSaving(false);
    onSaved({ ...exp, ...data });
  };

  const inputCls = 'w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl font-bold text-[#050816]">Edit Experiment</h2>
          <button onClick={onClose}><X size={18} className="text-[#94A3B8]" /></button>
        </div>
        <div className="space-y-4">
          {[
            { name: 'title', label: 'Title' },
            { name: 'path_name', label: 'Path being tested' },
            { name: 'objective', label: 'Objective', rows: 2 },
            { name: 'deliverable', label: 'Deliverable' },
          ].map(f => (
            <label key={f.name} className="block text-sm font-semibold text-[#334155]">
              {f.label}
              {f.rows ? (
                <textarea rows={f.rows} value={data[f.name] || ''} onChange={e => setData(d => ({ ...d, [f.name]: e.target.value }))} className={`mt-1 ${inputCls}`} />
              ) : (
                <input type="text" value={data[f.name] || ''} onChange={e => setData(d => ({ ...d, [f.name]: e.target.value }))} className={`mt-1 ${inputCls}`} />
              )}
            </label>
          ))}
          <label className="block text-sm font-semibold text-[#334155]">
            Estimated hours
            <input type="number" value={data.estimated_hours || ''} onChange={e => setData(d => ({ ...d, estimated_hours: Number(e.target.value) }))} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-sm font-semibold text-[#334155]">
            Deadline
            <input type="date" value={data.deadline || ''} onChange={e => setData(d => ({ ...d, deadline: e.target.value }))} className={`mt-1 ${inputCls}`} />
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: '#8B0C21' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExperimentActionsMenu({ exp, onDeleted, onPaused, onEdited }) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handlePause = async () => {
    setOpen(false);
    await base44.entities.Experiments.update(exp.id, { status: 'paused' });
    onPaused(exp.id, 'paused');
  };

  const handleDeleteConfirmed = async () => {
    const user = await base44.auth.me();
    await base44.entities.Experiments.update(exp.id, {
      ...softDeletePayload(user.id),
      status_before_deletion: exp.status,
    });
    setShowDeleteConfirm(false);
    onDeleted(exp.id);
  };

  return (
    <>
      {showDeleteConfirm && (
        <ExperimentDeleteConfirm
          expTitle={exp.title}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {showEdit && (
        <EditExperimentModal
          exp={exp}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => { setShowEdit(false); onEdited(updated); }}
        />
      )}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(v => !v)}
          className="rounded-xl border border-[#E2E8F0] p-2 text-[#94A3B8] hover:text-[#334155] hover:bg-[#F8FAFC] transition"
          title="More actions"
        >
          <MoreHorizontal size={15} />
        </button>

        {open && (
          <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-[#E2E8F0] bg-white shadow-lg py-1.5">
            <button
              onClick={() => { setOpen(false); setShowEdit(true); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC] transition"
            >
              <Pencil size={14} /> Edit Experiment
            </button>
            <button
              onClick={handlePause}
              disabled={exp.status === 'paused'}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PauseCircle size={14} /> Pause Experiment
            </button>
            <div className="my-1 border-t border-[#F1F5F9]" />
            <button
              onClick={() => { setOpen(false); setShowDeleteConfirm(true); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition"
            >
              <Trash2 size={14} /> Move to Recently Deleted
            </button>
          </div>
        )}
      </div>
    </>
  );
}