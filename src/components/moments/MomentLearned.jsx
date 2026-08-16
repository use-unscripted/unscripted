import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { outcomeFraming } from '@/lib/dimension-progress';
import MomentNextChoices from '@/components/moments/MomentNextChoices';

/**
 * The end of a Quick Test: what we learned, then an open invitation.
 *
 * A fall in fit is stated as clarity, never as a failure state, and the second
 * test is offered rather than required — returning to the dashboard sits beside
 * it as an equal choice.
 */
export default function MomentLearned({ moment, changes = [], onAnother, nextOptions = [], onPickNext }) {
  const primary = changes[0];
  const delta = primary && typeof primary.deltaFit === 'number'
    ? primary.deltaFit
    : primary && typeof primary.before?.career_fit_score === 'number'
      ? primary.after.career_fit_score - primary.before.career_fit_score
      : null;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <CheckCircle2 className="mx-auto text-green-600" size={36} aria-hidden="true" />
        <h2 className="tp-page mt-3" style={{ color: 'var(--surface-dark-900)' }}>What we learned</h2>
        <p className="tp-body mt-2" style={{ color: 'var(--ink-700)' }}>{outcomeFraming(delta)}</p>
      </div>

      <div className="rounded-[var(--r-surface)] border p-4" style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}>
        <p className="tp-eyebrow" style={{ color: 'var(--ink-500)' }}>From this test</p>
        <ul className="mt-2 space-y-1.5">
          <li className="tp-body" style={{ color: 'var(--ink-700)' }}>
            {moment?.career_name || 'This career'} now has evidence on{' '}
            {(moment?.work_characteristics_tested || []).slice(0, 2).map(c => String(c).toLowerCase()).join(' and ') || 'this dimension'}.
          </li>
          {changes.slice(0, 3).map((c, i) => (
            <li key={i} className="tp-body" style={{ color: 'var(--ink-700)' }}>
              {c.path.path_name}: fit {c.after.career_fit_score}% · confidence {c.after.fit_confidence_score}%
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[var(--r-surface)] border p-4" style={{ borderColor: 'var(--border-light)' }}>
        <p className="tp-body font-semibold" style={{ color: 'var(--surface-dark-900)' }}>Want to test one more thing?</p>
        <p className="tp-meta mt-1" style={{ color: 'var(--ink-500)' }}>
          {nextOptions.length
            ? `Pick what ${moment?.career_name || 'this path'} still needs evidence on. Only if you have the time.`
            : 'Only if you have the time. Nothing is lost by stopping here.'}
        </p>
        {nextOptions.length > 0 && <MomentNextChoices options={nextOptions} onPick={onPickNext} />}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {!nextOptions.length && (
            <button onClick={onAnother}
              className="tp-body ui-press rounded-[var(--r-control)] py-3 font-semibold text-white"
              style={{ background: 'var(--brand-navy-900)' }}>
              Recommended next test
            </button>
          )}
          <Link to="/journey"
            className="tp-body rounded-[var(--r-control)] border py-3 text-center font-semibold"
            style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-700)' }}>
            Return to dashboard
          </Link>
        </div>
        <Link to="/career-profile" className="tp-meta mt-3 inline-block font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
          See all my evidence
        </Link>
      </div>
    </div>
  );
}