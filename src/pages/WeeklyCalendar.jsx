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
  personal: '#84CC16', deep_work: '#EF4444', low_energy: '#94A3B8',
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
          <h2 className="font-heading text-lg font-bold text-[#050816]">{block ? 'Edit Commitment' : 'Add Fixed Commitment'}</h2>
          <button onClick={onClose}><X size={18} className="text-[#64748B]" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Type</span>
            <select name="block_type" value={data.block_type} onChange={ch}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
              {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Label (optional)</span>
            <input name="title" value={data.title || ''} onChange={ch} placeholder="e.g. BIO 301, Morning workout"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Day</span>
            <select name="day" value={data.day} onChange={ch}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Energy level</span>
            <select name="energy_level" value={data.energy_level || 'medium'} onChange={ch}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Start time</span>
            <input type="time" name="start_time" value={data.start_time || ''} onChange={ch}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#334155] block mb-1">End time</span>
            <input type="time" name="end_time" value={data.end_time || ''} onChange={ch}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155]">Cancel</button>
          <button onClick={() => onSave(data)} className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold text-white"
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
          <h2 className="font-heading text-lg font-bold text-[#050816]">{task ? 'Edit Task' : 'Add Mission Task'}</h2>
          <button onClick={onClose}><X size={18} className="text-[#64748B]" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Task title *</span>
            <input name="task_title" value={data.task_title || ''} onChange={ch} placeholder="What will you do?"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Type</span>
            <select name="task_type" value={data.task_type || 'career'} onChange={ch}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
              {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Linked mission</span>
            <select name="roadmap_id" value={data.roadmap_id || ''} onChange={ch}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
              <option value="">None</option>
              {experiments.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Day</span>
            <select name="day" value={data.day || 'Monday'} onChange={ch}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Time (optional)</span>
            <input type="time" name="time" value={data.time || ''} onChange={ch}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F] ${conflict ? 'border-[#B91C1C] bg-[#FEF2F2]' : 'border-[#E2E8F0] bg-[#FAFAF9]'}`} />
          </label>
        </div>
        {conflict && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#B91C1C]">
            <AlertTriangle size={13} /> This time overlaps a fixed commitment. Choose a different time.
          </p>
        )}
        {!data.task_title?.trim() && <p className="mt-3 text-xs text-[#B91C1C] font-semibold">Title is required.</p>}
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155]">Cancel</button>
          <button onClick={() => { if (data.task_title?.trim()) onSave(data); }} disabled={conflict}
            className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
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
              className="flex items-center gap-1.5 rounded-[10px] border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold text-[#334155] hover:bg-white transition">
              <Plus size={14} /> Add Commitment
            </button>
            <button onClick={() => setTaskModal('new')}
              className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px"
              style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
              <Plus size={14} /> Add Task
            </button>
          </div>
        }
      />

      {/* Capacity summary */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-1">Fixed commitments</p>
          <p className="font-heading text-2xl font-bold text-[#050816]">{fixedHours.toFixed(1)}h</p>
          <p className="text-xs text-[#64748B]">blocked per week</p>
        </div>
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-1">Available hours</p>
          <p className="font-heading text-2xl font-bold" style={{ color: availableHours < 10 ? '#B91C1C' : '#15803D' }}>{availableHours.toFixed(1)}h</p>
          <p className="text-xs text-[#64748B]">remaining this week</p>
        </div>
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-1">Tasks complete</p>
          <p className="font-heading text-2xl font-bold text-[#050816]">{done}/{tasks.length}</p>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-navy-900)' }} />
          </div>
        </div>
      </div>

      {/* Over-capacity warning */}
      {overCapacity && (
        <div className="mb-5 flex items-start gap-3 rounded-[16px] p-4" style={{ background: '#FFFBEB', border: '1px solid rgba(180,83,9,0.25)' }}>
          <AlertTriangle size={15} className="shrink-0 text-[#B45309] mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#B45309]">You may be over capacity</p>
            <p className="text-xs text-[#334155] mt-0.5">Your remaining {tasks.filter(t => !t.completed).length} open tasks (~{taskHoursEst}h estimated) may exceed your {availableHours.toFixed(1)}h of free time. Consider rescheduling or removing lower-priority tasks.</p>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {[['plan', 'Mission Tasks'], ['commitments', 'Fixed Commitments'], ['export', 'Export to Calendar']].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            className="rounded-[10px] px-4 py-2.5 text-sm font-semibold transition"
            style={tab === val ? { background: 'var(--brand-navy-900)', color: '#fff' } : { background: '#F1F5F9', color: '#334155' }}>
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
              <section key={day} className="rounded-[20px] border border-[#E2E8F0] bg-white overflow-hidden">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setExpandedDay(expandedDay === day ? null : day)}>
                  <div className="flex items-center gap-3">
                    <h2 className="font-heading font-bold text-[#050816]">{day}</h2>
                    <span className="text-xs text-[#64748B]">{dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}</span>
                    {dayTasks.some(t => overlapsBlock(t.time, day, blocks)) && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-[#B91C1C]">
                        <AlertTriangle size={11} /> conflict
                      </span>
                    )}
                  </div>
                  {expandedDay === day ? <ChevronUp size={16} className="text-[#64748B]" /> : <ChevronDown size={16} className="text-[#64748B]" />}
                </button>
                {(expandedDay === day || dayTasks.length > 0) && (
                  <div className="border-t border-[#E2E8F0] px-5 pb-4">
                    <div className="space-y-2 mt-3">
                      {dayTasks.length === 0 && (
                        <p className="text-xs text-[#94A3B8] py-2">No tasks scheduled.</p>
                      )}
                      {dayTasks.map(t => {
                        const conflict = overlapsBlock(t.time, day, blocks);
                        return (
                          <div key={t.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${conflict ? 'border border-[#FECACA]' : 'border border-[#F1F5F9]'}`}
                            style={{ background: t.completed ? '#F0FDF4' : conflict ? '#FEF2F2' : '#FAFAF9' }}>
                            <button onClick={() => toggleTask(t)} className="shrink-0">
                              {t.completed
                                ? <CheckCircle size={16} style={{ color: '#15803D' }} />
                                : <div className="h-4 w-4 rounded-full border-2 border-[#CBD5E1]" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${t.completed ? 'line-through text-[#94A3B8]' : 'text-[#050816]'}`}>{t.task_title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {t.time && <span className="text-xs text-[#64748B]"><Clock size={10} className="inline mr-0.5" />{t.time}</span>}
                                {t.task_type && <span className="text-xs capitalize text-[#94A3B8]">{t.task_type}</span>}
                                {conflict && <span className="text-xs font-semibold text-[#B91C1C]">⚠ time conflict</span>}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => setCalendarModal({ ...t, title: t.task_title })}
                                className="rounded-lg p-1.5 text-[#94A3B8] hover:text-[#274C77] transition"
                                title="Add to Calendar">
                                <Calendar size={13} />
                              </button>
                              <button onClick={() => setTaskModal(t)}
                                className="rounded-lg px-2 py-1 text-xs font-semibold text-[#334155] hover:bg-[#E2E8F0] transition">
                                Edit
                              </button>
                              <button onClick={() => deleteTask(t.id)}
                                className="rounded-lg p-1 text-[#94A3B8] hover:text-[#B91C1C] transition">
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => setTaskModal({ day, task_title: '', task_type: 'career', completed: false })}
                      className="mt-3 flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-80"
                      style={{ color: 'var(--brand-navy-700)' }}>
                      <Plus size={12} /> Add task for {day}
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
            <div className="rounded-[24px] border border-dashed border-[#E2E8F0] p-12 text-center">
              <p className="font-heading font-bold text-[#050816]">No fixed commitments yet</p>
              <p className="mt-2 text-sm text-[#64748B]">Add your classes, work shifts, sleep, and other recurring blocks so your available hours are calculated correctly.</p>
              <button onClick={() => setBlockModal('new')}
                className="mt-5 inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: 'var(--brand-navy-900)' }}>
                <Plus size={14} /> Add first commitment
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {DAYS.map(day => {
                const dayBlocks = blocks.filter(b => b.day === day);
                if (dayBlocks.length === 0) return null;
                return (
                  <section key={day}>
                    <h3 className="font-heading font-bold text-[#050816] mb-2">{day}</h3>
                    <div className="space-y-2">
                      {dayBlocks.map(b => (
                        <div key={b.id} className="flex items-center gap-3 rounded-[16px] border border-[#E2E8F0] bg-white px-4 py-3">
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ background: BLOCK_COLORS[b.block_type] || '#94A3B8' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#050816]">{b.title || b.block_type.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-[#64748B]">
                              {b.start_time && b.end_time ? `${b.start_time} – ${b.end_time}` : 'No time set'}
                              {b.energy_level && ` · ${b.energy_level} energy`}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => setBlockModal(b)}
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-[#334155] hover:bg-[#E2E8F0] transition">Edit</button>
                            <button onClick={() => deleteBlock(b.id)}
                              className="rounded-lg p-1 text-[#94A3B8] hover:text-[#B91C1C] transition">
                              <X size={13} />
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