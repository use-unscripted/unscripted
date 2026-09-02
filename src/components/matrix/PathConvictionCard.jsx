/**
 * One path's conviction read, inside the Career Decision Matrix.
 *
 * Every number here opens the same "Why does Unscripted think this?" panel the
 * matrix rows use, so a reading is never shown without the evidence behind it.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, Target } from 'lucide-react';
import MetricValue from '@/components/matrix/MetricValue';
import PathStrengthGauge from '@/components/conviction/PathStrengthGauge';

const TONE = {
  muted: { bg: 'var(--ink-100)', fg: 'var(--text-secondary)' },
  info: { bg: 'var(--info-50)', fg: 'var(--info-700)' },
  warning: { bg: 'var(--warning-50)', fg: 'var(--warning-700)' },
  success: { bg: 'var(--success-50)', fg: 'var(--success-700)' },
};

export default function PathConvictionCard({ row, conviction, onOpen }) {
  if (!conviction) return null;
  const { record, decisionReadiness: readiness, decisionStrength, actionReadiness, gap, nextTest, performance } = conviction;
  const tone = TONE[readiness?.tone] || TONE.muted;

  const metrics = [
    ['confidence', 'Path confidence', row.confidence.value],
    ['coverage', 'Evidence coverage', row.coverage.value],
    ['fit', 'Experienced fit', row.fit.value],
    ['uncertainty', 'Uncertainty left', row.uncertainty.value],
  ];

  return (
    <article className="app-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="tp-card" style={{ color: 'var(--text-primary)' }}>{row.name}</p>
          <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
            Conviction status: {record.withEvidence} of {record.total} evidence areas have something behind them
          </p>
        </div>
        <span className="tp-meta rounded-full px-3 py-1 font-semibold" style={{ background: tone.bg, color: tone.fg }}>
          {readiness?.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {metrics.map(([key, label, value]) => (
          <button key={key} type="button" onClick={() => onOpen(row, key)}
            className="touch-target app-inset px-3 py-2.5 text-left" style={{ background: 'var(--ink-50)' }}>
            <span className="tp-meta block" style={{ color: 'var(--text-muted)' }}>{label}</span>
            <MetricValue value={value} maturity={row.maturity} />
          </button>
        ))}
        {/* Task Performance stays separate from how the work felt, and says how
            many readings it rests on rather than implying a rating. */}
        <div className="app-inset px-3 py-2.5" style={{ background: 'var(--ink-50)' }}>
          <span className="tp-meta block" style={{ color: 'var(--text-muted)' }}>Task performance</span>
          {performance.value === null ? (
            <span className="tp-body" style={{ color: 'var(--ink-400)' }}>No rated work yet</span>
          ) : (
            <>
              <MetricValue value={performance.value} maturity={row.maturity} />
              <span className="tp-meta block" style={{ color: 'var(--text-muted)' }}>
                From {performance.count} {performance.count === 1 ? 'piece' : 'pieces'} of work
                {performance.reviewed ? `, ${performance.reviewed} reviewed` : ', self rated'}
              </span>
            </>
          )}
        </div>
      </div>

      {decisionStrength && (
        <div className="app-inset mt-4 flex flex-wrap items-center gap-4 p-4" style={{ background: 'var(--ink-50)' }}>
          <PathStrengthGauge strength={decisionStrength} height={96} />
          <div className="min-w-[200px] flex-1">
            <p className="tp-meta font-semibold uppercase" style={{ color: 'var(--ink-400)', letterSpacing: '0.06em' }}>
              Path Decision Strength
            </p>
            <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>{decisionStrength.meaning}</p>
            {decisionStrength.heldDownByContradiction && (
              <p className="tp-meta mt-1 font-semibold" style={{ color: 'var(--warning-700)' }}>
                Held down by a disagreement that is still open.
              </p>
            )}
          </div>
        </div>
      )}

      {actionReadiness && (
        <p className="tp-body mt-4" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Action readiness. </span>
          {actionReadiness.detail}
        </p>
      )}

      {gap ? (
        <div className="app-inset mt-4 p-4" style={{ background: 'var(--ink-50)' }}>
          <p className="tp-meta font-semibold uppercase" style={{ color: 'var(--ink-400)', letterSpacing: '0.06em' }}>
            Biggest remaining conviction gap
          </p>
          <p className="tp-body mt-1 font-semibold" style={{ color: 'var(--text-primary)' }}>{gap.unknown}</p>
          {gap.matters && <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>{gap.matters}</p>}
          <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>What exists so far: {gap.evidence}</p>
        </div>
      ) : (
        <p className="tp-body mt-4" style={{ color: 'var(--text-secondary)' }}>
          Every evidence area on this path has something behind it.
        </p>
      )}

      {nextTest && (
        <div className="mt-4">
          <p className="tp-meta font-semibold uppercase" style={{ color: 'var(--ink-400)', letterSpacing: '0.06em' }}>
            Recommended next test
          </p>
          <p className="tp-body mt-1" style={{ color: 'var(--text-primary)' }}>
            <Target size={14} className="mr-1.5 inline" style={{ color: 'var(--brand-navy-700)' }} />
            {nextTest.question}
          </p>
          {nextTest.to && (
            <Link to={nextTest.to} className="app-cta-secondary tp-control mt-3 inline-flex">
              Run this test <ArrowRight size={14} />
            </Link>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        <button type="button" onClick={() => onOpen(row, 'confidence')}
          className="touch-reach tp-control text-left" style={{ color: 'var(--brand-navy-700)' }}>
          Why does Unscripted think this?
        </button>
        <button type="button" onClick={() => onOpen(row, 'uncertainty')}
          className="touch-reach tp-control text-left" style={{ color: 'var(--brand-navy-700)' }}>
          What is still uncertain?
        </button>
        <Link to={`/conviction-lab?pathId=${row.pathId}`} className="touch-reach tp-control"
          style={{ color: 'var(--brand-navy-700)' }}>
          Open the full evidence review
        </Link>
      </div>
    </article>
  );
}