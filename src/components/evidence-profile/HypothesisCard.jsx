import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { HYPOTHESIS_STATUS_LABELS } from '@/lib/career-hypothesis';
import { EvidenceBadge, ConfidenceMeter } from '@/components/evidence-profile/EvidenceBadge';
import EvidenceProvenance from '@/components/evidence-profile/EvidenceProvenance';
import FitBreakdown from '@/components/paths/FitBreakdown';
import WhyThisChanged from '@/components/paths/WhyThisChanged';

/** One career hypothesis as it currently stands, with its evidence count. */
export default function HypothesisCard({ item, flagged, recalculation }) {
  const { path, hypothesis, summary } = item;
  return (
    <div className="rounded-[var(--r-surface)] border bg-white p-5" style={{ borderColor: 'var(--ink-200)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="tp-card" style={{ color: 'var(--surface-dark-900)' }}>{path.path_name}</h3>
          {path.path_category && (
            <p className="tp-meta mt-0.5" style={{ color: 'var(--ink-400)' }}>{path.path_category}</p>
          )}
        </div>
        <EvidenceBadge summary={summary} overrideLabel={HYPOTHESIS_STATUS_LABELS[hypothesis.hypothesis_status]} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="tp-meta mb-1.5 flex justify-between" style={{ color: 'var(--ink-500)' }}>
            <span>Career fit</span>
            <span className="font-semibold" style={{ color: 'var(--surface-dark-900)' }}>{hypothesis.career_fit_score}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--ink-100)' }}>
            <div className="progress-fill h-full rounded-full" style={{ width: `${hypothesis.career_fit_score}%`, background: 'var(--brand-gold-600)' }} />
          </div>
          <p className="tp-meta mt-1.5" style={{ color: 'var(--ink-400)' }}>How promising this looks right now.</p>
        </div>
        <ConfidenceMeter summary={{ ...summary, confidence: hypothesis.fit_confidence_score }} label="Confidence in that estimate" />
      </div>

      {hypothesis.why_this_may_fit && (
        <p className="tp-body mt-4" style={{ color: 'var(--ink-700)' }}>{hypothesis.why_this_may_fit}</p>
      )}

      <FitBreakdown fit={hypothesis.fit} overall={hypothesis.career_fit_score} evidenceShare={hypothesis.fit_evidence_share} />

      {recalculation ? (
        <WhyThisChanged change={recalculation} compact />
      ) : (
        <p className="tp-meta mt-3" style={{ color: 'var(--ink-400)' }}>
          Nothing has recalculated this estimate yet. Completing an experiment and writing its reflection is what moves it.
        </p>
      )}

      <EvidenceProvenance
        summary={summary}
        type="career_hypothesis"
        conclusionKey={`career:${path.id}`}
        label={path.path_name}
        alreadyFlagged={flagged}
      />

      <Link to="/paths" className="tp-meta mt-3 inline-flex items-center gap-1 font-semibold"
        style={{ color: 'var(--brand-navy-700)' }}>
        Open this hypothesis <ArrowUpRight size={12} />
      </Link>
    </div>
  );
}