import { HYPOTHESIS_STATUS_LABELS, NOT_YET_ASSESSED } from '@/lib/career-hypothesis';

/**
 * The comparison view of one career hypothesis: the six things a student needs
 * in order to choose what to test next, in the same order on every card.
 *
 * Deliberately flat and text-first. Comparing three hypotheses on a phone means
 * reading the same six rows three times, so nothing here collapses or reorders.
 */
function Block({ label, children, tone }) {
  const bg = tone === 'fit' ? 'var(--success-50)' : tone === 'against' ? 'var(--warning-50)' : 'transparent';
  const border = tone === 'fit'
    ? '1px solid rgba(21,128,61,0.2)'
    : tone === 'against' ? '1px solid rgba(180,83,9,0.2)' : 'none';
  const color = tone === 'fit' ? 'var(--success-700)' : tone === 'against' ? 'var(--warning-700)' : 'var(--ink-500)';
  return (
    <div className={tone ? 'app-inset p-3.5' : ''} style={tone ? { background: bg, border } : undefined}>
      <p className="tp-eyebrow mb-1.5" style={{ color }}>{label}</p>
      {children}
    </div>
  );
}

function Lines({ items, empty }) {
  if (!items?.length) return <p className="tp-meta text-[color:var(--ink-400)]">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="tp-body flex gap-2 text-[color:var(--ink-700)]">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--brand-navy-700)' }} />
          <span>
            {it.text || it.question || it.insight}
            {it.source && <span className="tp-meta text-[color:var(--ink-400)]"> ({it.source})</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function HypothesisCompareSummary({ hypothesis, path, nextTest }) {
  const h = hypothesis;
  const confidenceWord = { low: 'Low', medium: 'Moderate', high: 'High' }[path.confidence_level] || 'Low';
  const firstTest = nextTest?.question || path.first_experiment || '';

  return (
    <div className="mt-4 space-y-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Block label="Why this might fit" tone="fit">
          <p className="tp-body text-[color:var(--ink-700)]">
            {h.why_this_may_fit || NOT_YET_ASSESSED}
          </p>
        </Block>
        <Block label="Why this might not fit" tone="against">
          <p className="tp-body text-[color:var(--ink-700)]">
            {path.why_it_may_not_fit || path.concern || NOT_YET_ASSESSED}
          </p>
        </Block>
      </div>

      <Block label="What we know">
        <Lines items={h.what_we_know} empty={`${NOT_YET_ASSESSED}. Nothing here has been tested yet.`} />
      </Block>

      <Block label="What remains unknown">
        <Lines items={h.unresolved_questions} empty={NOT_YET_ASSESSED} />
      </Block>

      <Block label="Confidence">
        <p className="tp-body text-[color:var(--ink-700)]">
          {confidenceWord}: {h.fit_confidence_score}% of the evidence this hypothesis needs.
        </p>
        <p className="tp-meta mt-1 text-[color:var(--ink-400)]">
          {path.confidence_explanation
            || 'Confidence is how much evidence supports this hypothesis, not how likely you are to succeed.'}
        </p>
        <p className="tp-meta mt-1 text-[color:var(--ink-400)]">
          Status: {HYPOTHESIS_STATUS_LABELS[h.hypothesis_status] || 'Untested'}
        </p>
      </Block>

      <Block label="Best first test">
        <p className="tp-body text-[color:var(--ink-700)]">{firstTest || NOT_YET_ASSESSED}</p>
        {nextTest?.why && <p className="tp-meta mt-1 text-[color:var(--ink-400)]">{nextTest.why}</p>}
      </Block>
    </div>
  );
}