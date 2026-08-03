/**
 * The guest intake — one question per screen.
 *
 * Built on the same guided pieces as the outreach survey
 * (src/components/guided/GuidedPieces.jsx), so the signed-out intake and the
 * signed-in flows behave identically: tap an answer and it advances, number
 * keys pick, Enter continues, and every optional question has a visible Skip.
 *
 * Two rules govern what is asked here, and both matter more than the layout:
 *
 *   1. Only four answers are required — the path to test, plus name, college
 *      and major. Everything else says "optional" on the question itself and
 *      has a Skip button, so no student has to guess what they can leave out.
 *
 *   2. A question earns its place only if something downstream reads it. Every
 *      key written here is consumed by the path generator prompt
 *      (src/lib/path-generator.js), the risk assessor, the campus-event
 *      matcher, or the Mission Guide templates. The five personal-context
 *      boxes moved out of the intake: they are offered on the review screen
 *      and live permanently in Settings, so they are enrichment a student adds
 *      once they have a reason to, not a wall before their first result.
 *
 * Path selection used to be a separate page (/paths-intake). It is steps 1–4
 * here now; that route redirects into this flow.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';
import { ProgressBar, OptionRow, GuidedStyles, footerCls } from '@/components/guided/GuidedPieces';
import { saveDraft, loadDraft } from '@/lib/guest-draft';
import { trackFunnel, trackFunnelOnce } from '@/lib/funnel';

const PATH_OPTIONS = [
  'Investment banking / finance',
  'Management consulting',
  'Tech / software engineering',
  'Venture capital / private equity',
  'Startup operations or founding',
  'Medicine / healthcare',
  'Law',
  'Graduate school / academia',
  'Marketing / brand',
  'Personal brand / content',
  'Freelancing / consulting',
  'Real estate / investing',
  'Nonprofit / mission-driven work',
  'Creative industries (film, design, music)',
  'Government / policy',
];

const SCHOOL_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad student'];

// Derived, not hardcoded: a fixed list goes stale a year after it ships.
const GRAD_YEARS = (() => {
  const now = new Date().getFullYear();
  return [now, now + 1, now + 2, now + 3, now + 4].map(String);
})();

const SLIDERS = [
  { name: 'priority_autonomy', label: 'Autonomy', desc: 'Control over your own work and time' },
  { name: 'priority_stability', label: 'Stability', desc: 'Predictable income and security' },
  { name: 'priority_impact', label: 'Impact', desc: 'Making a meaningful difference' },
  { name: 'priority_creativity', label: 'Creativity', desc: 'Building and expressing original ideas' },
  { name: 'priority_ownership', label: 'Ownership', desc: 'Building something of your own' },
];

const TOGGLES = [
  { name: 'willing_financial_risk', label: 'I will take financial risk for better upside' },
  { name: 'willing_long_hours', label: 'I will work long hours early in my career' },
];

const VISION_THEMES = [
  'Financial independence', 'Creative work', 'Autonomy & flexibility',
  'Leadership & impact', 'Building something', 'Helping others',
  'Travel & location freedom', 'Stability & security', 'Status & recognition',
  'Community & relationships', 'Learning & growth', 'Work-life balance',
];

const asOptions = (values) => values.map(v => ({ value: v, label: v }));

/* One question per screen. `kind` drives the control:
   paths     — the path list as chips, pick one, plus a box for your own
   choice    — tap exactly one (auto-advances)
   text      — chips that fill in a text answer, plus your own words
   sliders   — the five priority scores, together, because they are comparative
   toggles   — tap any that are true
   vision    — theme chips plus an optional description
   about     — the identity fields, grouped: they need no thought, so grouping
               them is faster than five screens of typing

   Anything without `required` is skippable and says so.                     */
