/**
 * The Conviction Review: one short read of where a path stands, built from the
 * student's own records. Every block names where it came from, and an empty
 * block says it is empty rather than filling itself in.
 */
import { Link } from 'react-router-dom';
import { ClipboardList, ArrowRight } from 'lucide-react';

function Block({ label, children }) {
  return (
    <div>
      <p className="tp-meta font-semibold uppercase" style={{ color: 'var(--ink-400)', letterSpacing: '0.06em' }}>{label}</p>
      <div className="tp-body mt-1" style={{ color: 'var(--text-primary)' }}>{children}</div>
    </div>
  );
}

const Empty = ({ children }) => (
  <span className="tp-body" style={{ color: 'var(--ink-400)' }}>{children}</span>
);

export default function ConvictionReview({ review }) {
  if (!review) return null;
  const { known, unknown, support, against, changedAssumption, tradeoffs, mindChangers, nextTest, readiness, basis } = review;

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <ClipboardList size={17} style={{ color: 'var(--brand-navy-700)' }} /> Conviction Review
      </h2>
      <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>
        {basis.experiments} completed {basis.experiments === 1 ? 'test' : 'tests'}, {basis.checkIns} post-test
        {basis.checkIns === 1 ? ' check-in' : ' check-ins'}, {basis.dimensionsRead} of {basis.dimensionsTotal} key dimensions read.
      </p>

      <div className="mt-4 space-y-4">
        <Block label="What you know now">
          {known.length ? (
            <ul className="space-y-1.5">
              {known.map((k, i) => (
                <li key={i}>
                  {k.text}
                  {k.source && <span className="tp-meta" style={{ color: 'var(--ink-400)' }}> · {k.source}</span>}
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing has been tested on this path yet.</Empty>}
        </Block>

        <Block label="What you still do not know">
          {unknown.length ? (
            <ul className="space-y-1.5">
              {unknown.map((u, i) => (
                <li key={i}>
                  {u.text}
                  {u.source && <span className="tp-meta" style={{ color: 'var(--ink-400)' }}> · {u.source}</span>}
                </li>
              ))}
            </ul>
          ) : <Empty>Every key dimension here has at least one reading.</Empty>}
        </Block>

        <Block label="Strongest evidence for">
          {support ? (
            <>
              {support.text}
              {support.source && <span className="tp-meta" style={{ color: 'var(--ink-400)' }}> · {support.source}</span>}
            </>
          ) : <Empty>Nothing recorded in favour of this path yet.</Empty>}
        </Block>

        <Block label="Strongest evidence against">
          {against ? (
            <>
              {against.text}
              {against.source && <span className="tp-meta" style={{ color: 'var(--ink-400)' }}> · {against.source}</span>}
            </>
          ) : <Empty>Nothing recorded against this path yet, which usually means the costs have not been tested.</Empty>}
        </Block>

        <Block label="The biggest assumption that changed">
          {changedAssumption ? `"${changedAssumption}"` : <Empty>You have not recorded an assumption changing here yet.</Empty>}
        </Block>

        <Block label="Important tradeoffs">
          {tradeoffs.length ? (
            <ul className="space-y-1.5">
              {tradeoffs.map(t => (
                <li key={t.label}>
                  {t.label} <span className="tp-meta font-semibold" style={{ color: 'var(--brand-navy-700)' }}>{t.status}</span>
                  {t.note && <span className="tp-meta" style={{ color: 'var(--ink-400)' }}> · {t.note}</span>}
                </li>
              ))}
            </ul>
          ) : <Empty>No costs are recorded for this work yet.</Empty>}
        </Block>

        <Block label="What could still change your mind">
          {mindChangers.length ? (
            <ul className="space-y-1.5">{mindChangers.map((m, i) => <li key={i}>{m}</li>)}</ul>
          ) : <Empty>Nothing outstanding is recorded here.</Empty>}
        </Block>

        <Block label="Next best test">
          {nextTest ? (
            <>
              <p>{nextTest.dimension}: {nextTest.question}</p>
              <Link to={nextTest.to} className="app-cta-secondary tp-meta mt-2 font-semibold">
                Run this test <ArrowRight size={14} />
              </Link>
            </>
          ) : <Empty>Nothing open enough to recommend a test on right now.</Empty>}
        </Block>

        <Block label="Decision readiness">
          {readiness?.label}
          <span className="tp-meta block" style={{ color: 'var(--text-secondary)' }}>{readiness?.meaning}</span>
        </Block>
      </div>
    </section>
  );
}