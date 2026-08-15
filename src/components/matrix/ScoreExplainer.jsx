import { Link } from 'react-router-dom';
import { X, Plus, Minus, HelpCircle, Users } from 'lucide-react';
import ExpectationBars from '@/components/matrix/ExpectationBars';

/**
 * Why a score is what it is. Everything shown here is projected from the same
 * scored object the matrix rendered, so an explanation can never cite an
 * experiment, conversation or reflection that does not exist.
 */
function Section({ title, children }) {
  return (
    <section className="mt-7">
      <h3 className="tp-section" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const Empty = ({ children }) => (
  <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>{children}</p>
);

export default function ScoreExplainer({ row, onClose }) {
  if (!row) return null;
  const conf = row.confidence;

  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(5,8,22,0.45)' }} role="dialog" aria-modal="true" onClick={onClose}>
      <div className="anim-modal max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-[color:var(--background-primary)] p-6 sm:rounded-[var(--r-surface)] sm:p-8"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Why this score</p>
            <h2 className="tp-page mt-2" style={{ color: 'var(--text-primary)' }}>
              {row.name} is currently {conf.value === null ? row.maturity.label.toLowerCase() : `${conf.value}%`}
            </h2>
            <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{conf.basis}</p>
            {conf.value === null && <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{row.maturity.note}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="touch-target-square ui-press grid place-items-center rounded-[var(--r-control)] p-2 hover:bg-[color:var(--ink-100)]">
            <X size={18} />
          </button>
        </div>

        <Section title="Signals used, and how much each counted">
          {conf.signals.length ? (
            <ul className="space-y-3">
              {conf.signals.map(s => (
                <li key={s.key} className="app-inset p-3.5" style={{ background: 'var(--ink-50)' }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="tp-control" style={{ color: 'var(--text-primary)' }}>{s.label}</p>
                    <p className="tp-meta tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {s.value}% · weight {Math.round(s.weight * 100)}%
                    </p>
                  </div>
                  <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>{s.detail}</p>
                </li>
              ))}
            </ul>
          ) : <Empty>No experienced signals yet, so no confidence percentage is shown.</Empty>}
        </Section>

        <Section title="Evidence strengthening this path">
          {row.strengthening.length ? (
            <ul className="space-y-2">
              {row.strengthening.map((e, i) => (
                <li key={i} className="tp-body flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Plus size={15} className="mt-1 shrink-0" style={{ color: 'var(--success-700)' }} aria-hidden="true" />
                  <span>{e.text} <span style={{ color: 'var(--text-muted)' }}>({e.source})</span></span>
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing yet supports this direction through real work.</Empty>}
        </Section>

        <Section title="Evidence weakening this path">
          {row.weakening.length ? (
            <ul className="space-y-2">
              {row.weakening.map((e, i) => (
                <li key={i} className="tp-body flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Minus size={15} className="mt-1 shrink-0" style={{ color: 'var(--warning-700)' }} aria-hidden="true" />
                  <span>{e.text} <span style={{ color: 'var(--text-muted)' }}>({e.source})</span></span>
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing so far points against this direction.</Empty>}
        </Section>

        <Section title={`Evidence Coverage${row.coverage.value === null ? '' : `: ${row.coverage.value}%`}`}>
          {row.coverage.rows.length ? (
            <>
              {conf.value !== null && row.coverage.value !== null && conf.value >= 70 && row.coverage.value < 40 && (
                <p className="app-inset tp-body mb-3 p-3.5" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }}>
                  Your early experiences have been positive, but there is still substantial uncertainty around this direction.
                </p>
              )}
              <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Tested</p>
              {row.coverage.tested.length ? (
                <ul className="mb-3 mt-2 space-y-1.5">
                  {row.coverage.tested.map(r => (
                    <li key={r.dimension} className="tp-body" style={{ color: 'var(--text-secondary)' }}>
                      ✓ {r.dimension_label} — {r.current_interpretation}
                    </li>
                  ))}
                </ul>
              ) : <Empty>Nothing here has meaningful evidence yet.</Empty>}
              <p className="tp-eyebrow mt-4" style={{ color: 'var(--brand-navy-700)' }}>Still untested</p>
              <ul className="mt-2 space-y-1.5">
                {row.coverage.untested.map(r => (
                  <li key={r.dimension} className="tp-body flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <HelpCircle size={15} className="mt-1 shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                    {r.dimension_label}
                  </li>
                ))}
              </ul>
            </>
          ) : <Empty>We do not yet know which dimensions this direction turns on.</Empty>}
        </Section>

        <Section title={`Experienced Fit${row.fit.value === null ? '' : `: ${row.fit.value}%`}`}>
          {row.fit.inputs.length ? (
            <ul className="space-y-1.5">
              {row.fit.inputs.map((i, idx) => (
                <li key={idx} className="tp-body" style={{ color: 'var(--text-secondary)' }}>
                  {i.label}: <span className="tabular-nums">{i.raw}/10</span> after {i.source}
                </li>
              ))}
            </ul>
          ) : <Empty>Experienced Fit appears once you complete an experiment and rate it afterwards.</Empty>}
        </Section>

        <Section title="Expectation vs Reality"><ExpectationBars expectation={row.expectation} /></Section>

        <Section title={`Human Exposure: ${row.human.count} conversation${row.human.count === 1 ? '' : 's'}`}>
          {row.human.people.length ? (
            <ul className="space-y-3">
              {row.human.people.map(p => (
                <li key={p.id} className="app-inset p-3.5" style={{ background: 'var(--ink-50)' }}>
                  <p className="tp-control flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Users size={14} aria-hidden="true" /> {p.name}
                  </p>
                  <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
                    {[p.role, p.date ? new Date(p.date).toLocaleDateString() : null].filter(Boolean).join(' · ')}
                  </p>
                  {p.learned && <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{p.learned}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <Empty>You haven&apos;t spoken with someone doing this work yet.</Empty>
              <Link to="/evidence?tab=outreach" className="app-cta-secondary tp-control mt-3 inline-flex">Plan a conversation</Link>
            </>
          )}
        </Section>

        <Section title={`Uncertainty Remaining${row.uncertainty.value === null ? '' : `: ${row.uncertainty.value}%`}`}>
          {row.uncertainty.biggest ? (
            <>
              <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Biggest remaining unknown</p>
              <p className="tp-card mt-1.5" style={{ color: 'var(--text-primary)' }}>{row.uncertainty.biggest.question}</p>
              {row.uncertainty.others.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {row.uncertainty.others.map(u => (
                    <li key={u.key} className="tp-body" style={{ color: 'var(--text-secondary)' }}>? {u.label}</li>
                  ))}
                </ul>
              )}
              <Link to="/test" className="app-cta tp-control mt-4 inline-flex">Test the biggest unknown</Link>
            </>
          ) : <Empty>No open unknowns are recorded for this direction right now.</Empty>}
        </Section>

        <p className="tp-meta mt-8" style={{ color: 'var(--text-muted)' }}>
          Scoring version {row.provenance.scoring_version} · {row.provenance.experiment_ids.length} experiments,{' '}
          {row.provenance.evidence_ids.length} evidence records and {row.provenance.human_interaction_ids.length} conversations were read to build this.
        </p>
      </div>
    </div>
  );
}