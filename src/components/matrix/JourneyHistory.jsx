/**
 * Directions set aside, and what testing them taught. Never described as
 * failures: an eliminated hypothesis is a decision reached with evidence, and
 * the evidence it produced still counts everywhere else.
 */
export default function JourneyHistory({ rows }) {
  if (!rows.length) {
    return (
      <p className="tp-body app-card p-6" style={{ color: 'var(--text-secondary)' }}>
        Nothing here yet. Directions you modify or stop pursuing will be kept here with what you learned.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map(row => (
        <article key={row.pathId} className="app-card p-6">
          <p className="tp-card" style={{ color: 'var(--text-primary)' }}>{row.name}</p>
          <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>
            {row.status === 'modified'
              ? 'Changed after what you learned.'
              : 'Learned enough to stop prioritizing this direction.'}
          </p>

          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>What was tested</dt>
              <dd className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                {row.records.completed.length} experiment{row.records.completed.length === 1 ? '' : 's'},{' '}
                {row.records.proof.length} piece{row.records.proof.length === 1 ? '' : 's'} of evidence,{' '}
                {row.human.count} conversation{row.human.count === 1 ? '' : 's'}.
              </dd>
            </div>
            <div>
              <dt className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>What was learned</dt>
              <dd className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                {row.weakening[0]?.text || row.strengthening[0]?.text || 'The record of this direction is kept in your evidence library.'}
              </dd>
            </div>
          </dl>

          {row.coverage.tested.length > 0 && (
            <p className="tp-meta mt-4" style={{ color: 'var(--text-muted)' }}>
              Transferable evidence: {row.coverage.tested.map(r => r.dimension_label).join(', ')}.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}