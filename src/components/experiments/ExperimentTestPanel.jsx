import { FlaskConical } from 'lucide-react';
import { DIFFICULTY_LABELS } from '@/lib/experiment-design';

/**
 * What this experiment is testing, shown on an experiment that was designed
 * against a career hypothesis. Legacy experiments have none of these fields and
 * render nothing.
 */
export default function ExperimentTestPanel({ exp }) {
  const chars = exp.work_characteristics_tested || [];
  if (!exp.unresolved_question && !exp.realistic_scenario && !chars.length) return null;

  return (
    <section className="rounded-[16px] p-4 space-y-3" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}>
      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
        <FlaskConical size={12} /> What this tests
      </p>

      {(exp.career_name || exp.path_name) && (
        <p className="tp-meta text-[color:var(--ink-500)]">
          Career being tested: <strong className="text-[color:var(--surface-dark-900)]">{exp.career_name || exp.path_name}</strong>
          {exp.difficulty_level && <> · {DIFFICULTY_LABELS[exp.difficulty_level] || exp.difficulty_level}</>}
          {exp.estimated_hours ? <> · about {exp.estimated_hours}h</> : null}
        </p>
      )}

      {exp.unresolved_question && (
        <div>
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-1">The question this answers</p>
          <p className="tp-body text-[color:var(--ink-700)]">{exp.unresolved_question}</p>
        </div>
      )}

      {exp.realistic_scenario && (
        <div className="rounded-xl bg-white p-3" style={{ border: '1px solid var(--border-light)' }}>
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-1">The situation</p>
          <p className="tp-body whitespace-pre-line text-[color:var(--ink-700)]">{exp.realistic_scenario}</p>
        </div>
      )}

      {exp.instructions?.length > 0 && (
        <div>
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-1.5">Your task</p>
          <ol className="space-y-1.5">
            {exp.instructions.map((s, i) => (
              <li key={i} className="tp-body flex gap-2.5 text-[color:var(--ink-700)]">
                <span className="shrink-0 font-bold" style={{ color: 'var(--brand-navy-900)' }}>{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {chars.length > 0 && (
        <div>
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-1.5">What you will learn about yourself</p>
          <div className="flex flex-wrap gap-2">
            {chars.map((c, i) => (
              <span key={i} className="tp-meta rounded-full bg-white px-2.5 py-1 text-[color:var(--ink-700)]" style={{ border: '1px solid var(--border-light)' }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {exp.evaluation_criteria?.length > 0 && (
        <div>
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-1.5">What a strong response looks like</p>
          <ul className="space-y-1">
            {exp.evaluation_criteria.map((c, i) => (
              <li key={i} className="tp-body text-[color:var(--ink-700)]">· {c}</li>
            ))}
          </ul>
        </div>
      )}

      {exp.evidence_expected && (
        <p className="tp-meta text-[color:var(--ink-500)]">Evidence from finishing this: {exp.evidence_expected}</p>
      )}
    </section>
  );
}