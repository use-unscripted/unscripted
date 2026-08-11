/**
 * The review of the work itself, shown next to what the student said about it.
 * Two numbers side by side, never merged: what they thought of their own
 * performance, and what the review of the deliverable found. The gap is the
 * point, so it is stated plainly rather than smoothed over.
 */
import { ClipboardCheck } from 'lucide-react';

const Stat = ({ label, value }) => (
  <div className="rounded-[var(--r-control)] p-3 text-center" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
    <p className="font-heading text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}<span className="tp-meta font-body font-semibold" style={{ color: 'var(--text-muted)' }}>/10</span></p>
    <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
  </div>
);

const List = ({ title, items }) => (
  items?.length ? (
    <div>
      <p className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>{title}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((t, i) => (
          <li key={i} className="tp-body" style={{ color: 'var(--text-secondary)' }}>{t}</li>
        ))}
      </ul>
    </div>
  ) : null
);

export default function ReviewedWork({ m }) {
  if (!m?.system_evaluated_at) return null;
  const self = typeof m.self_rated_performance === 'number' ? m.self_rated_performance : null;
  const sys = typeof m.system_performance_score === 'number' ? m.system_performance_score : null;
  const gap = self !== null && sys !== null ? Math.round((sys - self) * 10) / 10 : null;

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
        <ClipboardCheck size={12} /> The work you produced
      </p>
      {m.system_evaluation_summary && (
        <p className="tp-lead mt-2.5" style={{ color: 'var(--text-primary)' }}>{m.system_evaluation_summary}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {sys !== null && <Stat label="Reviewed overall" value={sys} />}
        {typeof m.reasoning_quality === 'number' && <Stat label="Reasoning" value={m.reasoning_quality} />}
        {typeof m.execution_quality === 'number' && <Stat label="Execution" value={m.execution_quality} />}
        {self !== null && <Stat label="Your own rating" value={self} />}
      </div>

      {gap !== null && Math.abs(gap) >= 2 && (
        <p className="tp-body mt-3" style={{ color: 'var(--text-secondary)' }}>
          The review scored this {gap > 0 ? 'higher' : 'lower'} than you scored yourself. Both are kept as they are.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <List title="Demonstrated here" items={m.demonstrated_strengths} />
        <List title="Room to improve" items={m.improvement_areas} />
      </div>

      {m.system_rubric_results?.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>Against this experiment's criteria</p>
          {m.system_rubric_results.map((r, i) => (
            <div key={i} className="rounded-[var(--r-control)] p-3" style={{ background: 'var(--background-secondary)' }}>
              <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>
                {r.criterion}{typeof r.score === 'number' ? ` — ${r.score}/10` : ''}
              </p>
              {r.note && <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>{r.note}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}