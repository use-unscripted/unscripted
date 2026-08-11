import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Field from '@/components/onboarding/Field';
import { Clock3, ArrowRight } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';

const fields = [
  ['class_blocks', 'Class schedule', 'Mon/Wed 10-12, Tue/Thu 2-4...'],
  ['work_blocks', 'Work schedule', 'Shifts or recurring work'],
  ['club_blocks', 'Club commitments', 'Meetings and events'],
  ['athletic_blocks', 'Athletic commitments', 'Practice, training, games'],
  ['study_blocks', 'Study blocks', 'When you already plan to study'],
  ['social_commitments', 'Social commitments', 'Recurring plans worth protecting'],
  ['preferred_deep_work_times', 'Best deep-work times', 'When are you sharpest?'],
  ['low_energy_times', 'Usually low-energy', 'When should we avoid demanding work?'],
];

export default function ScheduleInput() {
  const nav = useNavigate();
  const [data, setData] = useState({ available_hours_per_week: 8 });
  const [saving, setSaving] = useState(false);

  const change = e => setData({ ...data, [e.target.name]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });

  const submit = async () => {
    setSaving(true);
    await base44.entities.Schedule.create(data);
    await base44.auth.updateMe({ onboarding_completed: true });
    nav('/generating');
  };

  return (
    <main className="min-h-[100svh]" style={{ background: 'var(--page-surface)' }}>
      <div className="app-page">
        <div className="mb-8">
          <div className="mb-6">
            <LogoWordmark />
          </div>
          <div
            className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--r-control)] text-white"
            style={{ background: 'var(--brand-navy-900)' }}
          >
            <Clock3 size={20} />
          </div>
          <h1 className="tp-page text-[color:var(--surface-dark-900)]">Build around your real week.</h1>
          <p className="tp-lead mt-3 text-[color:var(--ink-700)]">Your roadmap should fit your life, not compete with it.</p>
        </div>

        <section className="grid gap-5 rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-7 shadow-sm sm:grid-cols-2 sm:p-10">
          {fields.map(([name, label, ph]) => (
            <Field key={name} name={name} label={label} placeholder={ph} value={data[name]} onChange={change} />
          ))}
          <div className="sm:col-span-2">
            <Field type="number" name="available_hours_per_week" label="Realistic weekly hours for growth" value={data.available_hours_per_week} onChange={change} />
            <p className="tp-meta mt-2 text-[color:var(--ink-500)]">Be honest. A focused 6 hours beats an imaginary 20.</p>
          </div>
          <button
            onClick={submit}
            disabled={saving}
            className="mt-4 flex items-center justify-center gap-2 rounded-[var(--r-control)] px-6 py-3.5 font-semibold text-white transition hover:-translate-y-px sm:col-span-2 disabled:opacity-60"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}
          >
            {saving ? 'Saving your week...' : 'Build My Unscripted Profile'} <ArrowRight size={18} />
          </button>
        </section>
      </div>
    </main>
  );
}