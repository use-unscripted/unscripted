import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';

// Step configs
const STEPS = [
  {
    label: 'Your education',
    subtitle: 'Start with where you are.',
    fields: [
      { name: 'name', label: 'Full name', placeholder: 'Your name' },
      { name: 'college', label: 'College or university', placeholder: 'Where do you study?' },
      { name: 'major', label: 'Major', placeholder: 'Your primary major' },
      { name: 'minor', label: 'Minor (optional)', placeholder: 'Minor, if any' },
      { name: 'graduation_year', label: 'Graduation year', placeholder: '2026' },
      { name: 'school_year', label: 'Current year', placeholder: 'Sophomore, Junior...' },
    ],
  },
  {
    label: 'Your involvement',
    subtitle: 'What does your current college life look like?',
    fields: [
      { name: 'clubs', label: 'Clubs and organizations', placeholder: 'Student government, finance club...' },
      { name: 'athletics', label: 'Athletics', placeholder: 'Varsity, intramural, club sports...' },
      { name: 'part_time_work', label: 'Part-time work', placeholder: 'Job title and hours per week' },
      { name: 'current_internships', label: 'Current internships', placeholder: 'Role and company, if any' },
      { name: 'current_projects', label: 'Current projects', placeholder: 'Anything you are building or working on' },
    ],
  },
  {
    label: 'The life you want',
    subtitle: 'Be honest. There are no wrong answers.',
    fields: [
      { name: 'life_at_25', label: 'What do you want your life to look like at 25?', placeholder: 'Describe work, income, location, freedom, pace...', rows: 3 },
      { name: 'life_at_30', label: 'What do you want your life to look like at 30?', placeholder: 'Be specific about what success means to you', rows: 3 },
      { name: 'preferred_location', label: 'Preferred location', placeholder: 'New York, remote, flexible, anywhere...' },
      { name: 'desired_income', label: 'Desired income range', placeholder: 'What does financial success look like?' },
    ],
  },
  {
    label: 'Your priorities',
    subtitle: 'Rank what matters to you — honestly.',
    type: 'sliders',
    sliders: [
      { name: 'priority_autonomy', label: 'Autonomy — control over your own work and time' },
      { name: 'priority_stability', label: 'Stability — predictable income and job security' },
      { name: 'priority_prestige', label: 'Prestige — recognition and social status' },
      { name: 'priority_impact', label: 'Impact — making a meaningful difference' },
      { name: 'priority_creativity', label: 'Creativity — expressing ideas and building things' },
      { name: 'priority_ownership', label: 'Ownership — building something of your own' },
    ],
    checkboxes: [
      { name: 'willing_to_relocate', label: 'I am willing to relocate' },
      { name: 'willing_long_hours', label: 'I am willing to work long hours early in my career' },
      { name: 'willing_financial_risk', label: 'I am willing to accept financial risk' },
    ],
  },
  {
    label: 'Interests and energy',
    subtitle: 'What pulls your attention — and what drains it?',
    fields: [
      { name: 'topics_for_hours', label: 'Topics you can discuss for hours', placeholder: 'Finance, technology, storytelling, sports...' },
      { name: 'work_energizes', label: 'Work that energizes you', placeholder: 'Solving problems, creating content, talking to people...' },
      { name: 'work_drains', label: 'Work that drains you', placeholder: 'Repetitive tasks, politics, ambiguity...' },
      { name: 'industries_curious', label: 'Industries you are curious about', placeholder: 'VC, media, healthcare, real estate...' },
      { name: 'problems_care_about', label: 'Problems you care about solving', placeholder: 'Education, climate, financial access...' },
      { name: 'best_environment', label: 'Environments where you perform best', placeholder: 'Fast-paced, structured, creative, remote...' },
    ],
  },
  {
    label: 'Pressure and expectations',
    subtitle: 'Separate what you want from what others expect.',
    fields: [
      { name: 'family_expected_careers', label: 'Careers your family expects of you', placeholder: 'Doctor, lawyer, finance, engineering...' },
      { name: 'peer_paths', label: 'Paths your peers are pursuing', placeholder: 'What are most people around you doing?' },
      { name: 'secretly_curious', label: 'Paths you are privately curious about', placeholder: 'What would you explore if judgment disappeared?' },
      { name: 'fear_disappointing', label: 'What are you afraid of disappointing people about?', placeholder: 'Be honest — this helps us separate pressure from preference' },
    ],
  },
  {
    label: 'People you admire',
    subtitle: 'Role models reveal what you actually want.',
    fields: [
      { name: 'creators_admired', label: 'Creators, founders, or professionals you admire', placeholder: 'Names and why you admire them', rows: 3 },
      { name: 'lifestyle_admired', label: 'People whose lifestyle you admire', placeholder: 'What specifically appeals to you about how they live?', rows: 2 },
    ],
  },
  {
    label: 'Where you stand today',
    subtitle: 'An honest current-state assessment.',
    fields: [
      { name: 'current_skills', label: 'Skills you already have', placeholder: 'Writing, Excel, coding, public speaking...' },
      { name: 'desired_skills', label: 'Skills you want to build', placeholder: 'What would create leverage for you?' },
      { name: 'current_network', label: 'Current network strength', placeholder: 'Weak, moderate, strong — and in what areas?' },
      { name: 'current_online_presence', label: 'Current online presence', placeholder: 'LinkedIn, portfolio, social media...' },
      { name: 'biggest_blocker', label: 'Your biggest current blocker', placeholder: 'What keeps you stuck or uncertain?' },
      { name: 'thirty_day_success', label: 'What would a successful next 30 days look like?', placeholder: 'Be specific about outcomes, not effort' },
    ],
  },
];

