import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';
import { saveDraft, loadDraft } from '@/lib/guest-draft';
import EducationStageStep from '@/components/onboarding/EducationStageStep';

// Field labels that differ between high school and college students
const STAGE_FIELDS = {
  high_school: {
    college: { label: 'High school', placeholder: 'Where do you go to school?' },
    major: { label: 'Subjects you are most drawn to', placeholder: 'e.g. biology, economics, art, computer science' },
    graduation_year: { label: 'High school graduation year', placeholder: '2028' },
    school_year: { label: 'Current grade', placeholder: 'Freshman, Sophomore, Junior, Senior' },
    class_schedule: { label: 'School schedule', placeholder: 'e.g. school 8–3, practice 4–6' },
  },
  college: {},
};

const STEPS = [
  {
    label: 'Where are you right now?',
    subtitle: 'This shapes the paths we recommend and the experiments we build for you.',
    type: 'stage',
  },
  {
    label: 'Your current direction',
    subtitle: 'Start with where you are and what you are considering.',
    fields: [
      { name: 'name', label: 'Full name', placeholder: 'Your name', required: true },
      { name: 'college', label: 'College or university', placeholder: 'Where do you study?', required: true },
      { name: 'major', label: 'Major', placeholder: 'Your primary major', required: true },
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
      { name: 'desired_lifestyle', label: 'Where do you see yourself in five to ten years?', placeholder: 'Think about the type of work, lifestyle, impact, financial position, relationships, location, or autonomy you may want. Your answer can change over time.', rows: 4, type: 'vision' },
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
  {
    label: 'Anything else you want Unscripted to know?',
    subtitle: 'Add personal context, ambitions, responsibilities, concerns, or goals that were not covered above. This is optional.',
    type: 'personal_notes',
  },
];

function Field({ field, value, onChange, error }) {
  const baseClass = `mt-2 w-full rounded-xl border bg-[#F8FAFC] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none transition focus:border-[#1F3A5F] focus:bg-white ${error ? 'border-red-400' : 'border-[#E2E8F0]'}`;
  return (
    <label className="block text-sm font-semibold text-[#334155]">
      {field.label}{field.required && <span className="ml-1 text-red-500">*</span>}
      {field.rows ? (
        <textarea rows={field.rows} name={field.name} value={value || ''} onChange={onChange} placeholder={field.placeholder} className={baseClass} />
      ) : (
        <input type="text" name={field.name} value={value || ''} onChange={onChange} placeholder={field.placeholder} className={baseClass} />
      )}
      {error && <span className="mt-1 block text-xs font-normal text-red-500">This field is required.</span>}
    </label>
  );
}

const VISION_THEMES = [
  'Financial independence', 'Creative work', 'Autonomy & flexibility',
  'Leadership & impact', 'Building something', 'Helping others',
  'Travel & location freedom', 'Stability & security', 'Status & recognition',
  'Community & relationships', 'Learning & growth', 'Work-life balance',
];

const TIMEFRAME_OPTIONS = [
  { value: 'five_years', label: 'In five years' },
  { value: 'ten_years', label: 'In ten years' },
  { value: 'unsure', label: 'I am not sure yet' },
];

function VisionField({ data, onChange, onCheck }) {
  const baseClass = 'mt-2 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none transition focus:border-[#1F3A5F] focus:bg-white';
  const selectedThemes = Array.isArray(data.vision_themes) ? data.vision_themes : [];

  const toggleTheme = (theme) => {
    const next = selectedThemes.includes(theme)
      ? selectedThemes.filter(t => t !== theme)
      : [...selectedThemes, theme];
    onCheck('vision_themes', next);
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-[#334155]">
        Where do you see yourself in five to ten years?
        <span className="ml-2 text-xs font-normal text-[#94A3B8]">Optional</span>
        <p className="mt-1 mb-2 text-xs font-normal text-[#64748B]">Think about the type of work, lifestyle, impact, financial position, relationships, location, or autonomy you may want. Your answer can change over time.</p>
        <textarea
          rows={4}
          name="desired_lifestyle"
          value={data.desired_lifestyle || ''}
          onChange={onChange}
          placeholder="Describe what you're working toward — or what you're uncertain about..."
          className={baseClass}
        />
      </label>

      <div>
        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Themes that resonate <span className="font-normal normal-case">(optional — select any)</span></p>
        <div className="flex flex-wrap gap-2">
          {VISION_THEMES.map(theme => (
            <button
              key={theme}
              type="button"
              onClick={() => toggleTheme(theme)}
              className="rounded-full border px-3 py-1 text-xs font-semibold transition"
              style={selectedThemes.includes(theme)
                ? { background: 'var(--brand-navy-900)', color: '#fff', borderColor: 'var(--brand-navy-900)' }
                : { background: 'white', color: '#334155', borderColor: '#E2E8F0' }}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Preferred timeframe <span className="font-normal normal-case">(optional)</span></p>
        <div className="flex flex-wrap gap-2">
          {TIMEFRAME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onCheck('vision_timeframe', data.vision_timeframe === opt.value ? null : opt.value)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
              style={data.vision_timeframe === opt.value
                ? { background: '#050816', color: '#fff', borderColor: '#050816' }
                : { background: 'white', color: '#334155', borderColor: '#E2E8F0' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PrioritiesStep({ step, data, onChange, onCheck }) {
  return (
    <div className="space-y-6">
      <VisionField data={data} onChange={onChange} onCheck={onCheck} />
      {step.fields.filter(f => f.type !== 'vision').map(f => (
        <Field key={f.name} field={f} value={data[f.name]} onChange={onChange} />
      ))}
      <div className="border-t border-[#E2E8F0] pt-6">
        <p className="text-sm font-semibold text-[#334155] mb-4">What matters most to you? (1 = not important, 5 = essential)</p>
        {step.sliders.map(s => (
          <label key={s.name} className="block mb-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#334155]">{s.label}</span>
              <span className="text-sm font-bold" style={{ color: 'var(--brand-navy-900)' }}>{data[s.name] || 3}/5</span>
            </div>
            <input type="range" min="1" max="5" name={s.name} value={data[s.name] || 3} onChange={onChange} className="w-full accent-[#1F3A5F]" />
          </label>
        ))}
        <div className="mt-4 space-y-3 border-t border-[#E2E8F0] pt-4">
          {step.checkboxes.map(c => (
            <label key={c.name} className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={!!data[c.name]} onChange={e => onCheck(c.name, e.target.checked)} className="h-4 w-4 rounded accent-[#1F3A5F]" />
              <span className="text-sm text-[#334155]">{c.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function PersonalNotesStep({ data, onChange }) {
  const baseClass = 'mt-2 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none transition focus:border-[#1F3A5F] focus:bg-white';
  return (
    <div className="space-y-5">
      <label className="block text-sm font-semibold text-[#334155]">
        Personal notes and context
        <span className="ml-2 text-xs font-normal text-[#94A3B8]">Optional</span>
        <textarea
          rows={4} name="personal_notes" value={data.personal_notes || ''} onChange={onChange}
          maxLength={3000}
          placeholder="Anything about your situation, background, or current life that would help personalize your recommendations..."
          className={baseClass}
        />
        {(data.personal_notes || '').length > 0 && (
          <p className="mt-1 text-right text-xs text-[#94A3B8]">{(data.personal_notes || '').length}/3000</p>
        )}
      </label>

      <label className="block text-sm font-semibold text-[#334155]">
        Long-term ambitions
        <span className="ml-2 text-xs font-normal text-[#94A3B8]">Optional</span>
        <textarea
          rows={3} name="long_term_ambitions" value={data.long_term_ambitions || ''} onChange={onChange}
          placeholder="What do you ultimately want to build, achieve, or become in the next 5–10 years?"
          className={baseClass}
        />
      </label>

      <label className="block text-sm font-semibold text-[#334155]">
        Responsibilities or constraints
        <span className="ml-2 text-xs font-normal text-[#94A3B8]">Optional</span>
        <textarea
          rows={3} name="responsibilities_constraints" value={data.responsibilities_constraints || ''} onChange={onChange}
          placeholder="e.g. family responsibilities, commuting, athletics, financial limits, health routines, academic requirements..."
          className={baseClass}
        />
      </label>

      <label className="block text-sm font-semibold text-[#334155]">
        Things I do not want
        <span className="ml-2 text-xs font-normal text-[#94A3B8]">Optional</span>
        <textarea
          rows={3} name="things_to_avoid" value={data.things_to_avoid || ''} onChange={onChange}
          placeholder="Careers, lifestyles, or commitments you want to avoid — be specific about what you're ruling out and why..."
          className={baseClass}
        />
      </label>

      <label className="block text-sm font-semibold text-[#334155]">
        Anything the recommendations should prioritize
        <span className="ml-2 text-xs font-normal text-[#94A3B8]">Optional</span>
        <textarea
          rows={3} name="priorities_for_recommendations" value={data.priorities_for_recommendations || ''} onChange={onChange}
          placeholder="Specific factors, values, or goals that should weigh heavily in how we evaluate paths for you..."
          className={baseClass}
        />
      </label>

      <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs text-[#64748B]">
        🔒 Your notes are private to your account and are used only to personalize your Unscripted experience.
      </p>
    </div>
  );
}

function CapacityStep({ step, data, onChange, hours, setHours, localize = f => f }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {step.fields.map(localize).map(f => (
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
            className="mt-2 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm outline-none focus:border-[#1F3A5F]" />
          <p className="mt-1 text-xs text-[#94A3B8]">Be conservative. This determines what we can realistically assign you.</p>
        </label>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({});
  const [hours, setHours] = useState(8);
  const [errors, setErrors] = useState([]);

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      const { draft_version, guest_session_id, started_at, updated_at, completed, current_step, available_hours_per_week, primary_path, comparison_path, ...fields } = draft;
      setData(fields);
      if (available_hours_per_week) setHours(available_hours_per_week);
      if (current_step != null && current_step < STEPS.length) setStep(current_step);
    }
  }, []);

  const persist = (newData, newStep, newHours) => {
    saveDraft({ ...newData, available_hours_per_week: newHours ?? hours, current_step: newStep ?? step });
  };

  const change = e => {
    const val = e.target.type === 'range' ? Number(e.target.value) : e.target.value;
    const next = { ...data, [e.target.name]: val };
    setData(next);
    persist(next, step, hours);
  };

  const check = (name, val) => {
    const next = { ...data, [name]: val === null ? undefined : val };
    setData(next);
    persist(next, step, hours);
  };

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const goBack = () => {
    if (step > 0) {
      persist(data, step - 1, hours);
      setStep(step - 1);
    } else {
      nav('/');
    }
  };

  const next = () => {
    const missing = (currentStep.fields || [])
      .filter(f => f.required && !String(data[f.name] || '').trim())
      .map(f => f.name);
    if (missing.length) { setErrors(missing); return; }
    setErrors([]);
    persist(data, step + 1, hours);
    if (!isLast) {
      setStep(step + 1);
    } else {
      nav('/paths-intake');
    }
  };

  const pct = Math.round(((step + 1) / (STEPS.length + 1)) * 100); // +1 for paths step

  // Apply stage-specific labels/placeholders to a field
  const localize = (f) => ({ ...f, ...((STAGE_FIELDS[data.education_stage] || {})[f.name] || {}) });

  const renderStep = () => {
    if (currentStep.type === 'stage') {
      return (
        <EducationStageStep
          value={data.education_stage}
          onSelect={stage => {
            const next = { ...data, education_stage: stage };
            setData(next);
            persist(next, step + 1, hours);
            setStep(step + 1);
          }}
        />
      );
    }
    if (currentStep.type === 'sliders') return <PrioritiesStep step={currentStep} data={data} onChange={change} onCheck={check} />;
    if (currentStep.type === 'personal_notes') return <PersonalNotesStep data={data} onChange={change} />;
    if (currentStep.hoursField) return <CapacityStep step={currentStep} data={data} onChange={change} hours={hours} setHours={h => { setHours(h); persist(data, step, h); }} localize={localize} />;
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {currentStep.fields.map(localize).map(f => (
          <div key={f.name} className={f.rows ? 'sm:col-span-2' : ''}>
            <Field field={f} value={data[f.name]} onChange={change} error={errors.includes(f.name)} />
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
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-[#64748B]">STEP {step + 1} OF {STEPS.length + 1}</span>
            <Link to="/login" className="text-xs font-semibold text-[#64748B] hover:text-[#050816] transition">Log in</Link>
          </div>
        </div>

        <div className="mb-2 flex justify-between text-xs text-[#64748B]">
          <span>Quick intake — 5 to 8 minutes</span>
          <span>{pct}% complete</span>
        </div>
        <div className="mb-10 h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--brand-navy-900)' }} />
        </div>

        <section className="rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm sm:p-10">
          <h1 className="font-heading mb-2 mt-3 text-2xl font-bold tracking-tight text-[#050816]">{currentStep.label}</h1>
          <p className="mb-8 text-sm text-[#64748B]">{currentStep.subtitle}</p>
          {renderStep()}
          <div className="mt-10 flex justify-between">
            <button onClick={goBack}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#64748B] hover:text-[#050816] transition">
              <ArrowLeft size={16} /> Back
            </button>
            <button onClick={next} disabled={currentStep.type === 'stage' && !data.education_stage}
              className="flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-50"
              style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
              {isLast ? 'Choose My Paths' : 'Continue'} <ArrowRight size={16} />
            </button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-[#94A3B8]">
          No account required yet. We gather only what we need to recommend useful paths.{' '}
          <Link to="/login" className="underline hover:text-[#334155]">Already have an account?</Link>
        </p>
      </div>
    </main>
  );
}