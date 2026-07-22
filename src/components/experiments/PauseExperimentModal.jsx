import { useState } from 'react';
import { X, PauseCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function PauseExperimentModal({ exp, onClose, onPaused }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePause = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const historyEntry = {
      from_status: exp.status,
      to_status: 'paused',
      changed_at: now,
      reason: reason || null,
    };
    await base44.entities.Experiments.update(exp.id, {
      status: 'paused',
      paused_at: now,
      pause_reason: reason || null,
      status_history: [...(exp.status_history || []), historyEntry],
    });
    setSaving(false);
    onPaused({ ...exp, status: 'paused', paused_at: now, pause_reason: reason });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <PauseCircle size={20} className="text-[#B45309]" />
            <h3 className="font-heading text-lg font-bold text-[#050816]">Pause this experiment?</h3>
          </div>
          <button onClick={onClose}><X size={18} className="text-[#94A3B8]" /></button>
        </div>

        {exp.title && <p className="text-sm font-semibold text-[#334155] mb-3">"{exp.title}"</p>}

        <p className="text-sm text-[#64748B] mb-4">
          Your missions, Mission Guides, proof, contacts, and reflections will remain saved. You can resume this experiment at any time.
        </p>

        <label className="block mb-5">
          <span className="text-sm font-semibold text-[#334155] block mb-1">
            Why are you pausing this experiment? <span className="font-normal text-[#94A3B8]">(optional)</span>
          </span>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Focusing on a different path for now, need more time..."
            className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#1F3A5F] resize-none"
          />
        </label>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] transition">
            Cancel
          </button>
          <button onClick={handlePause} disabled={saving}
            className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: '#B45309' }}>
            {saving ? 'Pausing…' : 'Pause Experiment'}
          </button>
        </div>
      </div>
    </div>
  );
}