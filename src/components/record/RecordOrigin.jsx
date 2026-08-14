/**
 * Where the record starts: what the student said in onboarding, before anything
 * had been tested. Kept verbatim, so the whole chain has a beginning.
 */
export default function RecordOrigin({ origin, counts }) {
  if (!origin) return null;
  const lines = [
    origin.clarity != null && `Career clarity then: ${origin.clarity}/10`,
    origin.considered?.length && `Considering: ${origin.considered.join(', ')}`,
    origin.ruledOut?.length && `Already ruled out: ${origin.ruledOut.join(', ')}`,
    origin.uncertainties?.length && `Most unsure about: ${origin.uncertainties.join('; ')}`,
  ].filter(Boolean);

  return (
    <section className="app-card p-5 sm:p-6">
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Where this record starts</p>
      <h2 className="tp-section mt-1.5" style={{ color: 'var(--text-primary)' }}>Your onboarding, before anything was tested</h2>
      {lines.length ? (
        <ul className="mt-3 space-y-1">
          {lines.map((l, i) => <li key={i} className="tp-body" style={{ color: 'var(--ink-700)' }}>· {l}</li>)}
        </ul>
      ) : (
        <p className="tp-body mt-3" style={{ color: 'var(--text-secondary)' }}>
          Your onboarding did not include a starting uncertainty check. The record begins with your first hypothesis instead.
        </p>
      )}
      <p className="tp-meta mt-4" style={{ color: 'var(--text-muted)' }}>
        Since then: {counts.hypotheses} hypothes{counts.hypotheses === 1 ? 'is' : 'es'} · {counts.experiments} experiment{counts.experiments === 1 ? '' : 's'} ·{' '}
        {counts.evidence} piece{counts.evidence === 1 ? '' : 's'} of evidence · {counts.conversations} conversation{counts.conversations === 1 ? '' : 's'}
      </p>
    </section>
  );
}