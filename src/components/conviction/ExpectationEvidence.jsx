/**
 * "What you expected against what happened" for one path, across every test on
 * it. Descriptive only: it never says the path fits or does not.
 */
import { Link } from 'react-router-dom';
import { Gauge } from 'lucide-react';

const TONE = { held: 'var(--text-secondary)', up: 'var(--success-700)', down: 'var(--warning-700)' };

export default function ExpectationEvidence({ evidence, pathId }) {
  if (!evidence) return null;
  const { tests, rows, summary, caveat } = evidence;

  return (
    <section className="app-card p-5 sm:p-6">
      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
        <Gauge size={12} /> Expectation against reality
      </p>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{summary}</p>

      {!tests ? (
        <Link
          to={pathId ? `/conviction-lab?pathId=${pathId}#next` : '/test'}
          className="ui-press app-cta-secondary tp-control mt-4"
        >
          Record expectations on your next test
        </Link>
      ) : (
        <>
          <div className="mt-4">
            {rows.map(r => (
              <div key={r.key} className="border-b border-[color:var(--ink-200)] py-3 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{r.label}</p>
                  {r.average !== null && r.average !== 0 && (
                    <span className="tp-meta rounded-full px-2 py-0.5 font-bold"
                      style={{ background: 'var(--ink-100)', color: TONE[r.direction] }}>
                      {r.average > 0 ? `+${r.average}` : r.average} average
                    </span>
                  )}
                </div>
                <p className="tp-meta mt-1" style={{ color: 'var(--ink-700)' }}>{r.note}</p>
                <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  From {r.tests === 1 ? '1 test' : `${r.tests} tests`}
                  {r.moved ? `, ${r.moved} where it moved clearly` : ''}.
                </p>
              </div>
            ))}
          </div>
          {caveat && <p className="tp-meta mt-4" style={{ color: 'var(--text-muted)' }}>{caveat}</p>}
        </>
      )}
    </section>
  );
}