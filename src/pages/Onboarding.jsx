import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';

const STEPS = [
  {
    label: 'Your current direction',
    subtitle: 'Start with where you are and what you are considering.',
    fields: [
      { name: 'name', label: 'Full name', placeholder: 'Your name' },
      { name: 'college', label: 'College or university', placeholder: 'Where do you study?' },
      { name: 'major', label: 'Major', placeholder: 'Your primary major' },
      { name: 'graduation_year', label: 'Graduation year', placeholder: '2027' },
      { name: 'school_year', label: 'Current year in school', placeholder: 'Sophomore, Junior...' },
      { name: 'paths_considering', label: 'Paths you are currently considering', placeholder: 'Investment banking, startup, law, medicine, creative, other...', rows: 2 },
      { name: 'pressured_path', label: 'Path you feel most pressure to pursue', placeholder: 'What do family, peers, or environment expect of you?' },
      { name: 'curious_path', label: 'Path you are most privately curious about', placeholder: 'What would you explore if judgment disappeared?' },
    ],
  },
  {
    label: 'Your personal priorities',
    subtitle: 'Be honest. These answers shape which paths we recommend testing.',
    type: 'sliders',
    fields: [
      { name: 'desired_lifestyle', label: 'Describe the life you want at 30', placeholder: 'Work style, income, location, freedom, pace — be specific', rows: 3 },
      { name: 'biggest_blocker', label: 'Your biggest current blocker or uncertainty', placeholder: 'What keeps you stuck?' },
      { name: 'financial_priorities', label: 'Financial priorities', placeholder: 'Income target, financial independence, debt concerns...' },
    ],
    sliders: [
      { name: 'priority_autonomy', label: 'Autonomy — control over your own work and time' },
      { name: 'priority_stability', label: 'Stability — predictable income and security' },
      { name: 'priority_impact', label: 'Impact — making a meaningful difference' },
      { name: 'priority_creativity', label: 'Creativity — building and expressing original ideas' },
      { name: 'priority_ownership', label: 'Ownership — building something of your own' },
    ],
    checkboxes: [
      { name: 'willing_financial_risk', label: 'I am willing to accept financial risk for better upside' },
      { name: 'willing_long_hours', label: 'I am willing to work long hours early in my career' },
      { name: 'willing_to_relocate', label: 'I am willing to relocate for the right opportunity' },
    ],
  },
  {
    label: 'Your available capacity',
    subtitle: 'Be conservative. A focused 6 hours beats an imaginary 20.',
    fields: [
      { name: 'class_schedule', label: 'Class schedule', placeholder: 'Mon/Wed 10–12, Tue/Thu 2–4...' },
      { name: 'fixed_commitments', label: 'Fixed weekly commitments', placeholder: 'Work, clubs, athletics, care responsibilities...' },
      { name: 'high_energy_times', label: 'Times when you do your best work', placeholder: 'e.g. 7–10am, after the gym' },
      { name: 'low_energy_times', label: 'Times to avoid demanding work', placeholder: 'e.g. 2–4pm, late evenings' },
    ],
    hoursField: true,
  },
];

function Field({ field, value, onChange }) {
  const baseClass = 'mt-2 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none transition focus:border-[#8B0C21] focus:bg-white';
  return (
    <label className="block text-sm font-semibold text-[#334155]">
      {field.label}
      {field.rows ? (
        <textarea rows={field.rows} name={field.name} value={value || ''} onChange={onChange} placeholder={field.placeholder} className={baseClass} />
      ) : (
        <input type="text" name={field.name} value={value || ''} onChange={onChange} placeholder={field.placeholder} className={baseClass} />
      )}
    </label>
  );
}

