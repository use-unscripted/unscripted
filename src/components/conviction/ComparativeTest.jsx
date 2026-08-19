/**
 * The most useful difference to test between two credible paths, and the
 * comparative test that would read it on both.
 *
 * Each path keeps its own column: its own reading, its own observation count,
 * its own confidence, and its own test link, so a run on one path never quietly
 * becomes evidence for the other.
 */
import { GitCompare, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ComparativeTest({ comparison }) {
  if (!comparison) return null;

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <GitCompare size={17} style={{ color: 'var(--brand-navy-700)' }} /> The difference worth testing
      </h2>
      <p className="tp-prose mt-1.5" style={{ color: 'var(--text-secondary)' }}>{comparison.why}</p>

      <div
        className="mt-4 rounded-[var(--r-control)] p-4"
        style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
      >
        <p className="tp-meta font-semibold uppercase" style={{ color: 'var(--ink-400)', letterSpacing: '0.06em' }}>
          The dimension
        </p>
        <p className="tp-body mt-1 font-bold" style={{ color: 'var(--text-primary)' }}>{comparison.dimension}</p>
        {comparison.question && (
          <p className="tp-meta mt-1.5" style={{ color: 'var(--text-secondary)' }}>{comparison.question}</p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {comparison.sides.map(side => (
          <div
            key={side.pathId}
            className="rounded-[var(--r-control)] p-4"
            style={{ background: 'var(--background-primary)', border: '1px solid var(--border-light)' }}
          >
            <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{side.pathName}</p>
            <p className="tp-meta mt-1 font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
              {side.statusLabel}
              {side.contradicted ? ' · readings have gone both ways' : ''}
            </p>
            <p className="tp-meta mt-1.5" style={{ color: 'var(--text-secondary)' }}>{side.provenance}</p>
            {side.confidence !== null && (
              <p className="tp-meta mt-1.5" style={{ color: 'var(--ink-400)' }}>
                Path confidence on file: {side.confidence}
              </p>
            )}
            <Link
              to={side.to}
              className="app-cta-secondary tp-meta mt-3 w-full font-semibold"
            >
              Test this on {side.pathName} <ArrowRight size={14} />
            </Link>
          </div>
        ))}
      </div>

      <p className="tp-meta mt-3" style={{ color: 'var(--ink-400)' }}>
        Run it on either path, or on both. Each run is recorded against the path you ran it on, and only
        updates that path's evidence.
      </p>
    </section>
  );
}