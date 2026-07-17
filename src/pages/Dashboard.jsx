import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowRight, Flame } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import MetricCard from '@/components/MetricCard';
import TaskRow from '@/components/TaskRow';

export default function Dashboard() {
  const [data, setData] = useState({ tasks: [], profile: null });

  const load = async () => {
    const [tasks, profiles] = await Promise.all([
      base44.entities.Task.list('-created_date', 50),
      base44.entities.AmbitionProfile.list('-created_date', 1),
    ]);
    setData({ tasks, profile: profiles[0] });
  };

  useEffect(() => { load(); }, []);

  const toggle = async (t) => {
    await base44.entities.Task.update(t.id, {
      completed: !t.completed,
      completed_at: !t.completed ? new Date().toISOString() : null,
    });
    load();
  };

  const done = data.tasks.filter(x => x.completed);
  const next = data.tasks.find(x => !x.completed);
  const pct = data.tasks.length ? Math.round(done.length / data.tasks.length * 100) : 0;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Unscripted Dashboard"
        title="Build evidence this week."
        description={data.profile?.identity_statement}
      />

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Weekly progress" value={`${done.length}/${data.tasks.length}`} detail="actions complete" />
        <MetricCard label="Networking" value={done.filter(x => x.task_type === 'networking').length} detail="moves made" accent="violet" />
        <MetricCard label="Proof of work" value={done.filter(x => ['content', 'project'].includes(x.task_type)).length} detail="outputs shipped" accent="green" />
        <MetricCard label="Momentum" value={done.length ? `${Math.min(done.length, 7)} days` : 'Start'} detail="current streak" accent="amber" />
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: '#8B0C21' }}
        />
      </div>

      {/* Next best action */}
      <section
        className="mt-6 rounded-[22px] p-7 text-white"
        style={{
          background: '#081225',
          border: '1px solid rgba(139,12,33,0.30)',
        }}
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>
          <Flame size={14} /> Your next best action
        </div>
        <h2 className="font-heading mt-4 text-2xl font-bold">
          {next?.task_title || 'You finished the week. Review what worked.'}
        </h2>
        {next && <p className="mt-2 text-sm text-slate-400">{next.day}{next.time && ` · ${next.time}`}</p>}
      </section>

      {/* This week */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold text-[#050816]">This week's actions</h2>
        <Link
          to="/calendar"
          className="flex items-center gap-1 text-sm font-semibold transition hover:opacity-80"
          style={{ color: '#8B0C21' }}
        >
          Full week <ArrowRight size={15} />
        </Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {data.tasks.slice(0, 6).map(t => (
          <TaskRow key={t.id} task={t} onToggle={toggle} />
        ))}
      </div>
    </main>
  );
}