function Field({ field, value, onChange }) {
  const baseClass = 'mt-2 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none transition focus:border-[#8B0C21] focus:bg-white';
  const focusRing = { boxShadow: 'none' };
  return (
    <label className="block text-sm font-semibold text-[#334155]">
      {field.label}
      {field.rows ? (
        <textarea rows={field.rows} name={field.name} value={value || ''} onChange={onChange} placeholder={field.placeholder} className={baseClass} style={focusRing} />
      ) : (
        <input type="text" name={field.name} value={value || ''} onChange={onChange} placeholder={field.placeholder} className={baseClass} style={focusRing} />
      )}
    </label>
  );
}

function PrioritySliders({ step, data, onChange, onCheck }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-[#64748B]">Rate each from 1 (not important) to 5 (essential to you)</p>
      {step.sliders.map(s => (
        <label key={s.name} className="block">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#334155]">{s.label}</span>
            <span className="text-sm font-bold" style={{ color: '#8B0C21' }}>{data[s.name] || 3}/5</span>
          </div>
          <input type="range" min="1" max="5" name={s.name} value={data[s.name] || 3} onChange={onChange}
            className="w-full accent-[#8B0C21]" />
        </label>
      ))}
      <div className="mt-6 space-y-3 border-t border-[#E2E8F0] pt-6">
        <p className="text-sm font-semibold text-[#334155]">Practical constraints</p>
        {step.checkboxes.map(c => (
          <label key={c.name} className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={!!data[c.name]} onChange={e => onCheck(c.name, e.target.checked)}
              className="h-4 w-4 rounded accent-[#8B0C21]" />
            <span className="text-sm text-[#334155]">{c.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({});

  const change = e => setData({ ...data, [e.target.name]: e.target.type === 'range' ? Number(e.target.value) : e.target.value });
  const check = (name, val) => setData({ ...data, [name]: val });

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = async () => {
    if (!isLast) return setStep(step + 1);
    setSaving(true);
    await base44.entities.StudentProfile.create(data);
    await base44.auth.updateMe({
      college: data.college,
      major: data.major,
      graduation_year: data.graduation_year,
      school_year: data.school_year,
    });
    nav('/goals');
  };

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: '#FAFAF9' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex items-center justify-between">
          <LogoWordmark />
          <span className="text-xs font-bold text-[#64748B]">STEP {step + 1} OF {STEPS.length}</span>
        </div>

        <div className="mb-2 flex justify-between text-xs text-[#64748B]">
          <span>Personal Intake</span>
          <span>{pct}% complete</span>
        </div>
        <div className="mb-10 h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#8B0C21' }} />
        </div>

        <section className="rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>Build your Unscripted profile</p>
          <h1 className="font-heading mb-2 mt-3 text-2xl font-bold tracking-tight text-[#050816]">{currentStep.label}</h1>
          <p className="mb-8 text-sm text-[#64748B]">{currentStep.subtitle}</p>

          {currentStep.type === 'sliders' ? (
            <PrioritySliders step={currentStep} data={data} onChange={change} onCheck={check} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {currentStep.fields.map(f => (
                <div key={f.name} className={f.rows ? 'sm:col-span-2' : ''}>
                  <Field field={f} value={data[f.name]} onChange={change} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-10 flex justify-between">
            <button
              onClick={() => step ? setStep(step - 1) : nav('/')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#64748B] hover:text-[#050816] transition"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={next}
              disabled={saving}
              className="flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-60"
              style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}
            >
              {saving ? 'Saving...' : isLast ? 'Continue to Goals' : 'Continue'} <ArrowRight size={16} />
            </button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-[#94A3B8]">
          Unscripted is not determining your destiny. We are gathering enough to recommend useful paths and experiments.
        </p>
      </div>
    </main>
  );
}