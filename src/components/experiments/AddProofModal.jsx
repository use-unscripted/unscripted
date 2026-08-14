import { X, CheckCircle } from 'lucide-react';
import AddProofFlow from '@/components/experiments/AddProofFlow';

// ── Success Toast ──────────────────────────────────────────────────────────────
export function ProofSuccessToast({ proof, missionTitle, onViewProof, onReturnToMission, onDismiss }) {
  return (
    <div role="alert" aria-live="polite"
      className="fixed bottom-6 right-6 z-[100] max-w-sm w-full rounded-[var(--r-surface)] bg-white border border-green-100 shadow-2xl p-5 flex flex-col gap-3"
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--success-50)' }}>
          <CheckCircle size={20} className="text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="tp-body font-bold text-[color:var(--surface-dark-900)]">Proof saved successfully.</p>
          <p className="tp-meta text-[color:var(--ink-500)] mt-0.5 truncate">{proof.title}</p>
          {missionTitle && <p className="tp-meta text-[color:var(--ink-400)] truncate">Mission: {missionTitle}</p>}
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)]">
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={onViewProof} className="tp-meta flex-1 rounded-[var(--r-control)] py-2.5 font-semibold text-white"
          style={{ background: 'var(--brand-navy-900)' }}>View Proof</button>
        <button onClick={onReturnToMission} className="tp-meta flex-1 rounded-[var(--r-control)] border border-[color:var(--ink-200)] py-2.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
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
