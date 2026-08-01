import { Link } from 'react-router-dom';

/**
 * Quiet, low-emphasis answer to "what have I built so far?".
 * Counts only — never competing CTAs.
 */
export default function JourneySnapshot({ counts }) {
  const items = [
    { label: 'Paths explored', value: counts.paths },
    { label: 'Missions run', value: counts.experiments },
    { label: 'Evidence created', value: counts.proof },
    { label: 'Reflections', value: counts.reflections },
  ];

  return (
    <section className="rounded-[16px] bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-heading text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          What you've built
        </h3>
        <Link to="/evidence" className="text-xs font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
          View evidence →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(({ label, value }) => (
          <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
            <p className="font-heading text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="mt-0.5 text-[11px] leading-4" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}