/**
 * The cycle in one place: Path → Experiment → Missions → Outreach → Evidence →
 * Reflection → Decision, with dates, counts, clarity movement and the decision.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const DECISION_COPY = {
  continue: { label: 'Continue', next: 'Run a deeper experiment on this path.', to: '/experiments/new' },
  adjust: { label: 'Adjust', next: 'Test a different version of this path.', to: '/experiments/new' },
  stop_and_explore: { label: 'Stop and explore', next: 'Compare your paths again. This one is paused, not deleted.', to: '/paths' },
};

const fmt = (v) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set');

function Line({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t py-2 first:border-t-0" style={{ borderColor: 'var(--border-light)' }}>
      <span className="tp-meta font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="tp-body text-right font-bold" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

export default function CycleSummary({ ctx, reflection, decision, closedCycle }) {
  const d = DECISION_COPY[decision] || null;
  const pathName = ctx.path?.path_name || ctx.experiment.path_name || 'Your path';
  const chain = [pathName, ctx.experiment.title, `${ctx.completedMissions.length} missions`, `${ctx.outreach.length} conversations`, `${ctx.proof.length} evidence`, 'Reflection', d?.label || 'Decision'];
  const started = closedCycle?.started_at || ctx.cycle?.started_at || ctx.experiment.created_date;
  const completed = closedCycle?.completed_at || new Date().toISOString();
  const baseline = reflection?.baseline_clarity_score ?? ctx.baselineClarity;
  const final = reflection?.clarity_score;

  return (
    <section className="rounded-[20px] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Cycle summary</h2>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        {chain.map((step, i) => (
          <span key={i} className="tp-meta flex items-center gap-2 font-bold" style={{ color: 'var(--brand-navy-700)' }}>
            {step}
            {i < chain.length - 1 && <ArrowRight size={11} style={{ color: 'var(--text-muted)' }} />}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <Line label="Started" value={fmt(started)} />
        <Line label="Completed" value={fmt(completed)} />
        <Line label="Missions completed" value={`${ctx.completedMissions.length} of ${ctx.missions.length}`} />
        <Line label="Proof created" value={ctx.proof.length} />
        <Line label="Professional conversations" value={ctx.outreach.length} />
        <Line label="Clarity" value={`${baseline ?? 'Not set'} → ${final ?? 'Not set'}`} />
        <Line label="Final decision" value={d?.label || 'Not set'} />
      </div>

      {d && (
        <div className="mt-4 rounded-[14px] p-4" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
          <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>Next: {d.next}</p>
          <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Your next cycle starts from what you just learned: clarity, path and records all carried over.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              to={decision === 'stop_and_explore' ? '/paths' : `/experiments/new${pathName ? `?pathName=${encodeURIComponent(pathName)}` : ''}`}
              className="ui-press inline-flex items-center rounded-[10px] px-5 py-3 text-sm font-bold text-white"
              style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
            >
              {decision === 'stop_and_explore' ? 'Compare my paths' : 'Set up my next experiment'}
            </Link>
            <Link to="/journey" className="inline-flex items-center text-sm font-bold" style={{ color: 'var(--brand-navy-700)' }}>
              Back to My Journey
            </Link>
          </div>
        </div>
      )}

      <p className="tp-meta mt-5 text-center" style={{ color: 'var(--text-muted)' }}>
        Everything from this cycle stays in{' '}
        <Link to="/evidence?tab=proof" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>your history</Link>.
      </p>
    </section>
  );
}