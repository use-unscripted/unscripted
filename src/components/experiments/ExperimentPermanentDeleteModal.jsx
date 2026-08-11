import { useState, useEffect } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Shown when a user clicks permanent-delete on a soft-deleted experiment.
 * Loads linked record counts, offers two deletion modes, and requires
 * typed confirmation before cascade-deleting linked records.
 */
export default function ExperimentPermanentDeleteModal({ exp, onDeleted, onCancel }) {
  const [counts, setCounts] = useState(null);
  const [mode, setMode] = useState(null); // 'cascade' | 'unlink'
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Load counts of linked records
    Promise.all([
      base44.entities.Missions.filter({ experiment_id: exp.id }, '-created_date', 500).catch(() => []),
      base44.entities.ProofOfWork.filter({ experiment_id: exp.id }, '-created_date', 500).catch(() => []),
      base44.entities.OutreachContacts.filter({ experiment_id: exp.id }, '-created_date', 500).catch(() => []),
      base44.entities.WeeklyReflections.filter({ experiment_id: exp.id }, '-created_date', 500).catch(() => []),
    ]).then(([missions, proof, contacts, reflections]) => {
      setCounts({
        missions: missions.length,
        proof: proof.length,
        contacts: contacts.length,
        reflections: reflections.length,
        missionIds: missions.map(m => m.id),
        proofIds: proof.map(p => p.id),
        contactIds: contacts.map(c => c.id),
        reflectionIds: reflections.map(r => r.id),
      });
    });
  }, [exp.id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (mode === 'cascade' && counts) {
        // Delete all linked records first
        await Promise.allSettled([
          ...counts.missionIds.map(id => base44.entities.Missions.delete(id)),
          ...counts.proofIds.map(id => base44.entities.ProofOfWork.delete(id)),
          ...counts.contactIds.map(id => base44.entities.OutreachContacts.delete(id)),
          ...counts.reflectionIds.map(id => base44.entities.WeeklyReflections.delete(id)),
        ]);
      }
      // Always delete the experiment itself
      await base44.entities.Experiments.delete(exp.id);
      onDeleted(exp.id);
    } finally {
      setDeleting(false);
    }
  };

  const cascadeConfirmWord = 'DELETE ALL';
  const cascadeReady = mode === 'cascade' && typed === cascadeConfirmWord;
  const unlinkReady = mode === 'unlink';
  const canConfirm = cascadeReady || unlinkReady;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.65)' }}>
      <div className="w-full max-w-md rounded-[var(--r-surface)] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <h3 className="tp-section text-[color:var(--surface-dark-900)]">Permanently delete experiment?</h3>
          </div>
          <button onClick={onCancel}><X size={18} className="text-[color:var(--ink-400)]" /></button>
        </div>

        <p className="tp-body font-semibold text-[color:var(--ink-700)] mb-1">"{exp.title}"</p>
        {exp.path_name && <p className="tp-meta text-[color:var(--ink-400)] mb-4">Path: {exp.path_name}</p>}

        {/* Linked record summary */}
        {counts === null ? (
          <div className="tp-body flex items-center gap-2 text-[color:var(--ink-500)] py-3">
            <Loader2 size={14} className="animate-spin" /> Loading linked records…
          </div>
        ) : (
          <div className="rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-4 mb-4 space-y-1">
            <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Linked records</p>
            {[
              { label: 'Missions', count: counts.missions },
              { label: 'Proof of Work', count: counts.proof },
              { label: 'Contacts', count: counts.contacts },
              { label: 'Reflections', count: counts.reflections },
            ].map(({ label, count }) => (
              <div key={label} className="tp-body flex items-center justify-between">
                <span className="text-[color:var(--ink-700)]">{label}</span>
                <span className={`font-bold ${count > 0 ? 'text-[color:var(--surface-dark-900)]' : 'text-[color:var(--ink-400)]'}`}>{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Options */}
        <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Choose what happens to linked records</p>
        <div className="space-y-2 mb-4">
          <button
            onClick={() => { setMode('unlink'); setTyped(''); }}
            className={`w-full text-left rounded-[var(--r-control)] border p-3 transition ${mode === 'unlink' ? 'border-[color:var(--brand-navy-900)] bg-[color:var(--ink-100)]' : 'border-[color:var(--ink-200)] hover:border-[color:var(--ink-300)]'}`}
          >
            <p className="tp-body font-semibold text-[color:var(--surface-dark-900)]">Delete only this experiment</p>
            <p className="tp-meta text-[color:var(--ink-500)] mt-0.5">Missions, proof, contacts, and reflections are kept as unlinked records.</p>
          </button>
          <button
            onClick={() => { setMode('cascade'); setTyped(''); }}
            className={`w-full text-left rounded-[var(--r-control)] border p-3 transition ${mode === 'cascade' ? 'border-red-400 bg-red-50' : 'border-[color:var(--ink-200)] hover:border-[color:var(--ink-300)]'}`}
          >
            <p className="tp-body font-semibold text-red-700">Delete experiment and all linked records</p>
            <p className="tp-meta text-red-500 mt-0.5">This cannot be undone. All missions, proof, contacts, and reflections for this experiment will be permanently removed.</p>
          </button>
        </div>

        {/* Typed confirmation for cascade */}
        {mode === 'cascade' && (
          <div className="mb-4">
            <p className="tp-meta text-[color:var(--ink-500)] mb-1.5">
              Type <strong className="font-mono text-red-600">{cascadeConfirmWord}</strong> to confirm:
            </p>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={cascadeConfirmWord}
              className="w-full rounded-[var(--r-control)] border border-red-200 bg-red-50 px-4 py-2.5 text-base md:text-sm font-mono outline-none focus:border-red-400"
            />
          </div>
        )}

        {/* Actions: Cancel is the default / leftmost */}
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="tp-body flex-1 rounded-[var(--r-control)] border border-[color:var(--ink-200)] py-2.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!canConfirm || deleting || counts === null}
            className="tp-body flex-1 rounded-[var(--r-control)] py-2.5 font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700"
          >
            {deleting ? <span className="flex items-center justify-center gap-1"><Loader2 size={13} className="animate-spin" /> Deleting…</span> : 'Permanently Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}