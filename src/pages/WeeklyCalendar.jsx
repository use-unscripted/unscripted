import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { Plus, X, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import ICSExportPanel from '@/components/calendar/ICSExportPanel';
import AddToCalendarModal from '@/components/calendar/AddToCalendarModal';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const BLOCK_TYPES = [
  { value: 'class', label: 'Class' },
  { value: 'work', label: 'Work' },
  { value: 'club', label: 'Club / Activity' },
  { value: 'athletic', label: 'Athletic' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'meal', label: 'Meals / Commute' },
  { value: 'study', label: 'Study' },
  { value: 'social', label: 'Social' },
  { value: 'personal', label: 'Personal' },
];

const TASK_TYPES = [
  { value: 'career', label: 'Career' },
  { value: 'networking', label: 'Networking' },
  { value: 'content', label: 'Content' },
  { value: 'project', label: 'Project' },
  { value: 'skill', label: 'Skill' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'reflection', label: 'Reflection' },
];

const BLOCK_COLORS = {
  class: '#3B82F6', work: '#8B5CF6', club: '#F59E0B', athletic: '#10B981',
  sleep: '#6B7280', meal: '#F97316', study: '#06B6D4', social: '#EC4899',
  personal: '#84CC16', deep_work: '#EF4444', low_energy: 'var(--ink-400)',
};

function toMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

function hoursFromBlocks(blocks) {
  return blocks.reduce((sum, b) => {
    const start = toMinutes(b.start_time);
    const end = toMinutes(b.end_time);
    if (start !== null && end !== null && end > start) return sum + (end - start) / 60;
    return sum;
  }, 0);
}

function overlapsBlock(taskTime, taskDay, blocks) {
  if (!taskTime) return false;
  const taskMin = toMinutes(taskTime);
  return blocks.filter(b => b.day === taskDay).some(b => {
    const s = toMinutes(b.start_time);
    const e = toMinutes(b.end_time);
    if (s === null || e === null) return false;
    return taskMin >= s && taskMin < e;
  });
}

// --- Modals ---
function BlockModal({ block, onClose, onSave }) {
  const [data, setData] = useState(block || { block_type: 'class', title: '', day: 'Monday', start_time: '09:00', end_time: '10:00', recurring: true, energy_level: 'medium', fixed_or_flexible: 'fixed' });
  const ch = e => setData(d => ({ ...d, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6">
        <div className="flex justify-between mb-5">
          <h2 className="tp-section text-[color:var(--surface-dark-900)]">{block ? 'Edit Commitment' : 'Add Fixed Commitment'}</h2>
          <button onClick={onClose}><X size={18} className="text-[color:var(--ink-500)]" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Type</span>
            <select name="block_type" value={data.block_type} onChange={ch}
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]">
              {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Label (optional)</span>
            <input name="title" value={data.title || ''} onChange={ch} placeholder="e.g. BIO 301, Morning workout"
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
          </label>
          <label className="block">
            <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Day</span>
            <select name="day" value={data.day} onChange={ch}
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]">
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Energy level</span>
            <select name="energy_level" value={data.energy_level || 'medium'} onChange={ch}
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="block">
            <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Start time</span>
            <input type="time" name="start_time" value={data.start_time || ''} onChange={ch}
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
          </label>
          <label className="block">
            <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">End time</span>
            <input type="time" name="end_time" value={data.end_time || ''} onChange={ch}
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="tp-body flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-3 font-semibold text-[color:var(--ink-700)]">Cancel</button>
          <button onClick={() => onSave(data)} className="tp-body flex-1 rounded-[10px] py-3 font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)' }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function TaskModal({ task, experiments, blocks, onClose, onSave }) {
  const [data, setData] = useState(task || { task_title: '', task_type: 'career', day: 'Monday', time: '', completed: false });
  const ch = e => setData(d => ({ ...d, [e.target.name]: e.target.value }));
  const conflict = overlapsBlock(data.time, data.day, blocks);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6">
        <div className="flex justify-between mb-5">
          <h2 className="tp-section text-[color:var(--surface-dark-900)]">{task ? 'Edit Task' : 'Add Mission Task'}</h2>
          <button onClick={onClose}><X size={18} className="text-[color:var(--ink-500)]" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Task title *</span>
            <input name="task_title" value={data.task_title || ''} onChange={ch} placeholder="What will you do?"
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
          </label>
          <label className="block">
            <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Type</span>
            <select name="task_type" value={data.task_type || 'career'} onChange={ch}
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]">
              {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Linked mission</span>
            <select name="roadmap_id" value={data.roadmap_id || ''} onChange={ch}
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]">
              <option value="">None</option>
              {experiments.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Day</span>
            <select name="day" value={data.day || 'Monday'} onChange={ch}
              className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]">
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Time (optional)</span>
            <input type="time" name="time" value={data.time || ''} onChange={ch}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[color:var(--brand-navy-900)] ${conflict ? 'border-[color:var(--danger-700)] bg-[color:var(--danger-50)]' : 'border-[color:var(--ink-200)] bg-[color:var(--page-surface)]'}`} />
          </label>
        </div>
        {conflict && (
          <p className="tp-meta mt-3 flex items-center gap-1.5 font-semibold text-[color:var(--danger-700)]">
            <AlertTriangle size={14} /> This time overlaps a fixed commitment. Choose a different time.
          </p>
        )}
        {!data.task_title?.trim() && <p className="tp-meta mt-3 text-[color:var(--danger-700)] font-semibold">Title is required.</p>}
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="tp-body flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-3 font-semibold text-[color:var(--ink-700)]">Cancel</button>
          <button onClick={() => { if (data.task_title?.trim()) onSave(data); }} disabled={conflict}
            className="tp-body flex-1 rounded-[10px] py-3 font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--brand-navy-900)' }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function WeeklyCalendar() {
  const [tasks, setTasks] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [taskModal, setTaskModal] = useState(null);
  const [blockModal, setBlockModal] = useState(null);
  const [calendarModal, setCalendarModal] = useState(null); // task to export
  const [tab, setTab] = useState('plan'); // 'plan' | 'commitments' | 'export'
  const [expandedDay, setExpandedDay] = useState(null);

  const load = async () => {
    const [t, b, e] = await Promise.all([
      base44.entities.Task.list('-created_date', 100),
      base44.entities.ScheduleBlocks.list('-created_date', 200),
      base44.entities.Experiments.filter({ status: 'in_progress' }, '-created_date', 20),
    ]);
    setTasks(t);
    setBlocks(b);
    setExperiments(e);
  };

  useEffect(() => { load(); }, []);

  // Hours calculation
  const fixedHours = hoursFromBlocks(blocks);
  const totalWeekHours = 168;
  const availableHours = Math.max(0, totalWeekHours - fixedHours);
  const taskHoursEst = tasks.filter(t => !t.completed).length * 1; // ~1h per task estimate
  const overCapacity = taskHoursEst > availableHours;

  const toggleTask = async (t) => {
    const completed = !t.completed;
    setTasks(tasks.map(x => x.id === t.id ? { ...x, completed } : x));
    await base44.entities.Task.update(t.id, { completed, completed_at: completed ? new Date().toISOString() : null });
  };

  const saveTask = async (data) => {
    if (data.id) await base44.entities.Task.update(data.id, data);
    else await base44.entities.Task.create(data);
    setTaskModal(null);
    load();
  };

  const deleteTask = async (id) => {
    await base44.entities.Task.delete(id);
    load();
  };

  const saveBlock = async (data) => {
    if (data.id) await base44.entities.ScheduleBlocks.update(data.id, data);
    else await base44.entities.ScheduleBlocks.create(data);
    setBlockModal(null);
    load();
  };

  const deleteBlock = async (id) => {
    await base44.entities.ScheduleBlocks.delete(id);
    load();
  };

  const done = tasks.filter(x => x.completed).length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  return (
    <main className="app-page">
      {taskModal !== null && (
        <TaskModal
          task={taskModal === 'new' ? null : taskModal}
          experiments={experiments}
          blocks={blocks}
          onClose={() => setTaskModal(null)}
          onSave={saveTask}
        />
      )}
      {blockModal !== null && (
        <BlockModal
          block={blockModal === 'new' ? null : blockModal}
          onClose={() => setBlockModal(null)}
          onSave={saveBlock}
        />
      )}
      {calendarModal && (
        <AddToCalendarModal
          item={calendarModal}
          itemType="task"
          onClose={() => setCalendarModal(null)}
        />
      )}

      <PageHeader
        title="Make the week count."
        description="Plan around your fixed commitments. Protect your available hours for mission work."
        action={
          <div className="flex gap-2">
            <button onClick={() => setBlockModal('new')}
              className="tp-body flex items-center gap-1.5 rounded-[10px] border border-[color:var(--ink-200)] px-5 py-3 font-semibold text-[color:var(--ink-700)] hover:bg-white transition">
              <Plus size={15} /> Add Commitment
            </button>
            <button onClick={() => setTaskModal('new')}
              className="tp-body flex items-center gap-1.5 rounded-[10px] px-5 py-3 font-semibold text-white transition hover:-translate-y-px"
              style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
              <Plus size={15} /> Add Task
            </button>
          </div>
        }
      />

      {/* Capacity summary */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[16px] border border-[color:var(--ink-200)] bg-white p-5">
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Fixed commitments</p>
          <p className="font-heading text-2xl font-bold text-[color:var(--surface-dark-900)]">{fixedHours.toFixed(1)}h</p>
          <p className="tp-meta text-[color:var(--ink-500)]">blocked per week</p>
        </div>
        <div className="rounded-[16px] border border-[color:var(--ink-200)] bg-white p-5">
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Available hours</p>
          <p className="font-heading text-2xl font-bold" style={{ color: availableHours < 10 ? 'var(--danger-700)' : 'var(--success-700)' }}>{availableHours.toFixed(1)}h</p>
          <p className="tp-meta text-[color:var(--ink-500)]">remaining this week</p>
        </div>
        <div className="rounded-[16px] border border-[color:var(--ink-200)] bg-white p-5">
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Tasks complete</p>
          <p className="font-heading text-2xl font-bold text-[color:var(--surface-dark-900)]">{done}/{tasks.length}</p>
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-200)' }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-navy-900)' }} />
          </div>
        </div>
      </div>

      {/* Over-capacity warning */}
      {overCapacity && (
        <div className="mb-6 flex items-start gap-3 rounded-[16px] p-5" style={{ background: 'var(--warning-50)', border: '1px solid rgba(180,83,9,0.25)' }}>
          <AlertTriangle size={17} className="shrink-0 text-[color:var(--warning-700)] mt-0.5" />
          <div>
            <p className="tp-card text-[color:var(--warning-700)]">You may be over capacity</p>
            <p className="tp-prose text-[color:var(--ink-700)] mt-1.5">Your remaining {tasks.filter(t => !t.completed).length} open tasks (~{taskHoursEst}h estimated) may exceed your {availableHours.toFixed(1)}h of free time. Consider rescheduling or removing lower-priority tasks.</p>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="mb-7 flex gap-2 flex-wrap">
        {[['plan', 'Mission Tasks'], ['commitments', 'Fixed Commitments'], ['export', 'Export to Calendar']].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            className="tp-body rounded-[10px] px-5 py-3 font-semibold transition"
            style={tab === val ? { background: 'var(--brand-navy-900)', color: '#fff' } : { background: 'var(--ink-100)', color: 'var(--ink-700)' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'export' ? (
        <ICSExportPanel />
      ) : tab === 'plan' ? (
        <div className="space-y-3">
          {DAYS.map(day => {
            const dayTasks = tasks.filter(t => t.day === day);
            const expanded = expandedDay === day || dayTasks.length > 0;
            return (
              <section key={day} className="rounded-[20px] border border-[color:var(--ink-200)] bg-white overflow-hidden">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setExpandedDay(expandedDay === day ? null : day)}>
                  <div className="flex items-center gap-3">
                    <h2 className="tp-section text-[color:var(--surface-dark-900)]">{day}</h2>
                    <span className="tp-meta text-[color:var(--ink-500)]">{dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}</span>
                    {dayTasks.some(t => overlapsBlock(t.time, day, blocks)) && (
                      <span className="tp-meta flex items-center gap-1 font-semibold text-[color:var(--danger-700)]">
                        <AlertTriangle size={13} /> conflict
                      </span>
                    )}
                  </div>
                  {expandedDay === day ? <ChevronUp size={16} className="text-[color:var(--ink-500)]" /> : <ChevronDown size={16} className="text-[color:var(--ink-500)]" />}
                </button>
                {(expandedDay === day || dayTasks.length > 0) && (
                  <div className="border-t border-[color:var(--ink-200)] px-5 pb-4">
                    <div className="space-y-2 mt-3">
                      {dayTasks.length === 0 && (
                        <p className="tp-meta text-[color:var(--ink-400)] py-2">No tasks scheduled.</p>
                      )}
                      {dayTasks.map(t => {
                        const conflict = overlapsBlock(t.time, day, blocks);
                        return (
                          <div key={t.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${conflict ? 'border border-[#FECACA]' : 'border border-[color:var(--ink-100)]'}`}
                            style={{ background: t.completed ? 'var(--success-50)' : conflict ? 'var(--danger-50)' : 'var(--page-surface)' }}>
                            <button onClick={() => toggleTask(t)} className="shrink-0">
                              {t.completed
                                ? <CheckCircle size={16} style={{ color: 'var(--success-700)' }} />
                                : <div className="h-4 w-4 rounded-full border-2 border-[color:var(--ink-300)]" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`tp-body font-semibold truncate ${t.completed ? 'line-through text-[color:var(--ink-400)]' : 'text-[color:var(--surface-dark-900)]'}`}>{t.task_title}</p>
                              <div className="tp-meta flex items-center gap-3 mt-1 flex-wrap">
                                {t.time && <span className="text-[color:var(--ink-500)]"><Clock size={13} className="inline mr-1 -mt-px" />{t.time}</span>}
                                {t.task_type && <span className="capitalize text-[color:var(--ink-400)]">{t.task_type}</span>}
                                {conflict && <span className="inline-flex items-center gap-1 font-semibold text-[color:var(--danger-700)]"><AlertTriangle size={13} aria-hidden="true" />Time conflict</span>}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => setCalendarModal({ ...t, title: t.task_title })}
                                className="rounded-lg p-1.5 text-[color:var(--ink-400)] hover:text-[color:var(--brand-navy-700)] transition"
                                title="Add to Calendar">
                                <Calendar size={15} />
                              </button>
                              <button onClick={() => setTaskModal(t)}
                                className="tp-meta rounded-lg px-2.5 py-1.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-200)] transition">
                                Edit
                              </button>
                              <button onClick={() => deleteTask(t.id)}
                                className="rounded-lg p-1.5 text-[color:var(--ink-400)] hover:text-[color:var(--danger-700)] transition">
                                <X size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => setTaskModal({ day, task_title: '', task_type: 'career', completed: false })}
                      className="tp-meta mt-4 flex items-center gap-1.5 py-1 font-semibold transition hover:opacity-80"
                      style={{ color: 'var(--brand-navy-700)' }}>
                      <Plus size={14} /> Add task for {day}
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div>
          {blocks.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[color:var(--ink-200)] px-8 py-14 text-center">
              <p className="tp-section text-[color:var(--surface-dark-900)]">No fixed commitments yet</p>
              <p className="tp-prose mx-auto mt-2.5 text-[color:var(--ink-500)]">Add your classes, work shifts, sleep, and other recurring blocks so your available hours are calculated correctly.</p>
              <button onClick={() => setBlockModal('new')}
                className="tp-body mt-6 inline-flex items-center gap-2 rounded-[10px] px-6 py-3 font-semibold text-white"
                style={{ background: 'var(--brand-navy-900)' }}>
                <Plus size={15} /> Add first commitment
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {DAYS.map(day => {
                const dayBlocks = blocks.filter(b => b.day === day);
                if (dayBlocks.length === 0) return null;
                return (
                  <section key={day}>
                    <h3 className="tp-section text-[color:var(--surface-dark-900)] mb-3">{day}</h3>
                    <div className="space-y-2">
                      {dayBlocks.map(b => (
                        <div key={b.id} className="flex items-center gap-3 rounded-[16px] border border-[color:var(--ink-200)] bg-white px-4 py-3">
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ background: BLOCK_COLORS[b.block_type] || 'var(--ink-400)' }} />
                          <div className="flex-1 min-w-0">
                            <p className="tp-body font-semibold text-[color:var(--surface-dark-900)]">{b.title || b.block_type.replace(/_/g, ' ')}</p>
                            <p className="tp-meta mt-0.5 text-[color:var(--ink-500)]">
                              {b.start_time && b.end_time ? `${b.start_time} to ${b.end_time}` : 'No time set'}
                              {b.energy_level && ` · ${b.energy_level} energy`}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => setBlockModal(b)}
                              className="tp-meta rounded-lg px-2.5 py-1.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-200)] transition">Edit</button>
                            <button onClick={() => deleteBlock(b.id)}
                              className="rounded-lg p-1.5 text-[color:var(--ink-400)] hover:text-[color:var(--danger-700)] transition">
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}