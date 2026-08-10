import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';

/**
 * What changed — the most recent recorded movement in a career's estimate.
 *
 * A fall is shown exactly as plainly as a rise: learning that a career fits
 * less well than you thought is the system working, not a setback. "Why?" goes
 * to the profile, where the reasons behind each change are stored.
 */
export default function FitChanges({ changes }) {
  if (!changes?.length) return null;

  return (
    <section className="rounded-[20px] border border-[color:var(--ink-200)] bg-white p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>What changed</h2>
      <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
        Updated from the evidence you produced, not from a new questionnaire.
      </p>

      <ul className="mt-5 space-y-3">
        {changes.slice(0, 3).map(c => {
          const up = c.after >= c.before;
          const Icon = up ? ArrowUpRight : ArrowDownRight;
          const tone = up ? 'var(--success-700)' : 'var(--warning-700)';
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="tp-body" style={{ color: 'var(--text-primary)' }}>{c.pathName}</span>
              <span className="tp-body flex items-center gap-1.5 font-semibold" style={{ color: tone }}>
                <Icon size={14} aria-hidden="true" />
                {c.before}% → {c.after}%
              </span>
            </li>
          );
        })}
      </ul>

      <Link
        to="/career-profile"
        className="tp-meta mt-5 inline-flex items-center gap-1.5 font-semibold"
        style={{ color: 'var(--brand-navy-700)' }}
      >
        Why? <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </section>
  );
}