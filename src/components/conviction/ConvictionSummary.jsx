import { Link } from 'react-router-dom';
import { FlaskConical, ArrowRight } from 'lucide-react';

/**
 * Where this path stands, in the terms the Lab cares about: how many of its key
 * dimensions have a reading behind them, and whether that is enough to decide on
 * yet. Reported, never scored — a path is never "complete".
 */
export default function ConvictionSummary({ lab }) {
  const { path, readiness, message, confidenceBand, nextTest } = lab;

  return (
    <section className="app-card p-6">
      <p className="tp-meta flex items-center gap-1.5 font-bold uppercase" style={{ color: 'var(--brand-navy-700)' }}>
        <FlaskConical size={12} /> Conviction Lab
      </p>
      <h2 className="tp-section mt-1.5" style={{ color: 'var(--text-primary)' }}>{path.path_name}</h2>
      <p className="tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>{message}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="tp-meta rounded-full px-3 py-1 font-bold"
          style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)' }}>
          {readiness.seen} of {readiness.total} dimensions have a reading
        </span>
        <span className="tp-meta rounded-full px-3 py-1 font-bold"
          style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)' }}>
          Confidence: {confidenceBand}
        </span>
      </div>

      {/* One dominant action: the next thing to learn, or the decision once every
          dimension has been looked at. Both are existing flows. */}
      {readiness.ready ? (
        <Link to="/decide" className="app-cta tp-body mt-5 font-bold">
          Take This To A Decision <ArrowRight size={15} />
        </Link>
      ) : nextTest ? (
        <Link to={nextTest.to} className="app-cta tp-body mt-5 font-bold">
          Test {nextTest.dimension} <ArrowRight size={15} />
        </Link>
      ) : null}
    </section>
  );
}