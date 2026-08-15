import { STAGE_INDEX, STAGES } from '@/lib/journey';
import { stageMeta } from '@/lib/cycle-stages';
import StageStepper from '@/components/stages/StageStepper';

/**
 * One stage, one screen. The shell says which step of the cycle you are on and
 * what question it answers, carries only that stage's work, and ends with the
 * step either side of it.
 */
export default function StageShell({ stage, children }) {
  const meta = stageMeta(stage);
  const step = (STAGE_INDEX[stage] ?? 0) + 1;

  return (
    <main className="app-page">
      <header className="mb-8">
        <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
          Step {step} of {STAGES.length}
        </p>
        <h1 className="tp-page mt-2" style={{ color: 'var(--text-primary)' }}>{meta?.label}</h1>
        <p className="tp-lead mt-3" style={{ color: 'var(--text-secondary)', maxWidth: '48ch' }}>
          {meta?.question}
        </p>
      </header>

      <div className="app-stack">{children}</div>

      <StageStepper stage={stage} />
    </main>
  );
}