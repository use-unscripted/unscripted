import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import OnboardingStep from '@/components/onboarding/OnboardingStep';
import InterestPicker from '@/components/onboarding/InterestPicker';
import { LogoWordmark } from '@/components/UnscriptedLogo';

const titles = [
  'Start with your reality.',
  'Define the life — not just the job.',
  'Separate expectation from ambition.',
  'Which paths are you interested in exploring?',
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
    await base44.auth.updateMe({
      college: data.college,
      major: data.major,
      graduation_year: data.graduation_year,
      school_year: data.school_year,
    });
    nav('/schedule');
  };

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: '#FAFAF9' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex items-center justify-between">
          <LogoWordmark />
          <span className="text-xs font-bold text-[#64748B]">STEP {step + 1} OF 5</span>
        </div>

        {/* Progress bar */}
        <div className="mb-10 h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(step + 1) * 20}%`, background: '#8B0C21' }}
          />
        </div>

        <section className="rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>Build your Unscripted profile</p>
          <h1 className="font-heading mb-8 mt-3 text-3xl font-bold tracking-tight text-[#050816]">{titles[step]}</h1>

          {step === 3
            ? <InterestPicker selected={data.interests} onToggle={toggle} />
            : <OnboardingStep step={step > 3 ? 3 : step} data={data} onChange={change} />
          }

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
              {saving ? 'Saving...' : step === 4 ? 'Build my schedule' : 'Continue'} <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}