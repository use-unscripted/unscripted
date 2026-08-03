import { useState, useRef } from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const inputCls = 'w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-sm text-[color:var(--surface-dark-900)] placeholder-[color:var(--ink-400)] outline-none focus:border-[color:var(--brand-navy-900)]';

export default function EditPathModal({ path, onClose, onSaved, onDeleted }) {
  const submittingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    path_name: path.path_name || '',
    path_category: path.path_category || '',
    goals: path.goals || '',
    weekly_hours: path.weekly_hours || 10,
    notes: path.notes || '',
    risk_level: path.risk_level || 'medium',
    confidence_level: path.confidence_level || 'medium',
    why_it_fits: path.why_it_fits || path.fit_reason || '',
    why_it_may_not_fit: path.why_it_may_not_fit || path.concern || '',
    lifestyle_implications: path.lifestyle_implications || '',
  });
  const ch = e => setForm(f => ({ ...f, [e.target.name]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.PathRecommendations.delete(path.id);
      onDeleted?.();
    } catch {
      setError('Failed to delete. Please try again.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSave = async () => {
    if (submittingRef.current) return;
    if (!form.path_name.trim()) { setError('Path name is required.'); return; }
    submittingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await base44.entities.PathRecommendations.update(path.id, {
        ...form,
        fit_reason: form.why_it_fits || path.fit_reason,
        concern: form.why_it_may_not_fit || path.concern,
      });
      onSaved({ ...path, ...form });
    } catch {
      setError('Failed to save. Please try again.');
      setSaving(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.6)' }}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-xl font-bold text-[color:var(--surface-dark-900)]">Edit Path</h2>
          <button onClick={onClose} disabled={saving}><X size={20} className="text-[color:var(--ink-500)]" /></button>
        </div>
        <p className="text-sm text-[color:var(--ink-500)] mb-5">Changes to this path will not affect other paths.</p>
        {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Path name *</label>
            <input name="path_name" value={form.path_name} onChange={ch} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Category</label>
            <input name="path_category" value={form.path_category} onChange={ch} placeholder="Finance, Tech, Media..." className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Goals for this path</label>
            <textarea rows={2} name="goals" value={form.goals} onChange={ch} placeholder="What do you want to learn or prove?"
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-sm outline-none focus:border-[color:var(--brand-navy-900)] resize-none placeholder-[color:var(--ink-400)]" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Why it fits you</label>
            <textarea rows={2} name="why_it_fits" value={form.why_it_fits} onChange={ch} placeholder="Your strengths, interests, or alignment..."
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-sm outline-none focus:border-[color:var(--brand-navy-900)] resize-none placeholder-[color:var(--ink-400)]" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Why it may not fit</label>
            <textarea rows={2} name="why_it_may_not_fit" value={form.why_it_may_not_fit} onChange={ch} placeholder="Honest concerns or potential mismatches..."
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-sm outline-none focus:border-[color:var(--brand-navy-900)] resize-none placeholder-[color:var(--ink-400)]" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Lifestyle implications</label>
            <textarea rows={2} name="lifestyle_implications" value={form.lifestyle_implications} onChange={ch} placeholder="Work hours, income, location, autonomy..."
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-sm outline-none focus:border-[color:var(--brand-navy-900)] resize-none placeholder-[color:var(--ink-400)]" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Notes</label>
            <textarea rows={2} name="notes" value={form.notes} onChange={ch} placeholder="Anything else to track..."
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-sm outline-none focus:border-[color:var(--brand-navy-900)] resize-none placeholder-[color:var(--ink-400)]" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Risk level</label>
              <select name="risk_level" value={form.risk_level} onChange={ch} className={inputCls}>
                {['low','medium','high'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Confidence</label>
              <select name="confidence_level" value={form.confidence_level} onChange={ch} className={inputCls}>
                {['low','medium','high'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Weekly hours</label>
              <input type="number" name="weekly_hours" value={form.weekly_hours} onChange={ch} min={1} max={80} className={inputCls} />
            </div>
          </div>
        </div>

        {confirmDelete ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700 mb-3">Permanently delete "{path.path_name}"? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                className="flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-2.5 text-sm font-semibold text-[color:var(--ink-700)] bg-white">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold text-white bg-red-600 disabled:opacity-60">
                {deleting ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />Deleting…</span> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex gap-3">
            <button onClick={() => setConfirmDelete(true)} disabled={saving}
              className="flex items-center gap-1.5 rounded-[10px] border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition">
              <Trash2 size={14} /> Delete
            </button>
            <button onClick={onClose} disabled={saving} className="flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-3 text-sm font-semibold text-[color:var(--ink-700)] disabled:opacity-50">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--brand-navy-900)' }}>
              {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Saving…</span> : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}