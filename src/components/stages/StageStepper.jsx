import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { STAGE_ROUTE, stageNeighbours } from '@/lib/cycle-stages';

/**
 * The step either side of the stage you are on. Lives at the foot of every stage
 * screen, including the ones that draw their own page (Prove, Reflect), so the
 * cycle can always be walked forwards and backwards from where you are.
 */
export default function StageStepper({ stage }) {
  const { prev, next } = stageNeighbours(stage);
  return (
    <nav className="mt-12 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-between" style={{ borderColor: 'var(--border-light)' }}>
      {prev ? (
        <Link to={STAGE_ROUTE[prev.key]} className="tp-body inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
          <ArrowLeft size={15} /> {prev.label}
        </Link>
      ) : <span />}
      {next && (
        <Link to={STAGE_ROUTE[next.key]} className="tp-body inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
          {next.label} <ArrowRight size={15} />
        </Link>
      )}
    </nav>
  );
}