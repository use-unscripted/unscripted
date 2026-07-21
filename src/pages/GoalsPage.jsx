import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const FEASIBILITY_STYLES = {
  realistic: { bg: '#F0FDF4', text: '#15803D', icon: CheckCircle },
  stretch: { bg: '#FFFBEB', text: '#B45309', icon: AlertTriangle },
  unrealistic: { bg: '#FEF2F2', text: '#B91C1C', icon: AlertTriangle },
  needs_clarity: { bg: '#F1F5F9', text: '#64748B', icon: Clock },
};

const TIMEFRAME_ORDER = ['annual', 'monthly', 'weekly'];
const TIMEFRAME_LABELS = { annual: 'Annual Goals', monthly: 'Monthly Goals', weekly: 'Weekly Goals' };
const CAT_COLORS = { career: '#274C77', financial: '#15803D', academic: '#0369A1', project: '#B45309', brand: '#7C3AED', networking: '#0891B2', wellness: '#15803D', other: '#64748B' };

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('annual');
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const data = await base44.entities.Goals.list('-created_date', 100);
    setGoals(data);
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    await base44.entities.Goals.update(id, { status });
    load();
  };

  const filteredGoals = goals.filter(g => g.timeframe === tab);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Goals"
        title="What you're building toward."
        description="Annual, monthly, and weekly goals — with honest feasibility assessments so your plan stays realistic."
      />

      {/* Feasibility summary */}
      {goals.some(g => g.feasibility_status === 'unrealistic') && (
        <div className="mb-6 rounded-[16px] p-5" style={{ background: '#FEF2F2', border: '1px solid rgba(185,28,28,0.2)' }}>
          <p className="text-xs font-bold uppercase tracking-wide text-[#B91C1C] mb-2">Feasibility issue detected</p>
          <p className="text-sm text-[#334155]">
            {goals.filter(g => g.feasibility_status === 'unrealistic').length} goal{goals.filter(g => g.feasibility_status === 'unrealistic').length > 1 ? 's were' : ' was'} flagged as unrealistic based on your available time. Consider deferring or reducing scope.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 rounded-xl border border-[#E2E8F0] bg-white p-1.5">
        {TIMEFRAME_ORDER.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition"
            style={tab === t ? { background: 'var(--brand-navy-900)', color: '#fff' } : { color: '#64748B' }}>
            {TIMEFRAME_LABELS[t]}
            <span className="ml-2 text-xs opacity-70">({goals.filter(g => g.timeframe === t).length})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#64748B]">Loading goals...</div>
      ) : filteredGoals.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#E2E8F0] p-12 text-center text-[#64748B]">
          No {tab} goals yet. Complete the goal intake or add one manually.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGoals.map(g => {
            const fs = FEASIBILITY_STYLES[g.feasibility_status] || FEASIBILITY_STYLES.needs_clarity;
            const FIcon = fs.icon;
            return (
              <div key={g.id} className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-bold capitalize"
                        style={{ background: CAT_COLORS[g.category] ? `${CAT_COLORS[g.category]}18` : '#F1F5F9', color: CAT_COLORS[g.category] || '#64748B' }}>
                        {g.category}
                      </span>
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-bold capitalize"
                        style={g.priority === 'high' ? { background: '#EEF2F6', color: '#1F3A5F' } : g.priority === 'medium' ? { background: '#FFFBEB', color: '#B45309' } : { background: '#F1F5F9', color: '#64748B' }}>
                        {g.priority} priority
                      </span>
                      {g.feasibility_status && (
                        <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize" style={{ background: fs.bg, color: fs.text }}>
                          <FIcon size={10} /> {g.feasibility_status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#050816]">{g.goal_text}</p>
                    {g.measurable_outcome && <p className="mt-1 text-xs text-[#64748B]">Outcome: {g.measurable_outcome}</p>}
                    {g.feasibility_note && g.feasibility_status === 'unrealistic' && (
                      <p className="mt-2 text-xs font-semibold text-[#B91C1C]">⚠ {g.feasibility_note}</p>
                    )}
                    {g.estimated_hours && <p className="mt-1 text-xs text-[#94A3B8]">{g.estimated_hours}h/week estimated</p>}
                  </div>
                  <select className="rounded-lg border border-[#E2E8F0] bg-[#FAFAF9] px-2 py-1.5 text-xs text-[#334155] outline-none"
                    value={g.status} onChange={e => updateStatus(g.id, e.target.value)}>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="deferred">Deferred</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}