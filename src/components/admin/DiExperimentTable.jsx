import { INSUFFICIENT_SAMPLE, NOT_ENOUGH_DATA } from '@/lib/effectiveness-thresholds';

/**
 * Effectiveness per experience.
 *
 * Two separate gates, deliberately:
 *  - Privacy (`r.suppressed`): a row backed by fewer than MIN_STUDENTS students
 *    is a description of those students, so it is not listed at all.
 *  - Sample (`r.effectiveness_suppressed`): the row is listed and its raw counts
 *    are readable, but every derived rate is withheld and the row is labelled
 *    Insufficient Sample. This is what stops "0% evidence submitted" from a row
 *    where nobody finished reading as a finding about the experiment.
 */
function Cell({ children }) {
  return (
    <td className="tp-meta border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)' }}>{children}</td>
  );
}

/** A rate, or an explicit nothing. Never a 0% built on a zero denominator. */
function Rate({ value, thin }) {
  if (thin || value === null || value === undefined) {
    return <Cell><span style={{ color: 'var(--ink-400)' }}>-</span></Cell>;
  }
  return <Cell>{value}%</Cell>;
}

function Num({ value, thin }) {
  if (thin || value === null || value === undefined) {
    return <Cell><span style={{ color: 'var(--ink-400)' }}>-</span></Cell>;
  }
  return <Cell>{value}</Cell>;
}

export default function DiExperimentTable({ rows = [], minStudents = 5, thresholds = null }) {
  const shown = rows.filter(r => !r.suppressed);
  const hidden = rows.length - shown.length;
  const thin = shown.filter(r => r.effectiveness_suppressed);
  const adminMin = thresholds?.admin?.min_students_completed ?? 5;
  const adminSurveyMin = thresholds?.admin?.min_survey_responses ?? 4;

  return (
    <section className="app-card-flat p-5">
      <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>Experiences</h2>
      <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>
        Completion, evidence, and stored information value per experience. Rates need
        {' '}{adminMin} students who completed it and {adminSurveyMin} survey responses; below that the
        counts are shown and the conclusions are not.
      </p>

      {shown.length === 0 ? (
        <p className="tp-body mt-3" style={{ color: 'var(--ink-500)' }}>
          No experience has been run by {minStudents} students yet, so there is nothing here to read.
          {hidden > 0 ? ` ${hidden} experience${hidden === 1 ? '' : 's'} are being tracked and stay suppressed until then.` : ''}
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr>
                  {['Experience', 'Sample', 'Started', 'Completed', 'Surveys', 'Completed %', 'Evidence', 'Reflected', 'Changed view', 'Unknowns closed', 'Expectation gap', 'Info value', 'Realism', 'Worth the time'].map(h => (
                    <th key={h} className="tp-label border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-500)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const isThin = Boolean(r.effectiveness_suppressed);
                  return (
                    <tr key={r.blueprint_key}>
                      <td className="tp-meta border-b px-2 py-2" style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-900)' }}>
                        {r.blueprint_title || r.test_question || r.blueprint_key}
                      </td>
                      {/* The label sits on the row itself, so a reader cannot pick
                          up a number without seeing that it carries no conclusion. */}
                      <Cell>
                        {isThin ? (
                          <span className="rounded-full px-2 py-0.5 font-semibold"
                            style={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }}
                            title={(r.suppression_reasons || []).join(' ')}>
                            {INSUFFICIENT_SAMPLE}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--success-700)' }}>Sufficient</span>
                        )}
                      </Cell>
                      {/* Raw counts stay readable at every sample size. */}
                      <Num value={r.students_started} />
                      <Num value={r.students_completed} />
                      <Num value={r.survey_responses} />
                      <Rate value={r.completion_rate} thin={isThin} />
                      <Rate value={r.evidence_submission_rate} thin={isThin} />
                      <Rate value={r.reflection_completion_rate} thin={isThin} />
                      <Rate value={r.pct_changed_understanding} thin={isThin} />
                      <Num value={r.average_uncertainties_resolved} thin={isThin} />
                      <Num value={r.expectation_reality_delta} thin={isThin} />
                      <Num value={r.information_value_score} thin={isThin} />
                      <Num value={r.survey_realism_rating} thin={isThin} />
                      <Num value={r.survey_time_value_rating} thin={isThin} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {thin.length > 0 && (
            <p className="tp-meta mt-3" style={{ color: 'var(--warning-700)' }}>
              {NOT_ENOUGH_DATA} {thin.length} experience{thin.length === 1 ? '' : 's'} shown with counts only:
              {' '}below {adminMin} completions or {adminSurveyMin} survey responses, so no rate, average or
              conclusion is reported for them. None of them may be called effective, high-performing,
              high-realism or field calibrated.
            </p>
          )}
          {hidden > 0 && (
            <p className="tp-meta mt-2" style={{ color: 'var(--ink-400)' }}>
              {hidden} experience{hidden === 1 ? '' : 's'} suppressed: fewer than {minStudents} students each.
            </p>
          )}
        </>
      )}
    </section>
  );
}