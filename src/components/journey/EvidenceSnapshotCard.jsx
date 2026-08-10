import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * Your career evidence — the way into the Career Evidence Profile.
 *
 * Only counts that exist are printed. A student who has completed nothing sees
 * the open questions line and nothing else, because inventing progress would
 * make every other number here untrustworthy.
 */
export default function EvidenceSnapshotCard({ counts }) {
  const rows = [
    { n: counts.experiments, label: `Experiment${counts.experiments === 1 ? '' : 's'} completed` },
    { n: counts.strengths, label: `Demonstrated strength${counts.strengths === 1 ? '' : 's'}` },
    { n: counts.preferences, label: `Work preference${counts.preferences === 1 ? '' : 's'} identified` },
    { n: counts.openQuestions, label: `Important question${counts.openQuestions === 1 ? '' : 's'} still unresolved` },
  ].filter(r => r.n > 0);

  if (!rows.length) return null;

  return (
    <section className="rounded-[20px] border border-[color:var(--ink-200)] bg-white p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Your career evidence</h2>
      <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
        What we have learned about you so far, and what we are still learning.
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {rows.map(r => (
          <div key={r.label}>
            <dt className="font-heading text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{r.n}</dt>
            <dd className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>{r.label}</dd>
          </div>
        ))}
      </dl>

      <Link
        to="/career-profile"
        className="tp-meta mt-5 inline-flex items-center gap-1.5 font-semibold"
        style={{ color: 'var(--brand-navy-700)' }}
      >
        View Career Evidence Profile <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </section>
  );
}