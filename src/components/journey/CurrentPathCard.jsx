import { CheckCircle2, ArrowRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RISK_LABEL } from '@/components/journey/pathComparisonFields';

/**
 * The path this student is actually testing, named first on the Choose screen.
 *
 * Choose used to show only the three most recently generated paths, so a student
 * testing a path chosen earlier, or added from the library, saw three names that
 * did not include their own — with nothing on the screen saying which one was
 * live. The choice comes first now, and switching is the deliberate second step.
 */
export default function CurrentPathCard({ path, switching, onToggleSwitch }) {
  if (!path) return null;
  const meta = [path.path_category, RISK_LABEL[path.risk_level]].filter(Boolean).join(' · ');

  return (
    <section className="app-card p-6">
      <p
        className="tp-meta inline-flex items-center gap-1.5 font-bold uppercase"
        style={{ color: 'var(--success-700)' }}
      >
        <CheckCircle2 size={13} /> Testing now
      </p>
      <h2 className="tp-section mt-1.5" style={{ color: 'var(--text-primary)' }}>{path.path_name}</h2>
      {meta && <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>{meta}</p>}
      {(path.fit_reason || path.why_it_fits) && (
        <p className="tp-body mt-3" style={{ color: 'var(--text-secondary)' }}>
          {path.fit_reason || path.why_it_fits}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link to="/test" className="app-cta tp-control">
          Go to my test <ArrowRight size={16} />
        </Link>
        <button
          type="button"
          onClick={onToggleSwitch}
          className="app-cta-secondary tp-body font-semibold"
        >
          <RefreshCw size={14} /> {switching ? 'Keep testing this path' : 'Test a different path'}
        </button>
      </div>
    </section>
  );
}