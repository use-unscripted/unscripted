import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * The runners-up. The student is never forced into the recommendation, so the
 * next most useful tests are offered here with the same honesty about what each
 * one would tell us.
 */
export default function AlternativeTests({ alternatives = [] }) {
  if (!alternatives.length) return null;

  return (
    <div className="mt-5 space-y-3">
      <p className="tp-meta" style={{ color: 'var(--ink-500)' }}>
        These would also teach us something new, just less than the one above.
      </p>
      {alternatives.map(alt => (
        <div key={alt.variable} className="rounded-[var(--r-control)] border bg-white p-4" style={{ borderColor: 'var(--ink-200)' }}>
          <p className="tp-card font-semibold" style={{ color: 'var(--ink-900)' }}>{alt.blueprint.title}</p>
          <p className="tp-body mt-1" style={{ color: 'var(--ink-500)' }}>{alt.blueprint.summary}</p>
          <p className="tp-meta mt-2" style={{ color: 'var(--ink-400)' }}>
            Tests {alt.blueprint.tests.slice(0, 3).join(', ')} · for {alt.attached.path_name}
          </p>
          <Link
            to={alt.start_to}
            className="tp-meta mt-3 inline-flex items-center gap-1.5 font-semibold"
            style={{ color: 'var(--brand-navy-700)' }}
          >
            Start this instead <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      ))}
      <p className="tp-meta" style={{ color: 'var(--ink-400)' }}>
        Or <Link to="/paths" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>browse your paths</Link> and pick your own.
      </p>
    </div>
  );
}