import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null);
const score = (n) => (typeof n === 'number' ? `${n}/10` : null);

/** One completed experiment and what it measured. */
export default function ExperimentHistoryCard({ entry }) {
  const { experiment: e, measurement: m } = entry;
  const chars = e.work_characteristics_tested || [];
  const rows = [
    ['Performance (self)', score(m?.self_rated_performance)],
    ['Performance (reviewed)', score(m?.system_performance_score)],
    ['Enjoyment', score(m?.actual_enjoyment)],
    ['Energy', score(m?.actual_energy)],
    ['Wanted to repeat', score(m?.desire_to_repeat)],
  ].filter(r => r[1]);

  return (
    <div className="rounded-[16px] border bg-white p-5" style={{ borderColor: 'var(--ink-200)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="tp-card" style={{ color: 'var(--surface-dark-900)' }}>{e.title}</h3>
          <p className="tp-meta mt-0.5" style={{ color: 'var(--ink-400)' }}>
            {e.career_name || e.path_name || 'No career linked'}
            {fmt(e.updated_date || e.created_date) ? ` · ${fmt(e.updated_date || e.created_date)}` : ''}
          </p>
        </div>
        <Link to={`/experiments?experimentId=${e.id}`}
          className="tp-meta inline-flex items-center gap-1 font-semibold"
          style={{ color: 'var(--brand-navy-700)' }}>
          Open <ArrowUpRight size={12} />
        </Link>
      </div>

      {chars.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chars.map((c, i) => (
            <span key={i} className="tp-meta rounded-full border px-2.5 py-0.5"
              style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-500)' }}>{c}</span>
          ))}
        </div>
      )}

      {rows.length > 0 ? (
        <div className="tp-meta mt-3 flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--ink-500)' }}>
          {rows.map(([label, value]) => (
            <span key={label}>{label} <strong style={{ color: 'var(--surface-dark-900)' }}>{value}</strong></span>
          ))}
        </div>
      ) : (
        <p className="tp-meta mt-3" style={{ color: 'var(--ink-400)' }}>
          This one was completed without a measurement, so it adds no rating evidence.
        </p>
      )}

      {m?.surprise_reflection && (
        <p className="tp-body mt-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--ink-50)', color: 'var(--ink-700)' }}>
          <span className="font-semibold">What surprised you:</span> {m.surprise_reflection}
        </p>
      )}
    </div>
  );
}