/**
 * Effectiveness per experience.
 *
 * Each row carries its own suppression flag: a rare experiment stays hidden even
 * when the cohort around it is large, because a row backed by two students is a
 * description of those two students.
 */
export default function DiExperimentTable({ rows = [], minStudents = 5 }) {
  const shown = rows.filter(r => !r.suppressed);
  const hidden = rows.length - shown.length;

  return (
    <section className="app-card-flat p-5">
      <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>Experiences</h2>
      <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>
        Completion, evidence, and stored information value per experience.
      </p>

      {shown.length === 0 ? (
        <p className="tp-body mt-3" style={{ color: 'var(--ink-500)' }}>
          No experience has been run by {minStudents} students yet, so there is nothing here to read.
          {hidden > 0 ? ` ${hidden} experience${hidden === 1 ? '' : 's'} are being tracked and stay suppressed until then.` : ''}
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr>
                  {['Experience', 'Students', 'Completed', 'Evidence', 'Reflected', 'Changed view', 'Unknowns closed', 'Expectation gap', 'Info value'].map(h => (
                    <th key={h} className="tp-label border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-500)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.blueprint_key}>
                    <td className="tp-meta border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-900)' }}>
                      {r.blueprint_title || r.test_question || r.blueprint_key}
                    </td>
                    <td className="tp-meta border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)' }}>{r.students_started ?? '—'}</td>
                    <td className="tp-meta border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)' }}>{r.completion_rate ?? '—'}%</td>
                    <td className="tp-meta border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)' }}>{r.evidence_submission_rate ?? '—'}%</td>
                    <td className="tp-meta border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)' }}>{r.reflection_completion_rate ?? '—'}%</td>
                    <td className="tp-meta border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)' }}>{r.pct_changed_understanding ?? '—'}%</td>
                    <td className="tp-meta border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)' }}>{r.average_uncertainties_resolved ?? '—'}</td>
                    <td className="tp-meta border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)' }}>{r.expectation_reality_delta ?? '—'}</td>
                    <td className="tp-meta border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)' }}>{r.information_value_score ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hidden > 0 && (
            <p className="tp-meta mt-3" style={{ color: 'var(--ink-400)' }}>
              {hidden} experience{hidden === 1 ? '' : 's'} suppressed: fewer than {minStudents} students each.
            </p>
          )}
        </>
      )}
    </section>
  );
}