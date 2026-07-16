import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import OnboardingStep from '@/components/onboarding/OnboardingStep';
import InterestPicker from '@/components/onboarding/InterestPicker';

const titles = [
  'Start with your reality.',
  'Define the life — not just the job.',
  'Separate expectation from ambition.',
  'Choose the arenas you want to explore.',
  'Take inventory and set a target.',
];

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({ interests: [] });

  const change = e => setData({ ...data, [e.target.name]: e.target.value });
  const toggle = x => setData({ ...data, interests: data.interests.includes(x) ? data.interests.filter(i => i !== x) : [...data.interests, x] });

  const next = async () => {
    if (step < 4) return setStep(step + 1);
    setSaving(true);
    await base44.entities.StudentProfile.create(data);
    await base44.auth.updateMe({ college: data.college, major: data.major, graduation_year: data.graduation_year, school_year: data.school_year });
    nav('/schedule');
  };

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: '#F8FAFC' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex items-center justify-between">
          <span className="font-heading font-bold text-[#07111F]">AmbitionOS</span>
          <span className="text-xs font-bold text-[#64748B]">STEP {step + 1} OF 5</span>
        </div>

        {/* Progress bar */}
        <div className="mb-10 h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(step + 1) * 20}%`, background: 'linear-gradient(90deg, #2563EB, #7C3AED)' }}
          />
        </div>

        <section className="rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2563EB]">Your ambition profile</p>
          <h1 className="font-heading mb-8 mt-3 text-3xl font-bold tracking-tight text-[#07111F]">{titles[step]}</h1>

          {step === 3
            ? <InterestPicker selected={data.interests} onToggle={toggle} />
            : <OnboardingStep step={step > 3 ? 3 : step} data={data} onChange={change} />
          }

          <div className="mt-10 flex justify-between">
            <button
              onClick={() => step ? setStep(step - 1) : nav('/')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#64748B] hover:text-[#07111F] transition"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={next}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', boxShadow: '0 12px 30px rgba(37,99,235,0.25)' }}
            >
              {saving ? 'Saving...' : step === 4 ? 'Build my schedule' : 'Continue'} <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}