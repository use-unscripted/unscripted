import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Pencil, PauseCircle, Play, Trash2, X, Calendar } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { softDeletePayload } from '@/components/SoftDeleteConfirm';
import PauseExperimentModal from '@/components/experiments/PauseExperimentModal';
import AddToCalendarModal from '@/components/calendar/AddToCalendarModal';

// ── Experiment-specific soft-delete confirmation ──────────────────────────────
function ExperimentDeleteConfirm({ expTitle, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      <div className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="tp-section text-[color:var(--surface-dark-900)]">Move this experiment to Recently Deleted?</h3>
          <button onClick={onCancel}><X size={18} className="text-[color:var(--ink-400)]" /></button>
        </div>
        {expTitle && <p className="tp-body font-semibold text-[color:var(--ink-700)] mb-2">"{expTitle}"</p>}
        <p className="tp-prose text-[color:var(--ink-500)] mb-5">
          It will no longer appear in Missions, but you can restore it for 30 days. Its missions, proof, contacts, and reflections will be preserved.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="tp-body flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-2.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="tp-body flex-1 rounded-[10px] py-2.5 font-semibold text-white transition"
            style={{ background: 'var(--brand-navy-900)' }}>
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
    await base44.entities.Experiments.update(exp.id, data);
    setSaving(false);
    onSaved({ ...exp, ...data });
  };

  const inputCls = 'w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="tp-section text-[color:var(--surface-dark-900)]">Edit Experiment</h2>
          <button onClick={onClose}><X size={18} className="text-[color:var(--ink-400)]" /></button>
        </div>
        <div className="space-y-4">
          {[
            { name: 'title', label: 'Title' },
            { name: 'path_name', label: 'Path being tested' },
            { name: 'objective', label: 'Objective', rows: 2 },
            { name: 'deliverable', label: 'Deliverable' },
          ].map(f => (
            <label key={f.name} className="tp-body block font-semibold text-[color:var(--ink-700)]">
              {f.label}
              {f.rows ? (
                <textarea rows={f.rows} value={data[f.name] || ''} onChange={e => setData(d => ({ ...d, [f.name]: e.target.value }))} className={`mt-1 ${inputCls}`} />
              ) : (
                <input type="text" value={data[f.name] || ''} onChange={e => setData(d => ({ ...d, [f.name]: e.target.value }))} className={`mt-1 ${inputCls}`} />
              )}
            </label>
          ))}
          <label className="tp-body block font-semibold text-[color:var(--ink-700)]">
            Estimated hours
            <input type="number" value={data.estimated_hours || ''} onChange={e => setData(d => ({ ...d, estimated_hours: Number(e.target.value) }))} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="tp-body block font-semibold text-[color:var(--ink-700)]">
            Deadline
            <input type="date" value={data.deadline || ''} onChange={e => setData(d => ({ ...d, deadline: e.target.value }))} className={`mt-1 ${inputCls}`} />
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="tp-body flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-2.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="tp-body flex-1 rounded-[10px] py-2.5 font-semibold text-white transition disabled:opacity-60"
            style={{ background: 'var(--brand-navy-900)' }}>
             {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExperimentActionsMenu({ exp, onDeleted, onPaused, onResumed, onEdited }) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleDeleteConfirmed = async () => {
    const user = await base44.auth.me();
    await base44.entities.Experiments.update(exp.id, {
      ...softDeletePayload(user.id),
      status_before_deletion: exp.status,
    });
    setShowDeleteConfirm(false);
    onDeleted(exp.id);
  };

  const isPaused = exp.status === 'paused';

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
      {showPause && (
        <PauseExperimentModal
          exp={exp}
          onClose={() => setShowPause(false)}
          onPaused={(updated) => { setShowPause(false); onPaused(exp.id, 'paused', updated); }}
        />
      )}
      {showCal && (
        <AddToCalendarModal
          item={exp}
          itemType="experiment"
          onClose={() => setShowCal(false)}
        />
      )}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(v => !v)}
          className="rounded-xl border border-[color:var(--ink-200)] p-2 text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition"
          title="More actions"
        >
          <MoreHorizontal size={15} />
        </button>

        {open && (
          <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-[color:var(--ink-200)] bg-white shadow-lg py-1.5">
            <button
              onClick={() => { setOpen(false); setShowEdit(true); }}
              className="tp-body w-full flex items-center gap-2.5 px-4 py-2 text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition"
            >
              <Pencil size={14} /> Edit Experiment
            </button>
            <button
              onClick={() => { setOpen(false); setShowCal(true); }}
              className="tp-body w-full flex items-center gap-2.5 px-4 py-2 text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition"
            >
              <Calendar size={14} /> Add to Calendar
            </button>
            {!isPaused && (
              <button
                onClick={() => { setOpen(false); setShowPause(true); }}
                className="tp-body w-full flex items-center gap-2.5 px-4 py-2 text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition"
              >
                <PauseCircle size={14} /> Pause Experiment
              </button>
            )}
            {isPaused && onResumed && (
              <button
                onClick={() => { setOpen(false); onResumed(exp); }}
                className="tp-body w-full flex items-center gap-2.5 px-4 py-2 font-semibold hover:bg-[color:var(--success-50)] transition"
                style={{ color: 'var(--success-700)' }}
              >
                <Play size={14} /> Resume Experiment
              </button>
            )}
            <div className="my-1 border-t border-[color:var(--ink-100)]" />
            <button
              onClick={() => { setOpen(false); setShowDeleteConfirm(true); }}
              className="tp-body w-full flex items-center gap-2.5 px-4 py-2 text-red-500 hover:bg-red-50 transition"
            >
              <Trash2 size={14} /> Move to Recently Deleted
            </button>
          </div>
        )}
      </div>
    </>
  );
}