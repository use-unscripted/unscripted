import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, ArrowRight, Target, Calendar, Clock } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';

const CATEGORIES = ['career', 'financial', 'academic', 'project', 'brand', 'networking', 'wellness'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const BLOCK_TYPES = [
  { value: 'class', label: 'Class' },
  { value: 'study', label: 'Study' },
  { value: 'work', label: 'Work' },
  { value: 'club', label: 'Club / Org' },
  { value: 'athletic', label: 'Athletics' },
  { value: 'commute', label: 'Commute' },
  { value: 'exercise', label: 'Exercise' },
  { value: 'social', label: 'Social commitments' },
  { value: 'personal', label: 'Personal obligations' },
];

function GoalRow({ goal, onChange, onRemove }) {
  return (
    <div className="rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="rounded-lg border border-[color:var(--ink-200)] bg-white px-3 py-2.5 text-base md:text-sm text-[color:var(--surface-dark-900)] placeholder-[color:var(--ink-400)] outline-none focus:border-[color:var(--brand-navy-900)] sm:col-span-2"
          placeholder="What is this goal?"
          value={goal.goal_text}
          onChange={e => onChange({ ...goal, goal_text: e.target.value })}
        />
        <input
          className="rounded-lg border border-[color:var(--ink-200)] bg-white px-3 py-2.5 text-sm text-[color:var(--surface-dark-900)] placeholder-[color:var(--ink-400)] outline-none focus:border-[color:var(--brand-navy-900)]"
          placeholder="Measurable outcome"
          value={goal.measurable_outcome}
          onChange={e => onChange({ ...goal, measurable_outcome: e.target.value })}
        />
        <select
          className="rounded-lg border border-[color:var(--ink-200)] bg-white px-3 py-2.5 text-base md:text-sm text-[color:var(--ink-700)] outline-none focus:border-[color:var(--brand-navy-900)]"
          value={goal.category}
          onChange={e => onChange({ ...goal, category: e.target.value })}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <select
          className="rounded-lg border border-[color:var(--ink-200)] bg-white px-3 py-2.5 text-base md:text-sm text-[color:var(--ink-700)] outline-none focus:border-[color:var(--brand-navy-900)]"
          value={goal.priority}
          onChange={e => onChange({ ...goal, priority: e.target.value })}
        >
          <option value="high">High priority</option>
          <option value="medium">Medium priority</option>
          <option value="low">Low priority</option>
        </select>
        <input type="number" min="0" max="40"
          className="rounded-lg border border-[color:var(--ink-200)] bg-white px-3 py-2.5 text-base md:text-sm text-[color:var(--surface-dark-900)] outline-none focus:border-[color:var(--brand-navy-900)]"
          placeholder="Estimated hours/week"
          value={goal.estimated_hours || ''}
          onChange={e => onChange({ ...goal, estimated_hours: Number(e.target.value) })}
        />
        <button onClick={onRemove} className="tp-meta font-semibold text-[color:var(--danger-700)] hover:underline text-left">Remove</button>
      </div>
    </div>
  );
}

function ScheduleBlockRow({ block, onChange, onRemove }) {
  return (
    <div className="grid gap-2 rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] p-3 sm:grid-cols-5">
      <select className="rounded-lg border border-[color:var(--ink-200)] bg-white px-2 py-2 text-base md:text-sm text-[color:var(--ink-700)] outline-none focus:border-[color:var(--brand-navy-900)]"
        value={block.block_type} onChange={e => onChange({ ...block, block_type: e.target.value })}>
        {BLOCK_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
      </select>
      <select className="rounded-lg border border-[color:var(--ink-200)] bg-white px-2 py-2 text-base md:text-sm text-[color:var(--ink-700)] outline-none focus:border-[color:var(--brand-navy-900)]"
        value={block.day} onChange={e => onChange({ ...block, day: e.target.value })}>
        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <input type="time" className="rounded-lg border border-[color:var(--ink-200)] bg-white px-2 py-2 text-base md:text-sm text-[color:var(--ink-700)] outline-none focus:border-[color:var(--brand-navy-900)]"
        value={block.start_time || ''} onChange={e => onChange({ ...block, start_time: e.target.value })} />
      <input type="time" className="rounded-lg border border-[color:var(--ink-200)] bg-white px-2 py-2 text-base md:text-sm text-[color:var(--ink-700)] outline-none focus:border-[color:var(--brand-navy-900)]"
        value={block.end_time || ''} onChange={e => onChange({ ...block, end_time: e.target.value })} />
      <button onClick={onRemove} className="tp-meta font-semibold text-[color:var(--danger-700)] hover:underline">Remove</button>
    </div>
  );
}

function newGoal(timeframe) { return { timeframe, category: 'career', priority: 'medium', goal_text: '', measurable_outcome: '', estimated_hours: 2 }; }
function newBlock() { return { block_type: 'class', day: 'Monday', start_time: '', end_time: '', recurring: true, energy_level: 'medium', fixed_or_flexible: 'fixed' }; }

export default function GoalIntake() {
  const nav = useNavigate();
  const [tab, setTab] = useState('annual');
  const [saving, setSaving] = useState(false);
  const [annualGoals, setAnnualGoals] = useState([newGoal('annual')]);
  const [monthlyGoals, setMonthlyGoals] = useState([newGoal('monthly')]);
  const [weeklyGoals, setWeeklyGoals] = useState([newGoal('weekly')]);
  const [scheduleBlocks, setScheduleBlocks] = useState([newBlock()]);
  const [availableHours, setAvailableHours] = useState(8);
  const [highEnergyTimes, setHighEnergyTimes] = useState('');
  const [lowEnergyTimes, setLowEnergyTimes] = useState('');

  const tabs = [
    { id: 'annual', label: 'Annual Goals', icon: Target },
    { id: 'monthly', label: 'Monthly Goals', icon: Calendar },
    { id: 'weekly', label: 'Weekly & Schedule', icon: Clock },
  ];

  const updateGoal = (list, setList, idx, val) => { const l = [...list]; l[idx] = val; setList(l); };
  const removeGoal = (list, setList, idx) => setList(list.filter((_, i) => i !== idx));
  const updateBlock = (idx, val) => { const l = [...scheduleBlocks]; l[idx] = val; setScheduleBlocks(l); };
  const removeBlock = (idx) => setScheduleBlocks(scheduleBlocks.filter((_, i) => i !== idx));

  const submit = async () => {
    setSaving(true);
    const allGoals = [...annualGoals, ...monthlyGoals, ...weeklyGoals].filter(g => g.goal_text.trim());
    await Promise.all([
      base44.entities.Goals.bulkCreate(allGoals),
      base44.entities.ScheduleBlocks.bulkCreate(scheduleBlocks.filter(b => b.day)),
      base44.entities.Schedule.create({ available_hours_per_week: availableHours, preferred_deep_work_times: highEnergyTimes, low_energy_times: lowEnergyTimes }),
      base44.auth.updateMe({ onboarding_completed: true }),
    ]);
    nav('/generating');
  };

  const goalsForTab = tab === 'annual' ? annualGoals : tab === 'monthly' ? monthlyGoals : weeklyGoals;
  const setGoalsForTab = tab === 'annual' ? setAnnualGoals : tab === 'monthly' ? setMonthlyGoals : setWeeklyGoals;

  return (
    <main className="min-h-[100svh]" style={{ background: 'var(--page-surface)' }}>
      <div className="app-page">
        <div className="mb-8 flex items-center justify-between">
          <LogoWordmark />
          <span className="tp-eyebrow text-[color:var(--ink-500)]">GOALS &amp; SCHEDULE</span>
        </div>

        <div className="mb-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-200)' }}>
          <div className="h-full rounded-full" style={{ width: '90%', background: 'var(--brand-navy-900)' }} />
        </div>

        <div className="mb-6 mt-8">
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Step 2 of 2</p>
          <h1 className="tp-page mt-2.5 text-[color:var(--surface-dark-900)]">Goals and schedule.</h1>
          <p className="tp-lead mt-3 text-[color:var(--ink-500)]">Be honest about what you can actually do with the time you have. Unscripted will tell you if your goals are realistic.</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 rounded-xl border border-[color:var(--ink-200)] bg-white p-1.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition"
              style={tab === id ? { background: 'var(--brand-navy-900)', color: '#fff' } : { color: 'var(--ink-500)' }}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        <div className="rounded-[24px] border border-[color:var(--ink-200)] bg-white p-6 sm:p-8">
          {tab !== 'weekly' ? (
            <div className="space-y-4">
              <p className="tp-body text-[color:var(--ink-500)]">
                {tab === 'annual' ? 'What would make the next 12 months successful? Be specific.' : 'What should be true 30 days from now? Which goals matter most this month?'}
              </p>
              {goalsForTab.map((g, i) => (
                <GoalRow key={i} goal={g}
                  onChange={val => updateGoal(goalsForTab, setGoalsForTab, i, val)}
                  onRemove={() => removeGoal(goalsForTab, setGoalsForTab, i)} />
              ))}
              <button onClick={() => setGoalsForTab([...goalsForTab, newGoal(tab)])}
                className="text-sm font-semibold transition hover:opacity-80" style={{ color: 'var(--brand-navy-900)' }}>
                + Add {tab} goal
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="tp-body text-[color:var(--ink-500)]">What must happen this week? Add your most important weekly actions.</p>
                {weeklyGoals.map((g, i) => (
                  <GoalRow key={i} goal={g}
                    onChange={val => updateGoal(weeklyGoals, setWeeklyGoals, i, val)}
                    onRemove={() => removeGoal(weeklyGoals, setWeeklyGoals, i)} />
                ))}
                <button onClick={() => setWeeklyGoals([...weeklyGoals, newGoal('weekly')])}
                  className="text-sm font-semibold transition hover:opacity-80" style={{ color: 'var(--brand-navy-900)' }}>
                  + Add weekly goal
                </button>
              </div>

              <div className="border-t border-[color:var(--ink-200)] pt-6">
                <h3 className="tp-section mb-4 text-[color:var(--surface-dark-900)]">Your fixed schedule</h3>
                <p className="tp-body mb-4 text-[color:var(--ink-500)]">Add your fixed commitments so we can plan around them, not over them.</p>
                <div className="space-y-2">
                  {scheduleBlocks.map((b, i) => (
                    <ScheduleBlockRow key={i} block={b}
                      onChange={val => updateBlock(i, val)}
                      onRemove={() => removeBlock(i)} />
                  ))}
                  <button onClick={() => setScheduleBlocks([...scheduleBlocks, newBlock()])}
                    className="text-sm font-semibold transition hover:opacity-80" style={{ color: 'var(--brand-navy-900)' }}>
                    + Add schedule block
                  </button>
                </div>
              </div>

              <div className="grid gap-4 border-t border-[color:var(--ink-200)] pt-6 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold text-[color:var(--ink-700)]">Available hours/week for growth</span>
                  <input type="number" min="1" max="40" value={availableHours}
                    onChange={e => setAvailableHours(Number(e.target.value))}
                    className="mt-2 w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
                  <p className="tp-meta mt-1 text-[color:var(--ink-400)]">Be conservative and honest.</p>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[color:var(--ink-700)]">High-energy times</span>
                  <input type="text" value={highEnergyTimes} onChange={e => setHighEnergyTimes(e.target.value)}
                    placeholder="e.g. 7-10am, after gym"
                    className="mt-2 w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[color:var(--ink-700)]">Low-energy times</span>
                  <input type="text" value={lowEnergyTimes} onChange={e => setLowEnergyTimes(e.target.value)}
                    placeholder="e.g. 2-4pm after lunch"
                    className="mt-2 w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <button onClick={() => nav('/onboarding')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[color:var(--ink-500)] hover:text-[color:var(--surface-dark-900)] transition">
            <ArrowLeft size={16} /> Back
          </button>
          {tab !== 'weekly' ? (
            <button onClick={() => setTab(tab === 'annual' ? 'monthly' : 'weekly')}
              className="flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-px"
              style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={submit} disabled={saving}
              className="flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-60"
              style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
              {saving ? 'Building your profile...' : 'Build My Unscripted Profile'} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}