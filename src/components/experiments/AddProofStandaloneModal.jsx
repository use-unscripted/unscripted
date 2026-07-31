import AddProofFlow from '@/components/experiments/AddProofFlow';

// Adding proof from the Proof of Work page: nothing is known up front, so the
// flow asks which experiment first.
export default function AddProofStandaloneModal({ onClose, onSaved, preselectedMission, preselectedExperiment }) {
  return (
    <AddProofFlow
      onClose={onClose}
      onSaved={onSaved}
      preselectedMission={preselectedMission}
      preselectedExperiment={preselectedExperiment}
    />
  );
}
