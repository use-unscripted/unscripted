/**
 * One hypothesis, start to current position, in the order it happened.
 */
import RecordNode from '@/components/record/RecordNode';

export default function HypothesisChain({ chain }) {
  if (!chain) return null;
  return (
    <section className="app-card p-5 sm:p-6">
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Career decision record</p>
      <h2 className="tp-section mt-1.5" style={{ color: 'var(--text-primary)' }}>{chain.pathName}</h2>
      <p className="tp-meta mt-1.5" style={{ color: 'var(--text-secondary)' }}>
        {chain.experimentCount} experiment{chain.experimentCount === 1 ? '' : 's'} · {chain.updateCount} recorded update{chain.updateCount === 1 ? '' : 's'} · nothing here is overwritten
      </p>

      <ol className="mt-5 space-y-5">
        {chain.nodes.map((n, i) => <RecordNode key={n.id || `${n.kind}-${i}`} node={n} />)}
        <RecordNode node={chain.current} />
      </ol>
    </section>
  );
}