const STEPS = [
  {
    key: 'primary_path',
    kind: 'paths',
    required: true,
    question: 'Which path do you want to test first?',
    hint: 'You are not committing to it — you are choosing what to put to the test.',
  },
  {
    key: 'comparison_path',
    kind: 'paths',
    question: 'Want to weigh it against something?',
    hint: 'We will include this as one of your three recommended paths, so you can compare them directly.',
    excludeFrom: ['primary_path'],
  },
  {
    key: 'pressured_path',
    kind: 'paths',
    question: 'Which path do you feel the most pressure to pursue?',
    hint: 'From family, peers, or the people around you. Naming it lets us tell it apart from what you actually want.',
  },
  {
    key: 'curious_path',
    kind: 'paths',
    question: 'Which path are you privately curious about?',
    hint: 'The one you would explore if nobody was watching. This is what your contrarian recommendation is built from.',
  },
  {
    key: 'available_hours_per_week',
    kind: 'choice',
    question: 'How many hours a week can you really give this?',
    hint: 'Be conservative. A focused 6 hours beats an imaginary 20.',
    options: [
      { value: 4, label: '2–4 hours', desc: 'A couple of evenings' },
      { value: 8, label: '5–8 hours', desc: 'Where most students land' },
      { value: 12, label: '9–12 hours', desc: 'A serious block of your week' },
      { value: 16, label: '13+ hours', desc: 'You have real room' },
    ],
  },
  {
    key: 'fixed_commitments',
    kind: 'text',
    question: 'What is already locked into your week?',
    hint: 'So your plan works around it instead of over it.',
    options: asOptions([
      'A job or internship', 'Athletics', 'Clubs or orgs',
      'Family responsibilities', 'A long commute', 'A heavy course load',
    ]),
    customLabel: 'Anything else',
    placeholder: 'e.g. 6am practice Mon/Wed/Fri',
  },
  {
    key: 'biggest_blocker',
    kind: 'text',
    question: 'What is actually keeping you stuck?',
    hint: 'The honest answer is more useful than the impressive one.',
    options: asOptions([
      'I have no idea what I would be good at',
      'I know what I want but not how to start',
      'Everyone around me expects one thing',
      'I am scared of picking wrong',
      'I do not know anyone in the field',
    ]),
    customLabel: 'Or say it in your own words',
    placeholder: 'What keeps you stuck?',
  },
  {
    key: 'priorities',
    kind: 'sliders',
    question: 'What matters most to you?',
    hint: '1 is not important, 5 is essential. These shape which paths we recommend.',
  },
  {
    key: 'willingness',
    kind: 'toggles',
    question: 'Which of these are true for you?',
    hint: 'Tap any that fit. Skip if neither does.',
  },
  {
    key: 'vision',
    kind: 'vision',
    question: 'Where do you want to end up?',
    hint: 'Five to ten years out. Tap what resonates — your answer can change.',
  },
  {
    key: 'about',
    kind: 'about',
    required: true,
    question: 'Last thing — who are you?',
    hint: 'Your guides and outreach emails get written in your name, so we need this part.',
  },
];

const REVIEW = STEPS.length;

const inputCls =
  'w-full rounded-[10px] border px-3 py-2.5 text-sm outline-none transition focus:border-[color:var(--brand-navy-900)]';
const inputStyle = { borderColor: 'var(--ink-200)', background: 'var(--background-secondary)' };

// A pill for the chip grids: paths, vision themes, school year, graduation year.
function Chip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="opt-row rounded-full border px-3.5 py-2 text-xs font-semibold"
      style={{
        animationDelay: '0ms',
        borderColor: selected ? 'var(--brand-navy-900)' : 'var(--ink-200)',
        background: selected ? 'var(--brand-navy-900)' : 'var(--brand-white)',
        color: selected ? '#fff' : 'var(--ink-700)',
      }}
    >
      {label}
    </button>
  );
}

/** What a completed step reads as on the review screen. */
function summarise(step, data) {
  switch (step.kind) {
    case 'sliders':
      return SLIDERS.map(s => `${s.label} ${data[s.name] ?? 3}`).join(' · ');
    case 'toggles': {
      const on = TOGGLES.filter(t => data[t.name]).map(t => t.label);
      return on.length ? on.join(' · ') : '';
    }
    case 'vision': {
      const themes = Array.isArray(data.vision_themes) ? data.vision_themes : [];
      return [themes.join(', '), (data.desired_lifestyle || '').trim()].filter(Boolean).join(' — ');
    }
    case 'about':
      return [data.name, data.college, data.major, data.school_year, data.graduation_year]
        .filter(Boolean).join(' · ');
    case 'choice':
      return step.options.find(o => o.value === data[step.key])?.label || '';
    default:
      return (data[step.key] || '').toString().trim();
  }
}

