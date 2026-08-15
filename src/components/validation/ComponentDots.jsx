/**
 * The four validation components, each as countable dots. The labels are the
 * scoring categories themselves, so nothing about the score is hidden.
 */
const LABELS = {
  source_grounding: 'Source grounding',
  professional_validation: 'Professional review',
  role_realism: 'Career realism',
  dimension_mapping: 'Dimension mapping',
  field_calibration: 'Field calibration',
};

const DOTS = 4;

export default function ComponentDots({ strength }) {
  return (
    <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {Object.keys(LABELS).map(key => {
        const max = strength.component_max[key] || 1;
        const filled = Math.round((strength.component_scores[key] / max) * DOTS);
        return (
          <li key={key} className="flex items-center justify-between gap-3">
            <span className="tp-meta" style={{ color: 'var(--text-secondary)' }}>{LABELS[key]}</span>
            <span className="flex items-center gap-1" aria-label={`${filled} of ${DOTS}`}>
              {Array.from({ length: DOTS }).map((_, i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full"
                  style={{ background: i < filled ? 'var(--brand-gold-600)' : 'var(--ink-200)' }}
                />
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}