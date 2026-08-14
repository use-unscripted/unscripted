/**
 * One block of the Decision Intelligence dashboard.
 *
 * Renders whatever the server computed, including its suppression state. It
 * deliberately has no idea what any particular metric means: a suppressed cell
 * has no numbers to render, and everything else is a labelled value, so a new
 * metric on the server appears here without a UI change and cannot be shown
 * without its sample size.
 */
const LABELS = {
  most_unresolved: 'Most unresolved dimensions',
  most_tested: 'Most frequently tested dimensions',
  most_conflicting: 'Most conflicting evidence',
  most_transferable: 'Most transferable dimensions',
  rules: 'By recommendation rule',
  by_outcome: 'By evidence outcome',
  by_decision: 'By student decision',
};

const label = (k) => LABELS[k] || k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function Value({ value }) {
  if (value === null || value === undefined || value === '') return <span style={{ color: 'var(--ink-400)' }}>Not recorded</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'number' || typeof value === 'string') return <span>{value}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span style={{ color: 'var(--ink-400)' }}>None yet</span>;
    return (
      <ul className="mt-1 space-y-1">
        {value.map((row, i) => (
          <li key={i} className="tp-meta" style={{ color: 'var(--ink-700)' }}>
            {typeof row === 'object'
              ? Object.entries(row).map(([k, v]) => `${label(k)}: ${v}`).join(' · ')
              : String(row)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="mt-1 space-y-1">
      {Object.entries(value).map(([k, v]) => (
        <li key={k} className="tp-meta" style={{ color: 'var(--ink-700)' }}>{label(k)}: {String(v)}</li>
      ))}
    </ul>
  );
}

export default function DiSection({ title, cell, alwaysOpen = false }) {
  if (!cell) return null;
  const { suppressed, students, reason, ...rest } = cell;

  return (
    <section className="app-card-flat p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>{title}</h2>
        {typeof students === 'number' && (
          <span className="tp-meta rounded-full px-2.5 py-1 font-semibold" style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}>
            {students} student{students === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {suppressed && !alwaysOpen ? (
        <p className="tp-body mt-3" style={{ color: 'var(--ink-500)' }}>
          Not enough data yet. {reason} Nothing is shown rather than a number that could point at one student.
        </p>
      ) : (
        <dl className="mt-3 space-y-3">
          {Object.entries(rest).map(([k, v]) => (
            <div key={k}>
              <dt className="tp-label" style={{ color: 'var(--ink-500)' }}>{label(k)}</dt>
              <dd className="tp-body" style={{ color: 'var(--ink-900)' }}><Value value={v} /></dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}