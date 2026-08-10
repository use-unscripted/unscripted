import { FlaskConical, HelpCircle } from 'lucide-react';
import { HYPOTHESIS_STATUS_LABELS } from '@/lib/career-hypothesis';
import CareerUncertaintyMap from '@/components/paths/CareerUncertaintyMap';
import FitBreakdown from '@/components/paths/FitBreakdown';

function ScoreBar({ label, value, hint, color }) {
  return (
    <div className="flex-1 min-w-[140px]">
      <div className="tp-meta flex items-baseline justify-between text-[color:var(--ink-500)]">
        <span>{label}</span>
        <span className="font-heading text-lg font-bold text-[color:var(--surface-dark-900)]">{value}%</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full overflow-hidden bg-[color:var(--ink-100)]">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <p className="tp-meta mt-1.5 text-[color:var(--ink-400)]">{hint}</p>
    </div>
  );
}

function Bullets({ title, items, render }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="tp-body flex gap-2 text-[color:var(--ink-700)]">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--brand-navy-700)' }} />
            <span>{render(it)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The hypothesis view of a path: what we think, how sure we are, and what we
 * still need to learn. Deliberately written as an open question, not a verdict.
 */
export default function CareerHypothesisPanel({ pathName, hypothesis }) {
  const h = hypothesis;
  return (
    <section className="rounded-[20px] p-5" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
          <FlaskConical size={12} /> Career hypothesis
        </span>
        <span className="tp-meta rounded-full px-2.5 py-0.5 font-bold" style={{ background: 'white', color: 'var(--brand-navy-900)' }}>
          {HYPOTHESIS_STATUS_LABELS[h.hypothesis_status] || 'Suggested'}
        </span>
      </div>

      <p className="tp-body mt-2 font-semibold text-[color:var(--surface-dark-900)]">{pathName}</p>
      <p className="tp-meta mt-1 text-[color:var(--ink-500)]">
        This looks worth testing based on what we know about you so far. It is not a verdict.
      </p>

      <div className="mt-4 flex flex-wrap gap-5">
        <ScoreBar
          label="Current fit"
          value={h.career_fit_score}
          hint="How promising this looks right now."
          color="var(--brand-navy-900)"
        />
        <ScoreBar
          label="Confidence in estimate"
          value={h.fit_confidence_score}
          hint="How much real evidence sits behind that number."
          color="var(--brand-gold-600)"
        />
      </div>

      {/* Ability and enjoyment, kept separate from the overall number above. */}
      <FitBreakdown fit={h.fit} overall={h.career_fit_score} evidenceShare={h.fit_evidence_share} />

      <div className="mt-5 space-y-4">
        {h.why_this_may_fit && (
          <div>
            <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Why this may fit you</p>
            <p className="tp-body text-[color:var(--ink-700)]">{h.why_this_may_fit}</p>
          </div>
        )}

        <Bullets
          title="Evidence supporting this"
          items={h.supporting_evidence}
          render={(it) => (
            <>
              {it.text}
              {it.source && <span className="tp-meta text-[color:var(--ink-400)]"> — {it.source}</span>}
            </>
          )}
        />

        <Bullets
          title="Evidence against this"
          items={h.contradicting_evidence}
          render={(it) => (
            <>
              {it.text}
              {it.source && <span className="tp-meta text-[color:var(--ink-400)]"> — {it.source}</span>}
            </>
          )}
        />

        {h.unresolved_questions?.length > 0 && (
          <div className="rounded-xl bg-white p-4" style={{ border: '1px solid var(--border-light)' }}>
            <p className="tp-eyebrow mb-2 flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
              <HelpCircle size={12} /> What we still need to learn
            </p>
            {h.uncertainty?.biggest_question && (
              <p className="tp-meta mb-2 text-[color:var(--ink-500)]">
                Biggest remaining question: {h.uncertainty.biggest_question}
              </p>
            )}
            <ul className="space-y-2">
              {h.unresolved_questions.map((q, i) => (
                <li key={i}>
                  <p className="tp-body font-semibold text-[color:var(--ink-700)]">{q.question}</p>
                  {q.why_it_matters && <p className="tp-meta text-[color:var(--ink-400)]">{q.why_it_matters}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <CareerUncertaintyMap map={h.uncertainty} />
      </div>
    </section>
  );
}