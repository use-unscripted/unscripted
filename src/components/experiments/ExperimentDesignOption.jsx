import { DIFFICULTY_LABELS } from '@/lib/experiment-design';
import { TYPE_BY_ID, effortLabel } from '@/lib/experiment-types';

/**
 * One designed experiment, as offered in the setup picker. Leads with the
 * question it answers, because that is the whole point of running it.
 */
export default function ExperimentDesignOption({ design, selected, onSelect }) {
  return (
    <button onClick={onSelect}
      className="w-full text-left rounded-[var(--r-surface)] border p-4 transition"
      style={selected
        ? { background: 'var(--ink-100)', borderColor: 'var(--brand-navy-900)' }
        : { background: 'white', borderColor: 'var(--ink-200)' }}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: selected ? 'var(--brand-navy-900)' : 'var(--ink-300)' }}>
          {selected && <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--brand-navy-900)' }} />}
        </div>
        <div className="min-w-0">
          {TYPE_BY_ID.get(design.experiment_type) && (
            <p className="tp-meta mb-1 inline-block rounded-full px-2 py-0.5 font-bold"
              style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-700)' }}>
              {TYPE_BY_ID.get(design.experiment_type).label}
            </p>
          )}
          {(design.test_question || design.unresolved_question) && (
            <p className="tp-eyebrow mb-1" style={{ color: 'var(--brand-navy-700)' }}>Answers: {design.test_question || design.unresolved_question}</p>
          )}
          <p className="tp-card text-[color:var(--surface-dark-900)]">{design.title}</p>
          {design.realistic_scenario && (
            <p className="tp-body mt-1.5 text-[color:var(--ink-700)] line-clamp-3 whitespace-pre-line">{design.realistic_scenario}</p>
          )}
          {design.work_characteristics_tested?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {design.work_characteristics_tested.map((c, i) => (
                <span key={i} className="tp-meta rounded-full px-2 py-0.5 text-[color:var(--ink-700)]" style={{ background: 'var(--ink-100)' }}>{c}</span>
              ))}
            </div>
          )}
          <p className="tp-meta mt-2 text-[color:var(--ink-400)]">
            {effortLabel(design.effort) || `~${design.estimated_hours}h`}
            {design.difficulty_level ? ` · ${DIFFICULTY_LABELS[design.difficulty_level]}` : ''}
            {design.deliverable ? ` · Deliverable: ${design.deliverable}` : ''}
          </p>
        </div>
      </div>
    </button>
  );
}