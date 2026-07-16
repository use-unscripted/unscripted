import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import TaskRow from '@/components/TaskRow';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WeeklyCalendar() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => { base44.entities.Task.list('-created_date', 50).then(setTasks); }, []);

  const toggle = async (t) => {
    const completed = !t.completed;
    setTasks(tasks.map(x => x.id === t.id ? { ...x, completed } : x));
    await base44.entities.Task.update(t.id, { completed, completed_at: completed ? new Date().toISOString() : null });
  };

  const done = tasks.filter(x => x.completed).length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Weekly execution"
        title="Make the week count."
        description={`${done} of ${tasks.length} actions complete. This plan is intentionally finite — finish it before adding more.`}
      />
      <div className="mb-8 h-2 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #2563EB, #7C3AED)' }}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {days.map(day => (
          <section key={day} className="min-h-40 rounded-[20px] p-4" style={{ background: '#EEF2F7' }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-sm font-bold text-[#07111F]">{day}</h2>
              <span className="text-xs text-[#64748B]">{tasks.filter(x => x.day === day).length} actions</span>
            </div>
            <div className="space-y-3">
              {tasks.filter(x => x.day === day).map(t => (
                <TaskRow key={t.id} task={t} onToggle={toggle} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}