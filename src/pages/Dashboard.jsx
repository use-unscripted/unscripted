import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowRight, Flame, Target, Users, Briefcase, BookOpen, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import MetricCard from '@/components/MetricCard';
import TaskRow from '@/components/TaskRow';

export default function Dashboard() {
  const [data, setData] = useState({ tasks: [], profile: null, experiments: [], outreach: [], proof: [], goals: [], reflections: [] });

  const load = async () => {
    const [tasks, profiles, experiments, outreach, proof, goals, reflections] = await Promise.all([
      base44.entities.Task.list('-created_date', 50),
      base44.entities.AmbitionProfile.list('-created_date', 1),
      base44.entities.Experiments.list('-created_date', 20),
      base44.entities.OutreachContacts.list('-created_date', 50),
      base44.entities.ProofOfWork.list('-created_date', 50),
      base44.entities.Goals.filter({ status: 'active' }, '-created_date', 20),
      base44.entities.WeeklyReflections.list('-created_date', 1),
    ]);
    setData({ tasks, profile: profiles[0], experiments, outreach, proof, goals, reflections });
  };

  useEffect(() => { load(); }, []);

  const toggle = async (t) => {
    await base44.entities.Task.update(t.id, { completed: !t.completed, completed_at: !t.completed ? new Date().toISOString() : null });
    load();
  };

  const done = data.tasks.filter(x => x.completed);
  const next = data.tasks.find(x => !x.completed);
  const pct = data.tasks.length ? Math.round(done.length / data.tasks.length * 100) : 0;
  const overdueOutreach = data.outreach.filter(c => c.followup_date && new Date(c.followup_date) < new Date() && !['completed', 'responded'].includes(c.response_status));
  const activeExperiments = data.experiments.filter(e => e.status === 'in_progress');
  const completedExperiments = data.experiments.filter(e => e.status === 'completed');
  const annualGoals = data.goals.filter(g => g.timeframe === 'annual');
  const unrealisticGoals = data.goals.filter(g => g.feasibility_status === 'unrealistic');

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Unscripted Dashboard"
        title="Build evidence this week."
        description={data.profile?.identity_statement}
      />

      {/* Unrealistic goal warning */}
      {unrealisticGoals.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-[16px] p-4" style={{ background: '#FFFBEB', border: '1px solid rgba(180,83,9,0.25)' }}>
          <AlertTriangle size={18} className="shrink-0 text-[#B45309] mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#B45309]">Goal feasibility issue</p>
            <p className="text-sm text-[#334155] mt-0.5">{unrealisticGoals.length} of your goals may not be realistic given your available time. <Link to="/goals" className="font-semibold underline" style={{ color: '#8B0C21' }}>Review goals →</Link></p>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="This week" value={`${done.length}/${data.tasks.length}`} detail="actions complete" />
        <MetricCard label="Experiments" value={completedExperiments.length} detail={`${activeExperiments.length} active`} accent="green" />
        <MetricCard label="Outreach" value={data.outreach.filter(c => c.response_status !== 'not_sent').length} detail="conversations started" accent="violet" />
        <MetricCard label="Proof of work" value={data.proof.length} detail="entries documented" accent="amber" />
      </div>

      {/* Progress */}
      <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#8B0C21' }} />
      </div>

      {/* Next best action */}
      <section className="mt-6 rounded-[22px] p-7 text-white" style={{ background: '#081225', border: '1px solid rgba(139,12,33,0.30)' }}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>
          <Flame size={14} /> Your next best action
        </div>
        <h2 className="font-heading mt-4 text-2xl font-bold">
          {next?.task_title || 'You finished the week. Complete your weekly reflection.'}
        </h2>
        {next && <p className="mt-2 text-sm text-slate-400">{next.day}{next.time && ` · ${next.time}`}</p>}
        {!next && (
          <Link to="/reflection" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold transition hover:opacity-80" style={{ color: '#8B0C21' }}>
            Go to reflection <ArrowRight size={14} />
          </Link>
        )}
      </section>

      {/* Overdue outreach */}
      {overdueOutreach.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-[16px] p-4" style={{ background: '#FFFBEB', border: '1px solid rgba(180,83,9,0.2)' }}>
          <AlertTriangle size={16} className="shrink-0 text-[#B45309] mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#B45309]">{overdueOutreach.length} overdue follow-up{overdueOutreach.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-[#334155] mt-0.5">You planned to send these. Reschedule, reduce the target, or mark complete.</p>
          </div>
          <Link to="/outreach" className="text-xs font-semibold" style={{ color: '#8B0C21' }}>Review →</Link>
        </div>
      )}

      {/* Quick nav cards */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: '/paths', label: 'Paths exploring', Icon: Target, value: data.experiments.length > 0 ? `${new Set(data.experiments.map(e => e.path_name).filter(Boolean)).size} paths` : 'Get started' },
          { to: '/experiments', label: 'Active missions', Icon: Briefcase, value: `${activeExperiments.length} in progress` },
          { to: '/outreach', label: 'Outreach tracker', Icon: Users, value: `${data.outreach.length} contacts` },
          { to: '/proof', label: 'Proof of work', Icon: BookOpen, value: `${data.proof.length} entries` },
        ].map(({ to, label, Icon, value }) => (
          <Link key={to} to={to} className="flex items-center gap-3 rounded-[16px] border border-[#E2E8F0] bg-white p-4 transition hover:border-[rgba(139,12,33,0.25)] hover:shadow-sm hover:-translate-y-0.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: '#F8ECEF' }}>
              <Icon size={16} style={{ color: '#8B0C21' }} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#64748B]">{label}</p>
              <p className="text-sm font-bold text-[#050816]">{value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* This week's tasks */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold text-[#050816]">This week's actions</h2>
        <Link to="/calendar" className="flex items-center gap-1 text-sm font-semibold transition hover:opacity-80" style={{ color: '#8B0C21' }}>
          Full week <ArrowRight size={15} />
        </Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {data.tasks.slice(0, 6).map(t => (
          <TaskRow key={t.id} task={t} onToggle={toggle} />
        ))}
        {data.tasks.length === 0 && (
          <div className="rounded-[20px] border border-dashed border-[#E2E8F0] p-8 text-center text-[#64748B] md:col-span-2">
            No tasks yet. <Link to="/generating" className="font-semibold" style={{ color: '#8B0C21' }}>Generate your first plan →</Link>
          </div>
        )}
      </div>

      {/* Annual goals snapshot */}
      {annualGoals.length > 0 && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold text-[#050816]">Annual goals</h2>
            <Link to="/goals" className="flex items-center gap-1 text-sm font-semibold transition hover:opacity-80" style={{ color: '#8B0C21' }}>
              All goals <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {annualGoals.slice(0, 4).map(g => (
              <div key={g.id} className="rounded-[16px] border border-[#E2E8F0] bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[#050816]">{g.goal_text}</p>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold capitalize"
                    style={g.priority === 'high' ? { background: '#F8ECEF', color: '#8B0C21' } : g.priority === 'medium' ? { background: '#FFFBEB', color: '#B45309' } : { background: '#F1F5F9', color: '#64748B' }}>
                    {g.priority}
                  </span>
                </div>
                {g.measurable_outcome && <p className="mt-1 text-xs text-[#64748B]">{g.measurable_outcome}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Weekly reflection prompt */}
      {data.reflections.length === 0 && (
        <div className="mt-8 rounded-[20px] p-6 text-center" style={{ background: '#F8ECEF', border: '1px solid rgba(139,12,33,0.2)' }}>
          <p className="font-heading font-bold text-[#050816]">Complete your weekly reflection</p>
          <p className="mt-1 text-sm text-[#334155]">Reflections adjust your roadmap over time. They take 5 minutes.</p>
          <Link to="/reflection" className="mt-4 inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px"
            style={{ background: '#8B0C21' }}>
            Start reflection <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </main>
  );
}