function PrioritiesStep({ step, data, onChange, onCheck }) {
  return (
    <div className="space-y-6">
      {step.fields.map(f => (
        <Field key={f.name} field={f} value={data[f.name]} onChange={onChange} />
      ))}
      <div className="border-t border-[#E2E8F0] pt-6">
        <p className="text-sm font-semibold text-[#334155] mb-4">What matters most to you? (1 = not important, 5 = essential)</p>
        {step.sliders.map(s => (
          <label key={s.name} className="block mb-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#334155]">{s.label}</span>
              <span className="text-sm font-bold" style={{ color: '#8B0C21' }}>{data[s.name] || 3}/5</span>
            </div>
            <input type="range" min="1" max="5" name={s.name} value={data[s.name] || 3} onChange={onChange} className="w-full accent-[#8B0C21]" />
          </label>
        ))}
        <div className="mt-4 space-y-3 border-t border-[#E2E8F0] pt-4">
          {step.checkboxes.map(c => (
            <label key={c.name} className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={!!data[c.name]} onChange={e => onCheck(c.name, e.target.checked)} className="h-4 w-4 rounded accent-[#8B0C21]" />
              <span className="text-sm text-[#334155]">{c.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function CapacityStep({ step, data, onChange, hours, setHours }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {step.fields.map(f => (
          <div key={f.name} className="sm:col-span-1">
            <Field field={f} value={data[f.name]} onChange={onChange} />
          </div>
        ))}
      </div>
      <div className="border-t border-[#E2E8F0] pt-5">
        <label className="block text-sm font-semibold text-[#334155]">
          Realistic available hours per week for path-testing
          <input type="number" min="1" max="40" value={hours}
            onChange={e => setHours(Number(e.target.value))}
            className="mt-2 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]" />
          <p className="mt-1 text-xs text-[#94A3B8]">Be conservative. This determines what we can realistically assign you.</p>
        </label>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({});
  const [hours, setHours] = useState(8);

  const change = e => setData({ ...data, [e.target.name]: e.target.type === 'range' ? Number(e.target.value) : e.target.value });
  const check = (name, val) => setData({ ...data, [name]: val });

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = async () => {
    if (!isLast) return setStep(step + 1);
    setSaving(true);
    try {
      await base44.entities.StudentProfile.create({
        ...data,
        available_hours_per_week: hours,
        career_interests: data.paths_considering,
        pressured_paths: data.pressured_path,
        secret_paths: data.curious_path,
        desired_lifestyle: data.desired_lifestyle,
        biggest_blocker: data.biggest_blocker,
        commitments: data.fixed_commitments,
      });
      await base44.auth.updateMe({
        college: data.college,
        major: data.major,
        graduation_year: data.graduation_year,
        school_year: data.school_year,
      });
    } catch (e) {
      console.error('Onboarding save error, continuing:', e);
    } finally {
      setSaving(false);
    }
    nav('/paths-intake');
  };

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  const renderStep = () => {
    if (currentStep.type === 'sliders') return <PrioritiesStep step={currentStep} data={data} onChange={change} onCheck={check} />;
    if (currentStep.hoursField) return <CapacityStep step={currentStep} data={data} onChange={change} hours={hours} setHours={setHours} />;
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {currentStep.fields.map(f => (
          <div key={f.name} className={f.rows ? 'sm:col-span-2' : ''}>
            <Field field={f} value={data[f.name]} onChange={change} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: '#FAFAF9' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex items-center justify-between">
          <LogoWordmark />
          <span className="text-xs font-bold text-[#64748B]">STEP {step + 1} OF {STEPS.length}</span>
        </div>

        <div className="mb-2 flex justify-between text-xs text-[#64748B]">
          <span>Quick intake — 5 to 8 minutes</span>
          <span>{pct}% complete</span>
        </div>
        <div className="mb-10 h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#8B0C21' }} />
        </div>

        <section className="rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>Path-test intake</p>
          <h1 className="font-heading mb-2 mt-3 text-2xl font-bold tracking-tight text-[#050816]">{currentStep.label}</h1>
          <p className="mb-8 text-sm text-[#64748B]">{currentStep.subtitle}</p>
          {renderStep()}
          <div className="mt-10 flex justify-between">
            <button onClick={() => step ? setStep(step - 1) : nav('/')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#64748B] hover:text-[#050816] transition">
              <ArrowLeft size={16} /> Back
            </button>
            <button onClick={next} disabled={saving}
              className="flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-60"
              style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
              {saving ? 'Saving...' : isLast ? 'See My Path Options' : 'Continue'} <ArrowRight size={16} />
            </button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-[#94A3B8]">
          We gather only what we need to recommend useful paths and experiments. You are always the decision-maker.
        </p>
      </div>
    </main>
  );
}