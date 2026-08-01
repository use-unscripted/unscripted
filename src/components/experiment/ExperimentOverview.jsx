/**
 * The experiment at a glance, plus its own progress. This is the header of the
 * container everything else hangs off.
 */
import { Clock, Target } from 'lucide-react';

export default function ExperimentOverview({ experiment, path, missions }) {
  const done = missions.filter(m => ['completed', 'skipped'].includes(m.status)).length;
  const pct = missions.length ? Math.round((done / missions.length) * 100) : 0;

  return (
    <section className="rounded-[20px] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <p className="text-xs font-bold uppercase tracking-[.12em]" style={{ color: 'var(--brand-navy-700)' }}>
        Active experiment{path?.path_name ? ` · ${path.path_name}` : ''}
      </p>
      <h1 className="font-heading mt-2 text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
        {experiment.title}
      </h1>
      {experiment.objective && (
        <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{experiment.objective}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        {experiment.estimated_hours && <span className="flex items-center gap-1"><Clock size={12} /> ~{experiment.estimated_hours}h</span>}
        <span className="flex items-center gap-1"><Target size={12} /> {done}/{missions.length} missions complete</span>
        {experiment.deadline && <span>Due {new Date(experiment.deadline).toLocaleDateString()}</span>}
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--background-tertiary)' }}>
        <div className="progress-fill h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-gold-500)' }} />
      </div>

      {experiment.expected_learning && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border-light)' }}>
          <p className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--text-muted)' }}>What this should teach you</p>
          <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{experiment.expected_learning}</p>
        </div>
      )}
    </section>
  );
}