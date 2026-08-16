import { X, Check, Circle, ExternalLink } from 'lucide-react';
import { effectivenessGate, NOT_ENOUGH_DATA } from '@/lib/effectiveness-thresholds';
import { safeExternalUrl } from '@/lib/safe-url';
import ComponentDots from '@/components/validation/ComponentDots';

/**
 * "How was this experiment validated?" — every claim on this panel is read from
 * a stored record. A source is only shown when it was actually verified and
 * marked publicly viewable, and field statistics are withheld entirely below the
 * minimum sample size.
 */
function Row({ met, children }) {
  const Icon = met ? Check : Circle;
  return (
    <li className="tp-body flex gap-2" style={{ color: 'var(--text-secondary)' }}>
      <Icon size={15} className="mt-0.5 shrink-0" style={{ color: met ? 'var(--success-700)' : 'var(--text-muted)' }} aria-hidden="true" />
      {children}
    </li>
  );
}

export default function HowValidatedPanel({ reading, onClose }) {
  const { strength, sources = [], reviews = [], blueprint, effectiveness } = reading;
  const publicSources = sources.filter(s => s.source_verified_at && s.publicly_viewable && s.active_status !== 'retired');
  const approved = reviews.filter(r => r.approval_status === 'approved');
  /* Gated on students who COMPLETED it, not students who started: a completion
     rate computed from zero completions is an absence of data, not a result. */
  const fieldGate = effectivenessGate({
    students_completed: Number(effectiveness?.students_completed) || 0,
    survey_responses: Number(effectiveness?.survey_responses) || 0,
    audience: 'student_facing',
  });
  const showField = !fieldGate.suppressed;

  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(5,8,22,0.45)' }} role="dialog" aria-modal="true" onClick={onClose}>
      <div className="anim-modal max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-[color:var(--background-primary)] p-6 sm:rounded-[var(--r-surface)] sm:p-8"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>How this was validated</p>
            <h2 className="tp-page mt-2" style={{ color: 'var(--text-primary)' }}>
              {strength.validation_level_meta.label}
            </h2>
            <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{strength.validation_level_meta.note}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="touch-target-square ui-press grid place-items-center rounded-[var(--r-control)] p-2 hover:bg-[color:var(--ink-100)]">
            <X size={18} />
          </button>
        </div>

        <ComponentDots strength={strength} />

        <section className="mt-7">
          <h3 className="tp-section" style={{ color: 'var(--text-primary)' }}>Source grounding</h3>
          <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
            {strength.verified_source_count
              ? `Mapped to ${strength.verified_source_count} verified occupational and current-market source${strength.verified_source_count === 1 ? '' : 's'}${blueprint?.career_title ? ` for ${blueprint.career_title}` : ''}.`
              : 'This experiment has not yet been mapped to verified sources.'}
          </p>
          {publicSources.length > 0 && (
            <ul className="mt-3 space-y-2">
              {publicSources.map(s => {
                const href = safeExternalUrl(s.source_url);
                return (
                  <li key={s.id} className="tp-meta flex items-center justify-between gap-3">
                    <span style={{ color: 'var(--text-secondary)' }}>{s.source_name}</span>
                    {href && (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 font-bold" style={{ color: 'var(--brand-navy-700)' }}>
                        View <ExternalLink size={10} className="inline" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-7">
          <h3 className="tp-section" style={{ color: 'var(--text-primary)' }}>Professional review</h3>
          <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
            {approved.length
              ? `Reviewed by ${approved.length} professional${approved.length === 1 ? '' : 's'} with relevant industry experience.`
              : 'No professional has reviewed this current version yet.'}
          </p>
          {strength.rereview_pending && (
            <p className="tp-body mt-2" style={{ color: 'var(--warning-700)' }}>
              This experiment was materially updated. {strength.superseded_review_count
                ? `${strength.superseded_review_count} earlier review${strength.superseded_review_count === 1 ? '' : 's'} of the previous version remain on file, but no longer apply to this one.`
                : 'Earlier reviews no longer apply to this version.'} A professional re-review is pending.
            </p>
          )}
          {approved.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {approved.map(r => (
                <li key={r.id} className="tp-meta" style={{ color: 'var(--text-muted)' }}>
                  {/* Identity only where the reviewer allowed it. */}
                  {(r.share_identity && r.reviewer_display) || r.reviewer_role || 'Verified professional'}
                  {r.relevant_experience ? ` · ${r.relevant_experience}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-7">
          <h3 className="tp-section" style={{ color: 'var(--text-primary)' }}>Where the score comes from</h3>
          <ul className="mt-2 space-y-1.5">
            {strength.reasons.map((r, i) => <Row key={i} met={r.met}>{r.text}</Row>)}
          </ul>
        </section>

        <section className="mt-7">
          <h3 className="tp-section" style={{ color: 'var(--text-primary)' }}>Field data</h3>
          {showField ? (
            <ul className="mt-2 space-y-1.5">
              <li className="tp-body" style={{ color: 'var(--text-secondary)' }}>
                Completed by {effectiveness.students_completed || 0} students.
              </li>
              {typeof effectiveness.pct_changed_understanding === 'number' && (
                <li className="tp-body" style={{ color: 'var(--text-secondary)' }}>
                  {Math.round(effectiveness.pct_changed_understanding)}% reported that it helped them better understand
                  this aspect of the career.
                </li>
              )}
            </ul>
          ) : (
            <p className="tp-body mt-2" style={{ color: 'var(--text-muted)' }}>
              {NOT_ENOUGH_DATA} We do not show results until {fieldGate.required.min_students_completed} students
              have completed this experiment.
            </p>
          )}
        </section>

        <p className="tp-meta mt-8" style={{ color: 'var(--text-muted)' }}>
          Scoring version {strength.scoring_version}
          {strength.last_reviewed_at ? ` · Last reviewed ${new Date(strength.last_reviewed_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}` : ''}
        </p>
      </div>
    </div>
  );
}