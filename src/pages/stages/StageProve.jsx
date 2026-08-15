import ProofOfWorkPage from '@/pages/ProofOfWorkPage';
import StageStepper from '@/components/stages/StageStepper';

/** Prove: the evidence this cycle produced. The proof page IS this stage. */
export default function StageProve() {
  return (
    <div>
      <ProofOfWorkPage />
      <div className="app-page pt-0">
        <StageStepper stage="prove" />
      </div>
    </div>
  );
}