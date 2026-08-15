/**
 * Something worth testing.
 *
 * Where a stated preference and a run of scenario answers disagree, neither is
 * treated as the answer. The only way out is a real experiment, so that is the
 * one button, and it carries the dimension through to the next-test engine.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, HelpCircle } from 'lucide-react';

export default function ScenarioContradictions({ contradictions = [], pathId }) {
  if (!contradictions.length) return null;

  return (
    <section className="app-card-flat p-5">
      <h2 className="tp-card inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <HelpCircle size={16} style={{ color: 'var(--warning-700)' }} /> Something worth testing
      </h2>

      <div className="mt-4 space-y-3">
        {contradictions.map(c => (
          <div key={c.dimension} className="rounded-[var(--r-control)] p-3.5" style={{ background: 'var(--warning-50)' }}>
            <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{c.title}</p>
            <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>{c.detail}</p>
            <p className="tp-meta mt-1.5" style={{ color: 'var(--text-secondary)' }}>{c.resolution}</p>
            <Link
              to={`/test?dimension=${encodeURIComponent(c.dimension)}${pathId ? `&pathId=${pathId}` : ''}`}
              className="ui-press tp-meta mt-3 inline-flex items-center gap-1.5 rounded-[var(--r-control)] px-4 font-bold text-white"
              style={{ background: 'var(--brand-navy-900)', minHeight: '44px' }}
            >
              Test this in a real experiment <ArrowRight size={13} />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}