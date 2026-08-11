import { EvidenceBadge } from '@/components/evidence-profile/EvidenceBadge';
import EvidenceProvenance from '@/components/evidence-profile/EvidenceProvenance';

const STATUS_LABEL = {
  observed: null,
  preliminary: 'Preliminary',
  stated_only: 'What you told us',
  still_learning: 'Still Learning',
};

/** How the student appears to prefer working, in plain language. */
export default function PreferenceCard({ preference, flagged }) {
  const { summary, status } = preference;
  const stillLearning = status === 'still_learning';

  return (
    <div className="rounded-[var(--r-surface)] border p-5"
      style={{ borderColor: 'var(--ink-200)', background: stillLearning ? 'var(--ink-50)' : 'white' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="tp-card" style={{ color: 'var(--surface-dark-900)' }}>{preference.headline}</h3>
        <EvidenceBadge summary={summary} overrideLabel={STATUS_LABEL[status] || undefined} />
      </div>

      <p className="tp-body mt-2" style={{ color: 'var(--ink-700)' }}>{preference.statement}</p>

      {preference.signal?.ratedCount > 0 && (
        <p className="tp-meta mt-2" style={{ color: 'var(--ink-400)' }}>
          Measured across {preference.signal.ratedCount} rated experiment{preference.signal.ratedCount === 1 ? '' : 's'}.
        </p>
      )}

      {!stillLearning && (
        <EvidenceProvenance
          summary={summary}
          type="work_preference"
          conclusionKey={`preference:${preference.id}`}
          label={preference.headline}
          alreadyFlagged={flagged}
        />
      )}
    </div>
  );
}