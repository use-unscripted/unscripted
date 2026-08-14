import { FlaskConical, HelpCircle } from 'lucide-react';
import { HYPOTHESIS_STATUS_LABELS, HYPOTHESIS_STATUS_MEANING, NOT_YET_ASSESSED } from '@/lib/career-hypothesis';
import CareerUncertaintyMap from '@/components/paths/CareerUncertaintyMap';
import HypothesisDimensions from '@/components/paths/HypothesisDimensions';
import FitBreakdown from '@/components/paths/FitBreakdown';
import DimensionProgress from '@/components/paths/DimensionProgress';
import NextTestCard from '@/components/paths/NextTestCard';
import { dimensionProgress, nextTestForPath } from '@/lib/dimension-progress';
import LanguageLevelControl from '@/components/language/LanguageLevelControl';
import useLanguageLevel from '@/hooks/useLanguageLevel';

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
export default function CareerHypothesisPanel({ pathName, hypothesis, path, signals = [], profile = {} }) {
  const h = hypothesis;
  // Which dimensions of this career already have evidence, and which one is
  // worth testing next. Both read the uncertainty map that already exists.
  // Language level for this path specifically, so a student can be fluent in one
  // field and new to another.
  const language = useLanguageLevel({ path });
  const progress = dimensionProgress({ hypothesis: h, signals });
  const nextTest = progress ? nextTestForPath({ path, hypothesis: h, progress }) : null;
  return (
    <section className="rounded-[var(--r-surface)] p-5" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
          <FlaskConical size={12} /> Career hypothesis
        </span>
        <span className="tp-meta rounded-full px-2.5 py-0.5 font-bold" style={{ background: 'white', color: 'var(--brand-navy-900)' }}>
          {HYPOTHESIS_STATUS_LABELS[h.hypothesis_status] || 'Untested'}
        </span>
      </div>

      <p className="tp-body mt-2 font-semibold text-[color:var(--surface-dark-900)]">{pathName}</p>
      <p className="tp-meta mt-1 text-[color:var(--ink-500)]">
        A career hypothesis is a direction worth testing, not a prediction of what you should become.
        {' '}{HYPOTHESIS_STATUS_MEANING[h.hypothesis_status] || ''}
      </p>
      <p className="tp-meta mt-1 text-[color:var(--ink-400)]">
        {h.experiments_completed} experiment{h.experiments_completed === 1 ? '' : 's'} completed
        {' · '}{h.evidence_collected} piece{h.evidence_collected === 1 ? '' : 's'} of evidence collected
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

      <LanguageLevelControl level={language.level} onChange={language.setLevel} className="mt-4" />

      {/* Ability and enjoyment, kept separate from the overall number above. */}
      <FitBreakdown fit={h.fit} overall={h.career_fit_score} evidenceShare={h.fit_evidence_share} />

      {progress && (
        <div className="mt-4 space-y-4">
          <DimensionProgress progress={progress} />
          <NextTestCard next={nextTest} careerName={pathName} />
        </div>
      )}

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
              {it.source && <span className="tp-meta text-[color:var(--ink-400)]"> ({it.source})</span>}
            </>
          )}
        />

        <Bullets
          title="What we know"
          items={h.what_we_know}
          render={(it) => (
            <>
              {it.text}
              {it.source && <span className="tp-meta text-[color:var(--ink-400)]"> ({it.source})</span>}
            </>
          )}
        />

        {!h.what_we_know?.length && (
          <p className="tp-meta text-[color:var(--ink-400)]">What we know: {NOT_YET_ASSESSED}.</p>
        )}

        <Bullets title="Assumptions being made" items={h.assumptions} render={(it) => it} />

        <Bullets
          title="What people in this work have told you"
          items={h.human_reality_insights}
          render={(it) => (
            <>
              {it.insight}
              {it.source && <span className="tp-meta text-[color:var(--ink-400)]"> ({it.source})</span>}
            </>
          )}
        />

        {(path?.main_tradeoffs || path?.lifestyle_implications) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {path.main_tradeoffs && (
              <div>
                <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Important tradeoffs</p>
                <p className="tp-body text-[color:var(--ink-700)]">{path.main_tradeoffs}</p>
              </div>
            )}
            {path.lifestyle_implications && (
              <div>
                <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Lifestyle considerations</p>
                <p className="tp-body text-[color:var(--ink-700)]">{path.lifestyle_implications}</p>
              </div>
            )}
          </div>
        )}

        {path?.confidence_explanation && (
          <div>
            <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Why confidence is where it is</p>
            <p className="tp-body text-[color:var(--ink-700)]">{path.confidence_explanation}</p>
          </div>
        )}

        <Bullets
          title="Evidence against this"
          items={h.contradicting_evidence}
          render={(it) => (
            <>
              {it.text}
              {it.source && <span className="tp-meta text-[color:var(--ink-400)]"> ({it.source})</span>}
            </>
          )}
        />

        {h.unresolved_questions?.length > 0 && (
          <div className="rounded-[var(--r-control)] bg-white p-4" style={{ border: '1px solid var(--border-light)' }}>
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

        <HypothesisDimensions
          hypothesis={h}
          careerName={pathName}
          signals={signals}
          profile={profile}
        />

        <CareerUncertaintyMap map={h.uncertainty} />
      </div>
    </section>
  );
}