import { EvidenceBadge, ConfidenceMeter } from '@/components/evidence-profile/EvidenceBadge';
import EvidenceProvenance from '@/components/evidence-profile/EvidenceProvenance';
import BasedOnSources from '@/components/evidence-profile/BasedOnSources';

/** An ability the student has actually demonstrated, with its sources. */
export default function AbilityCard({ ability, flagged }) {
  const { summary } = ability;
  return (
    <div className="rounded-[var(--r-surface)] border bg-white p-5" style={{ borderColor: 'var(--ink-200)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="tp-card" style={{ color: 'var(--surface-dark-900)' }}>{ability.label}</h3>
        <EvidenceBadge summary={summary} />
      </div>

      <div className="mt-3">
        <ConfidenceMeter summary={summary} />
      </div>

      <BasedOnSources counts={ability.sourceCounts} />

      {summary.strongest && (
        <p className="tp-meta mt-3" style={{ color: 'var(--ink-500)' }}>
          Strongest evidence: <span className="font-semibold" style={{ color: 'var(--ink-700)' }}>{summary.strongest.detail}</span>
        </p>
      )}

      <EvidenceProvenance
        summary={summary}
        type="ability"
        conclusionKey={`ability:${ability.id}`}
        label={ability.label}
        alreadyFlagged={flagged}
      />
    </div>
  );
}