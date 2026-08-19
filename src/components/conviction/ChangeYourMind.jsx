/**
 * What could change your mind about this path — the assumption worth attacking,
 * pointed at the same next test the Lab already recommends.
 */
import { Link } from 'react-router-dom';
import { RefreshCcw, ArrowRight } from 'lucide-react';

export default function ChangeYourMind({ change }) {
  if (!change) return null;

  return (
    <section className="app-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <RefreshCcw size={15} style={{ color: 'var(--brand-navy-700)' }} />
        <h2 className="tp-h3">What could change your mind?</h2>
      </div>

      <p className="tp-body mt-3" style={{ color: 'var(--text-primary)' }}>
        {change.assumption}
      </p>
      <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
        {change.why}
      </p>

      {change.to && (
        <Link to={change.to} className="app-cta touch-target mt-4 w-full sm:w-auto">
          Test this next
          <ArrowRight size={16} />
        </Link>
      )}
    </section>
  );
}