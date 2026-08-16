/**
 * Account classification, admin only.
 *
 * Accounts arrive as ids and counts — no names, no emails — because the funnel
 * needs to know which accounts are real students, not who they are.
 *
 * Nothing is auto-assigned. An account nobody has classified stays
 * `unclassified` and is left out of the real-student numbers, which is the
 * honest treatment: guessing retroactively would put founder and QA activity
 * back into the metrics this whole exercise exists to clean.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const CLASSES = [
  { id: 'unclassified', label: 'Unclassified' },
  { id: 'real_beta_user', label: 'Real beta user' },
  { id: 'founder', label: 'Founder' },
  { id: 'admin', label: 'Admin' },
  { id: 'internal_test', label: 'Internal test' },
  { id: 'automated_test_agent', label: 'Automated test agent' },
];

export default function UserClassPanel({ accounts = [], counts = {}, onChanged }) {
  const [savingId, setSavingId] = useState(null);
  const [filter, setFilter] = useState('unclassified');

  const save = async (id, analytics_class) => {
    setSavingId(id);
    await base44.entities.User.update(id, {
      analytics_class,
      analytics_classified_at: new Date().toISOString(),
    }).catch(() => null);
    setSavingId(null);
    onChanged?.();
  };

  const rows = filter === 'all' ? accounts : accounts.filter(a => a.analytics_class === filter);

  return (
    <div className="app-stack">
      <div className="flex flex-wrap gap-2">
        {[{ id: 'all', label: `All (${accounts.length})` },
          ...CLASSES.map(c => ({ id: c.id, label: `${c.label} (${counts[c.id] ?? 0})` }))].map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className="tp-meta rounded-full px-3 py-1.5 font-semibold"
            style={filter === opt.id
              ? { background: 'var(--brand-navy-900)', color: '#fff' }
              : { background: 'var(--ink-100)', color: 'var(--ink-700)' }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="app-card-flat overflow-x-auto p-4">
        <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              {['Account', 'Joined', 'Events', 'Role', 'Classification'].map(h => (
                <th key={h} className="tp-eyebrow" style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map(a => (
              <tr key={a.id}>
                <td className="tp-meta" style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>…{String(a.id).slice(-8)}</td>
                <td className="tp-meta" style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{(a.created_date || '').slice(0, 10) || '—'}</td>
                <td className="tp-body" style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{a.events}</td>
                <td className="tp-meta" style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{a.role || 'user'}</td>
                <td style={{ padding: '8px 10px' }}>
                  <select
                    value={a.analytics_class}
                    disabled={savingId === a.id}
                    onChange={(e) => save(a.id, e.target.value)}
                    className="tp-meta rounded-[var(--r-control)] px-2 py-1.5"
                    style={{ border: '1px solid var(--border-light)', background: '#fff', color: 'var(--text-primary)' }}
                  >
                    {CLASSES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 200 && (
          <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>Showing the first 200 of {rows.length}.</p>
        )}
      </div>
    </div>
  );
}