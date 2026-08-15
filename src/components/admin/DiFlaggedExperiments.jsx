/**
 * The review queue raised by the post-experiment survey.
 *
 * A flag is a request for a human to look, never a decision: nothing here
 * retires an experiment or lowers its validation level. Counts and themes only,
 * so no individual answer appears on this page.
 */
import { Flag } from 'lucide-react';

const CODE_LABEL = {
  low_realism: 'Repeated low realism',
  low_usefulness: 'Poor usefulness',
  professional_contradiction: 'Professional contradiction',
  repeated_missing_component: 'Repeated missing component',
};

export default function DiFlaggedExperiments({ rows = [] }) {
  return (
    <section className="app-card-flat p-5">
      <h2 className="tp-section flex items-center gap-2" style={{ color: 'var(--ink-900)' }}>
        <Flag size={14} style={{ color: 'var(--warning-700)' }} /> Flagged for review
      </h2>
      <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>
        Raised by student survey responses. Nothing is retired or downgraded automatically.
      </p>

      {rows.length === 0 ? (
        <p className="tp-body mt-3" style={{ color: 'var(--ink-500)' }}>
          No experiment has crossed a review threshold.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map(r => (
            <li key={r.blueprint_key} className="rounded-[var(--r-control)] p-4"
              style={{ background: 'var(--warning-50)', border: '1px solid var(--ink-200)' }}>
              <p className="tp-body font-bold" style={{ color: 'var(--ink-900)' }}>{r.blueprint_title}</p>
              <p className="tp-meta mt-0.5" style={{ color: 'var(--ink-500)' }}>
                {r.survey_responses} response{r.survey_responses === 1 ? '' : 's'}
                {r.experiment_versions?.length ? ` · version ${r.experiment_versions.join(', ')}` : ''}
              </p>
              <ul className="mt-2 space-y-1">
                {r.flags.map((f, i) => (
                  <li key={i} className="tp-meta" style={{ color: 'var(--ink-700)' }}>
                    <span className="font-semibold">{CODE_LABEL[f.code] || f.code}:</span> {f.detail}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}