export default function Onboarding() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState('fwd');
  // Hours starts on the middle bucket rather than empty. The generator plans
  // against 8 hours when nothing is set, so leaving it blank would silently
  // pick for the student; pre-selecting it puts that choice on screen where
  // they can see and change it.
  const [data, setData] = useState({ available_hours_per_week: 8 });
  const [error, setError] = useState('');
  const advanceRef = useRef(null);
  const topRef = useRef(null);
  const headingRef = useRef(null);

  const step = STEPS[index];
  const reviewing = index === REVIEW;

  // Restore a draft, then let ?step= override where it drops you — that is how
  // "edit my path selection" gets back to question one.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      const { draft_version, guest_session_id, started_at, updated_at, completed, current_step, intake_version, ...fields } = draft;
      setData({ available_hours_per_week: 8, ...fields });
      // Only trust a saved position from this version of the flow: an older
      // draft's step number points at a question that no longer exists.
      if (intake_version === 2 && current_step != null) setIndex(Math.min(current_step, REVIEW));
    }
    const wanted = Number(params.get('step'));
    if (Number.isInteger(wanted) && wanted >= 0 && wanted <= REVIEW) setIndex(wanted);

    trackFunnelOnce('intake_started', 'intake_started', {
      resumed: !!draft,
      resumed_at_step: draft?.current_step ?? 0,
    });
  }, []);

  useEffect(() => () => clearTimeout(advanceRef.current), []);

  // Every question starts at the top of the page, however far you had scrolled,
  // and takes focus — otherwise focus stays on whatever sat at that spot on the
  // previous screen, which both reads wrong and leaves a ring on an unrelated
  // answer after an auto-advance.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  const persist = (nextData, nextStep) =>
    saveDraft({ ...nextData, intake_version: 2, current_step: nextStep ?? index });

  const set = (key, value) => {
    setData(prev => {
      const next = { ...prev, [key]: value };
      persist(next, index);
      return next;
    });
    setError('');
  };

  const go = useCallback((next, direction) => {
    clearTimeout(advanceRef.current);
    setDir(direction);
    setIndex(next);
  }, []);

  // Tapping the one answer a question wants should move you on by itself.
  const chooseOne = (key, value) => {
    set(key, value);
    clearTimeout(advanceRef.current);
    advanceRef.current = setTimeout(() => { setDir('fwd'); setIndex(i => Math.min(i + 1, REVIEW)); }, 230);
  };

  const toggleInList = (key, value) => {
    const list = Array.isArray(data[key]) ? data[key] : [];
    set(key, list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  };

  // A tapped suggestion on a free-text question joins the comma list, so it
  // acts like a preset without ever locking out typing.
  const toggleTextSuggestion = (key, value) => {
    const parts = (data[key] || '').split(',').map(p => p.trim()).filter(Boolean);
    const has = parts.some(p => p.toLowerCase() === value.toLowerCase());
    set(key, (has ? parts.filter(p => p.toLowerCase() !== value.toLowerCase()) : [...parts, value]).join(', '));
  };

  const textHasSuggestion = (key, value) =>
    (data[key] || '').split(',').map(p => p.trim().toLowerCase()).includes(value.toLowerCase());

  const missingOnAbout = () =>
    ['name', 'college', 'major'].filter(f => !String(data[f] || '').trim());

  const blockedReason = () => {
    if (!step?.required) return '';
    if (step.kind === 'about') {
      return missingOnAbout().length ? 'Add your name, college and major — these three we do need.' : '';
    }
    return String(data[step.key] || '').trim() ? '' : 'Pick a path to test, or describe your own below.';
  };

  const next = () => {
    const reason = blockedReason();
    if (reason) {
      setError(reason);
      trackFunnel('intake_step_blocked', { step_index: index + 1, step_label: step.key, missing_count: 1 });
      return;
    }
    setError('');
    persist(data, index + 1);
    trackFunnel('intake_step_completed', { step_index: index + 1, step_label: step.key });
    // The path choice is still the funnel's hinge, so it keeps reporting under
    // the names the existing dashboards already read.
    if (step.key === 'primary_path') {
      trackFunnel('paths_selected', {
        primary_path: PATH_OPTIONS.includes(data.primary_path) ? data.primary_path : 'other',
        has_comparison: !!data.comparison_path,
      });
    }
    go(Math.min(index + 1, REVIEW), 'fwd');
  };

  const back = () => {
    if (index === 0) { nav('/'); return; }
    persist(data, index - 1);
    go(index - 1, 'back');
  };

  const finish = () => {
    persist(data, REVIEW);
    trackFunnelOnce('paths_intake_reached', 'paths_intake_reached');
    nav('/onboarding-review');
  };

  // Number keys pick an option on the single-choice questions; Enter continues.
  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(e.target?.tagName);
      if (e.key === 'Enter' && !e.shiftKey) {
        if (typing && e.target.tagName === 'TEXTAREA') return;
        if (reviewing) return;
        e.preventDefault();
        next();
        return;
      }
      if (typing || reviewing || step?.kind !== 'choice') return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > step.options.length) return;
      chooseOne(step.key, step.options[n - 1].value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const emptyNow = step && !reviewing && !summarise(step, data);
  const ctaLabel = !step?.required && emptyNow ? 'Skip' : 'Continue';

  const shell = (children, footer) => (
    <main className="min-h-screen px-5 py-10" style={{ background: 'var(--page-surface)' }}>
      <div ref={topRef} className="mx-auto max-w-2xl">
        <GuidedStyles />
        <div className="mb-8 flex items-center justify-between">
          <LogoWordmark />
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-[color:var(--ink-500)]">
              {reviewing ? 'REVIEW' : `${index + 1} OF ${STEPS.length}`}
            </span>
            <Link to="/login" className="text-xs font-semibold text-[color:var(--ink-500)] hover:text-[color:var(--surface-dark-900)] transition">
              Log in
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <ProgressBar value={(index + 1) / (REVIEW + 1)} />
        </div>

        <section className="rounded-[24px] border border-[color:var(--ink-200)] bg-white p-6 pb-0 shadow-sm sm:p-8 sm:pb-0">
          {children}
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</p>
          )}
          {footer}
        </section>

        <p className="mt-6 text-center text-xs text-[color:var(--ink-400)]">
          No account needed yet. Four answers are required — the rest you can skip.{' '}
          <Link to="/login" className="underline hover:text-[color:var(--ink-700)]">Already have an account?</Link>
        </p>
      </div>
    </main>
  );

  if (reviewing) {
    return shell(
      <div key="review" className="step-pane-fwd">
        <h1 ref={headingRef} tabIndex={-1} className="font-heading text-[26px] font-bold leading-tight outline-none" style={{ color: 'var(--surface-dark-900)' }}>
          That is everything.
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Tap any answer to change it.
        </p>
        <div className="mt-5 space-y-1.5">
          {STEPS.map((s, i) => {
            const value = summarise(s, data);
            return (
              <button key={s.key} type="button" onClick={() => go(i, 'back')}
                className="opt-row flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left"
                style={{ animationDelay: `${i * 30}ms`, borderColor: 'var(--ink-200)', background: 'var(--brand-white)' }}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    {s.question}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold" style={{ color: value ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {value || 'Skipped'}
                  </span>
                </span>
                <Pencil size={13} className="mt-1 shrink-0" style={{ color: 'var(--ink-300)' }} />
              </button>
            );
          })}
        </div>
      </div>,
      <div className={footerCls}>
        <div className="flex items-center gap-3">
          <button onClick={() => go(STEPS.length - 1, 'back')}
            className="flex items-center gap-1 rounded-[10px] border px-4 py-3 text-sm font-semibold"
            style={{ borderColor: 'var(--ink-200)', color: 'var(--text-primary)' }}>
            <ChevronLeft size={15} /> Back
          </button>
          <button onClick={finish}
            className="flex flex-1 items-center justify-center gap-2 rounded-[10px] py-3 text-sm font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            See my path test <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    if (step.kind === 'paths') {
      const taken = (step.excludeFrom || []).map(k => data[k]).filter(Boolean);
      const options = PATH_OPTIONS.filter(p => !taken.includes(p));
      const custom = data[step.key] && !PATH_OPTIONS.includes(data[step.key]) ? data[step.key] : '';
      return (
        <>
          <div className="flex flex-wrap gap-2">
            {options.map(p => (
              <Chip key={p} label={p} selected={data[step.key] === p}
                onClick={() => chooseOne(step.key, data[step.key] === p ? '' : p)} />
            ))}
          </div>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Not on the list? Describe it.
            </span>
            <input value={custom} placeholder="e.g. Sports analytics, climate policy"
              onChange={e => set(step.key, e.target.value)} className={inputCls} style={inputStyle} />
          </label>
        </>
      );
    }

    if (step.kind === 'choice') {
      return (
        <div className="space-y-2">
          {step.options.map((o, i) => (
            <OptionRow key={o.value} option={o} index={i}
              selected={data[step.key] === o.value}
              onSelect={() => chooseOne(step.key, o.value)} />
          ))}
        </div>
      );
    }

    if (step.kind === 'text') {
      return (
        <>
          <div className="space-y-2">
            {step.options.map((o, i) => (
              <OptionRow key={o.value} option={o} index={i} multi
                selected={textHasSuggestion(step.key, o.value)}
                onSelect={() => toggleTextSuggestion(step.key, o.value)} />
            ))}
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {step.customLabel}
            </span>
            <input value={data[step.key] || ''} placeholder={step.placeholder}
              onChange={e => set(step.key, e.target.value)} className={inputCls} style={inputStyle} />
          </label>
        </>
      );
    }

    if (step.kind === 'sliders') {
      return (
        <div className="space-y-5">
          {SLIDERS.map(s => (
            <label key={s.name} className="block">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{s.label}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--brand-navy-900)' }}>{data[s.name] ?? 3}/5</span>
              </div>
              <p className="mb-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>
              <input type="range" min="1" max="5" value={data[s.name] ?? 3}
                onChange={e => set(s.name, Number(e.target.value))}
                className="w-full accent-[color:var(--brand-navy-900)]" />
            </label>
          ))}
        </div>
      );
    }

    if (step.kind === 'toggles') {
      return (
        <div className="space-y-2">
          {TOGGLES.map((t, i) => (
            <OptionRow key={t.name} option={{ value: t.name, label: t.label }} index={i} multi
              selected={!!data[t.name]}
              onSelect={() => set(t.name, !data[t.name])} />
          ))}
        </div>
      );
    }

    if (step.kind === 'vision') {
      const themes = Array.isArray(data.vision_themes) ? data.vision_themes : [];
      return (
        <>
          <div className="flex flex-wrap gap-2">
            {VISION_THEMES.map(t => (
              <Chip key={t} label={t} selected={themes.includes(t)}
                onClick={() => toggleInList('vision_themes', t)} />
            ))}
          </div>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Anything you want to say in your own words
            </span>
            <textarea rows={3} value={data.desired_lifestyle || ''}
              placeholder="The work, the lifestyle, the money, the freedom — or what you are unsure about."
              onChange={e => set('desired_lifestyle', e.target.value)} className={inputCls} style={inputStyle} />
          </label>
        </>
      );
    }

    // about — the only screen that groups fields, because none of them need thought
    const missing = missingOnAbout();
    const textField = (name, label, placeholder) => (
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {label} <span style={{ color: 'var(--brand-navy-900)' }}>*</span>
        </span>
        <input value={data[name] || ''} placeholder={placeholder}
          onChange={e => set(name, e.target.value)}
          className={inputCls}
          style={{ ...inputStyle, borderColor: error && missing.includes(name) ? '#f87171' : 'var(--ink-200)' }} />
      </label>
    );
    return (
      <div className="space-y-4">
        {textField('name', 'Full name', 'Your name')}
        <div className="grid gap-4 sm:grid-cols-2">
          {textField('college', 'College or university', 'Where do you study?')}
          {textField('major', 'Major', 'Your primary major')}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Year in school <span className="font-normal">· optional</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {SCHOOL_YEARS.map(y => (
              <Chip key={y} label={y} selected={data.school_year === y}
                onClick={() => set('school_year', data.school_year === y ? '' : y)} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Graduation year <span className="font-normal">· optional</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {GRAD_YEARS.map(y => (
              <Chip key={y} label={y} selected={String(data.graduation_year || '') === y}
                onClick={() => set('graduation_year', String(data.graduation_year || '') === y ? '' : y)} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return shell(
    <div key={index} className={dir === 'fwd' ? 'step-pane-fwd' : 'step-pane-back'}>
      <h1 ref={headingRef} tabIndex={-1} className="font-heading text-[26px] font-bold leading-tight outline-none" style={{ color: 'var(--surface-dark-900)' }}>
        {step.question}
      </h1>
      <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {step.hint}
        {!step.required && <span className="ml-1 font-semibold" style={{ color: 'var(--ink-400)' }}>Optional.</span>}
      </p>
      <div className="mt-5 min-h-[240px]">{renderStep()}</div>
    </div>,
    <div className={footerCls}>
      <div className="flex items-center gap-3">
        <button onClick={back}
          className="flex items-center gap-1 rounded-[10px] border px-4 py-3 text-sm font-semibold"
          style={{ borderColor: 'var(--ink-200)', color: 'var(--text-primary)' }}>
          <ChevronLeft size={15} /> Back
        </button>
        <button onClick={next}
          className="flex flex-1 items-center justify-center gap-2 rounded-[10px] py-3 text-sm font-semibold text-white"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
          {ctaLabel} <ChevronRight size={15} />
        </button>
      </div>
      {/* Everything between the path questions and the identity fields is
          optional, so say it out loud instead of making people tap Skip eight
          times to find that out. */}
      {index > 0 && index < STEPS.length - 1 && (
        <button onClick={() => go(STEPS.length - 1, 'fwd')}
          className="mt-2.5 block w-full text-center text-xs font-semibold"
          style={{ color: 'var(--text-secondary)' }}>
          Skip the rest — these are all optional
        </button>
      )}
    </div>
  );
}
