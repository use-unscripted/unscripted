/**
 * One validated library experiment, with everything a student needs to compare
 * it against the others: how well validated it is, how much it would teach
 * them, how long it takes, and what it cannot tell them.
 */
import { Clock, ShieldCheck, Target, AlertTriangle, Users, CheckCircle2 } from 'lucide-react';

const Fact = ({ label, children }) => (
  <div>
    <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>{label}</p>
    <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</p>
  </div>
);

export default function LibraryExperimentCard({ row, bestNext, bestValidated, onStart, busy }) {
  const { template, strength, value, minutes, minutesLow, coverage, coveredCount, importantCount, notRepresented, reviewerCount } = row;
  const time = minutesLow && minutes ? `${minutesLow}-${minutes} min` : minutes ? `about ${minutes} min` : template.effort;

  return (
    <article className="app-card-flat p-5">
      {(bestNext || bestValidated) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {bestNext && (
            <span className="tp-meta rounded-full px-2.5 py-1 font-semibold" style={{ background: 'var(--brand-gold-500)', color: 'var(--brand-navy-900)' }}>
              Best next test for you
            </span>
          )}
          {bestValidated && (
            <span className="tp-meta rounded-full px-2.5 py-1 font-semibold" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>
              Best validated
            </span>
          )}
        </div>
      )}

      <h3 className="tp-section" style={{ color: 'var(--text-primary)' }}>{template.title}</h3>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{template.test_question}</p>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{template.why_it_matters}</p>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Fact label="Experiment strength">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={14} style={{ color: 'var(--brand-navy-700)' }} />
            {strength.score === null ? strength.level_label : `${strength.score} · ${strength.level_label}`}
          </span>
        </Fact>
        <Fact label="Value for you now">
          <span className="inline-flex items-center gap-1.5">
            <Target size={14} style={{ color: 'var(--brand-navy-700)' }} />
            {value.score === null ? 'Unclear' : `${value.score} · ${value.level_label}`}
          </span>
        </Fact>
        <Fact label="Estimated time">
          <span className="inline-flex items-center gap-1.5"><Clock size={14} style={{ color: 'var(--brand-navy-700)' }} />{time}</span>
        </Fact>
        <Fact label="Validation level">{strength.validation_level_meta.label}</Fact>
        <Fact label="Professional review">
          {reviewerCount ? `${reviewerCount} reviewer${reviewerCount === 1 ? '' : 's'}` : 'None yet'}
        </Fact>
        <Fact label="New unknowns tested">
          {value.known ? `${value.new_unknowns || 0} of ${(value.tested?.length || 0) + (value.untested?.length || 0)}` : 'Unknown'}
        </Fact>
      </div>

      <div className="mt-4">
        <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>Dimensions tested</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(template.decision_dimension_ids || []).map(d => (
            <span key={d} className="tp-meta rounded-full px-2 py-0.5" style={{ background: 'var(--ink-100)', color: 'var(--ink-700)' }}>
              {d.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>

      {coverage !== null && (
        <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
          Career coverage: {coveredCount} of {importantCount} important characteristics of this career ({coverage}%).
        </p>
      )}

      {value.reasons?.length > 0 && (
        <div className="app-inset mt-4 p-3" style={{ background: 'var(--info-50)' }}>
          <p className="tp-meta font-semibold" style={{ color: 'var(--info-700)' }}>Why this test?</p>
          <ul className="mt-1.5 space-y-1">
            {value.reasons.slice(0, 3).map((r, i) => (
              <li key={i} className="tp-body" style={{ color: 'var(--ink-700)' }}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {template.evidence_required?.length > 0 && (
        <div className="mt-4">
          <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>Evidence required</p>
          <ul className="mt-1 space-y-1">
            {template.evidence_required.map((e, i) => (
              <li key={i} className="tp-body flex gap-1.5" style={{ color: 'var(--ink-700)' }}>
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--success-700)' }} />{e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {template.human_component && (
        <p className="tp-body mt-3 flex gap-1.5" style={{ color: 'var(--ink-700)' }}>
          <Users size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-navy-700)' }} />
          {template.human_component}
        </p>
      )}

      {notRepresented?.length > 0 && (
        <div className="app-inset mt-4 p-3" style={{ background: 'var(--warning-50)' }}>
          <p className="tp-meta flex items-center gap-1.5 font-semibold" style={{ color: 'var(--warning-700)' }}>
            <AlertTriangle size={13} /> What this cannot tell you
          </p>
          <p className="tp-body mt-1" style={{ color: 'var(--ink-700)' }}>{notRepresented.slice(0, 4).join(' · ')}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onStart(row)}
        disabled={busy}
        className="ui-press app-cta tp-control mt-5 w-full"
        style={{ minHeight: 48, opacity: busy ? 0.6 : 1 }}
      >
        {busy ? 'Setting up…' : 'Use this test'}
      </button>
    </article>
  );
}