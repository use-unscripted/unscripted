/**
 * Repeat cycles, which is the behaviour the pilot is actually testing: does a
 * student run a second and a third test on the SAME path?
 *
 * "Stopped after" is the only place abandonment is described, and it counts
 * attempts whose last recorded event is that stage. A stage with a zero means no
 * event proves anyone stopped there — not that nobody did.
 */
const Stat = ({ label, value, sub }) => (
  <div className="app-card-flat p-4">
    <p className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>{label}</p>
    <p className="tp-hero mt-1" style={{ color: 'var(--text-primary)' }}>{value ?? 'No data'}</p>
    {sub && <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
  </div>
);

const hours = (h) => (h === null || h === undefined ? 'No data' : h >= 48 ? `${Math.round(h / 24)} days` : `${h} h`);

export default function RepeatCyclePanel({ cycles }) {
  if (!cycles) return null;
  const stopped = Object.entries(cycles.stopped_after || {}).filter(([, n]) => n > 0);

  return (
    <div className="app-stack">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cycle attempts" value={cycles.attempts_total} sub="An experiment a student selected" />
        <Stat label="Completed cycles" value={cycles.cycles_completed_total} sub="All eight steps recorded" />
        <Stat label="Students with 1+" value={cycles.students_with_a_completed_cycle} />
        <Stat label="Repeat rate" value={cycles.repeat_cycle_rate === null ? 'No data' : `${cycles.repeat_cycle_rate}%`} sub="Of students with one cycle, how many ran a second on the same path" />
        <Stat label="2 cycles, same path" value={cycles.students_with_two_cycles_same_path} />
        <Stat label="3 cycles, same path" value={cycles.students_with_three_cycles_same_path} />
        <Stat label="Between cycles" value={hours(cycles.median_hours_between_cycles)} sub="Median" />
      </div>

      <div className="app-card-flat p-4">
        <p className="tp-card" style={{ color: 'var(--text-primary)' }}>Where incomplete attempts last recorded an event</p>
        {stopped.length ? (
          <ul className="mt-2 space-y-1">
            {stopped.map(([stage, n]) => (
              <li key={stage} className="tp-body" style={{ color: 'var(--text-secondary)' }}>
                {stage.replace(/_/g, ' ')}: {n}
              </li>
            ))}
          </ul>
        ) : (
          <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
            No incomplete attempts have any recorded events yet, so nothing here says students are stopping anywhere.
          </p>
        )}
      </div>

      {Boolean(cycles.per_path?.length) && (
        <div className="app-card-flat overflow-x-auto p-4">
          <p className="tp-card mb-3" style={{ color: 'var(--text-primary)' }}>Per student, per path</p>
          <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr>
                {['Account', 'Path', 'Tests started', 'Cycles completed', 'Between cycles'].map(h => (
                  <th key={h} className="tp-eyebrow" style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cycles.per_path.map(row => (
                <tr key={`${row.user}:${row.path_id}`}>
                  <td className="tp-meta" style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>…{String(row.user).slice(-6)}</td>
                  <td className="tp-meta" style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>…{String(row.path_id || 'unknown').slice(-6)}</td>
                  <td className="tp-body" style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{row.tests_started}</td>
                  <td className="tp-body" style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{row.cycles_completed}</td>
                  <td className="tp-body" style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{hours(row.median_hours_between_cycles)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}