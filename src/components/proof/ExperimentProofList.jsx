import { Plus } from 'lucide-react';

/**
 * Add proof straight from the experiment it belongs to, rather than starting
 * from one button and picking the experiment afterwards. The flow opens with
 * that experiment already filed, so the first question is skipped.
 */
const STATUS = { draft: 'Draft', planned: 'Planned', in_progress: 'In progress', completed: 'Completed', paused: 'Paused', skipped: 'Skipped' };

export default function ExperimentProofList({ experiments = [], onAdd }) {
  const rows = experiments.filter(e => e.deletion_status !== 'deleted').slice(0, 8);
  if (!rows.length) return null;

  return (
    <section
      className="mb-6 rounded-[var(--r-surface)] p-5"
      style={{ background: 'var(--background-primary)', border: '1px solid var(--border-light)' }}
    >
      <h2 className="tp-card" style={{ color: 'var(--text-primary)' }}>Add proof from an experiment</h2>
      <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
        Pick the experiment you did the work in and go straight to its proof form.
      </p>

      <ul className="mt-4 space-y-2">
        {rows.map(exp => (
          <li
            key={exp.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-control)] p-3"
            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
          >
            <span className="min-w-0 flex-1">
              <span className="tp-body block font-semibold" style={{ color: 'var(--text-primary)' }}>{exp.title}</span>
              <span className="tp-meta block" style={{ color: 'var(--ink-400)' }}>
                {[exp.path_name, STATUS[exp.status] || exp.status].filter(Boolean).join(' · ')}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onAdd(exp)}
              className="tp-meta inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-control)] px-3.5 font-bold text-white"
              style={{ background: 'var(--brand-navy-900)', minHeight: '44px' }}
            >
              <Plus size={14} /> Add proof
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}