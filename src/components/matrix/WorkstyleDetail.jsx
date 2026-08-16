import { Link } from 'react-router-dom';
import SidePanel from '@/components/matrix/SidePanel';
import ProvenanceSources from '@/components/matrix/ProvenanceSources';
import { workstyleProvenance } from '@/lib/matrix-provenance';
import ScenarioSourceBlock from '@/components/matrix/ScenarioSourceBlock';
import HumanSourceBlock from '@/components/matrix/HumanSourceBlock';

/**
 * One work characteristic, with the experiences behind it, where they came from,
 * and what part of it is still untested. The context note and the remaining
 * uncertainty are derived from the stored records, never written by a model, so
 * this panel cannot claim a pattern the evidence does not show.
 */
const Block = ({ title, children }) => (
  <section className="mt-6">
    <h3 className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{title}</h3>
    <div className="mt-2">{children}</div>
  </section>
);

export default function WorkstyleDetail({ row, onClose, scenarioResponses = [] }) {
  if (!row) return null;
  const p = workstyleProvenance(row);

  return (
    <SidePanel open title={row.label} eyebrow="Why does Unscripted think this?" onClose={onClose}>
      <p className="tp-lead" style={{ color: 'var(--text-secondary)' }}>
        {row.levelLabel} · {row.confidence}% confidence
      </p>

      {row.interpretation && (
        <p className="app-inset tp-body mt-4 p-3.5" style={{ background: 'var(--ink-50)', color: 'var(--text-secondary)' }}>
          {row.interpretation}
        </p>
      )}

      {!p.sufficient ? (
        <>
          <p className="app-inset tp-body mt-5 p-3.5" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }}>
            {p.insufficientNote}
          </p>
          {p.selfReported && (
            <p className="tp-body mt-3" style={{ color: 'var(--text-secondary)' }}>
              {p.selfReported} That has not been tested yet.
            </p>
          )}
        </>
      ) : (
        <>
          <Block title="Based on"><ProvenanceSources sources={p.basedOn} /></Block>

          {p.contradicting.length > 0 && (
            <Block title="Pointing the other way"><ProvenanceSources sources={p.contradicting} /></Block>
          )}

          {p.contextNote && (
            <Block title="Context">
              <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>{p.contextNote}</p>
            </Block>
          )}

          {p.remaining && (
            <Block title="Remaining uncertainty">
              <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>{p.remaining}</p>
            </Block>
          )}

          {row.careers.length > 0 && (
            <Block title="Directions this informs">
              <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>{row.careers.join(', ')}</p>
            </Block>
          )}
        </>
      )}

      {/* Hypothetical answers, kept in their own block so they can never read as
          part of the behavioural evidence above. */}
      <ScenarioSourceBlock dimension={row.dimension} responses={scenarioResponses} />

      {/* And what people who do this work said, kept equally separate. */}
      <HumanSourceBlock human={row.human} />

      {['unknown', 'mixed'].includes(row.levelKey) && (
        <Link to="/test" className="app-cta tp-control mt-7 inline-flex">Test this further</Link>
      )}
    </SidePanel>
  );
}