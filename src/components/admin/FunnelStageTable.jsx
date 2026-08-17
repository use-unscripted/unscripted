/**
 * One funnel, one row per stage. Event-derived and record-derived funnels share
 * this table, and the `eventBacked` flag is what says which is on screen — a
 * record-derived row shows the basis it was inferred from, so nobody reads it as
 * an observation of student behaviour.
 */
const cell = { padding: '10px 12px', borderBottom: '1px solid var(--border-light)', textAlign: 'left' };

const val = (v, suffix = '') => (v === null || v === undefined ? '-' : `${v}${suffix}`);

export default function FunnelStageTable({ stages = [], eventBacked = true }) {
  if (!stages.length) {
    return (
      <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>
        No stages to show yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 720 }}>
        <thead>
          <tr>
            {['Stage', 'Students', 'Records', 'From previous', 'From entry', 'Dropped', eventBacked ? 'Median time' : 'Basis'].map(h => (
              <th key={h} className="tp-eyebrow" style={{ ...cell, color: 'var(--text-muted)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stages.map(s => (
            <tr key={s.key}>
              <td className="tp-body" style={{ ...cell, color: 'var(--text-primary)', fontWeight: 600 }}>{s.label}</td>
              <td className="tp-body" style={{ ...cell, color: 'var(--text-primary)' }}>{val(s.students)}</td>
              <td className="tp-body" style={{ ...cell, color: 'var(--text-secondary)' }}>{val(s.records)}</td>
              <td className="tp-body" style={{ ...cell, color: 'var(--text-secondary)' }}>{val(s.conversion_from_previous, '%')}</td>
              <td className="tp-body" style={{ ...cell, color: 'var(--text-secondary)' }}>{val(s.conversion_from_entry, '%')}</td>
              <td className="tp-body" style={{ ...cell, color: 'var(--text-secondary)' }}>{eventBacked ? val(s.dropped_from_previous) : '-'}</td>
              <td className="tp-body" style={{ ...cell, color: 'var(--text-muted)' }}>
                {eventBacked
                  ? val(s.median_hours_from_previous, ' h')
                  : (s.basis || '-')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}