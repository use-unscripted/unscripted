import { X, CheckCircle } from 'lucide-react';
import AddProofFlow from '@/components/experiments/AddProofFlow';

// ── Success Toast ──────────────────────────────────────────────────────────────
export function ProofSuccessToast({ proof, missionTitle, onViewProof, onReturnToMission, onDismiss }) {
  return (
    <div role="alert" aria-live="polite"
      className="fixed bottom-6 right-6 z-[100] max-w-sm w-full rounded-[20px] bg-white border border-green-100 shadow-2xl p-5 flex flex-col gap-3"
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#F0FDF4' }}>
          <CheckCircle size={20} className="text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#050816]">Proof saved successfully.</p>
          <p className="text-xs text-[#64748B] mt-0.5 truncate">{proof.title}</p>
          {missionTitle && <p className="text-xs text-[#94A3B8] truncate">Mission: {missionTitle}</p>}
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-[#94A3B8] hover:text-[#334155]">
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={onViewProof} className="flex-1 rounded-[8px] py-2 text-xs font-semibold text-white"
          style={{ background: 'var(--brand-navy-900)' }}>View Proof</button>
        <button onClick={onReturnToMission} className="flex-1 rounded-[8px] border border-[#E2E8F0] py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]">
          Return to Mission
        </button>
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
// Adding proof from a mission: the mission and its experiment are already known,
// so the flow skips the "which experiment" question and looks nothing up.
export default function AddProofModal({ mission, experiment, onClose, onSaved }) {
  return (
    <AddProofFlow
      onClose={onClose}
      onSaved={onSaved}
      preselectedMission={mission}
      preselectedExperiment={experiment}
    />
  );
}
