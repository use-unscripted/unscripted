/**
 * The guest intake: one question per screen.
 *
 * Built on the same guided pieces as the outreach survey
 * (src/components/guided/GuidedPieces.jsx), so the signed-out intake and the
 * signed-in flows behave identically: tap an answer and it advances, number
 * keys pick, Enter continues, and every optional question has a visible Skip.
 *
 * Two rules govern what is asked here, and both matter more than the layout:
 *
 *   1. Only four answers are required: the path to test, plus name, college
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
 * Path selection used to be a separate page (/paths-intake). It is steps 1-4
 * here now; that route redirects into this flow.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';
import { ProgressBar, OptionRow, GuidedStyles, footerCls } from '@/components/guided/GuidedPieces';
import { saveDraft, loadDraft, clearDraft } from '@/lib/guest-draft';
import { trackFunnel, trackFunnelOnce } from '@/lib/funnel';
// The path questions are a plain text box, so the funnel event reports a
// bucket rather than what a student typed. See the module for why that list
// is never shown to anyone.
import { bucketPath } from '@/lib/intake-bucket';

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

/**
 * Types an example out, holds it, deletes it, moves to the next one. The
 * placeholder is the demonstration.
 *
 * Runs only while `active`, which the caller drops the moment the field has
 * text or the cursor is in it: a placeholder that keeps moving while somebody
 * is trying to type in the box is the version of this that people hate. It
 * also stops entirely under prefers-reduced-motion, where a single static
 * example is shown instead.
 */
function useTypedPlaceholder(examples, active) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!active) return undefined;
    let word = 0;
    let chars = 0;
    let deleting = false;
    let timer;

    const tick = () => {
      const current = examples[word % examples.length];
      chars += deleting ? -1 : 1;
      setText(current.slice(0, chars));

      let delay = deleting ? 26 : 58;
      if (!deleting && chars >= current.length) { deleting = true; delay = 1500; }
      else if (deleting && chars <= 0) { deleting = false; word += 1; delay = 300; }
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 450);
    return () => clearTimeout(timer);
  }, [examples, active]);

  return text;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* One question per screen. `kind` drives the control:
   paths     one text box; the examples type themselves in the placeholder
   choice    tap exactly one (auto-advances)
   text      chips that fill in a text answer, plus your own words
   sliders   the five priority scores, together, because they are comparative
   toggles   tap any that are true
   vision    theme chips plus an optional description
   about     the identity fields, grouped: they need no thought, so grouping
               them is faster than five screens of typing

   Anything without `required` is skippable and says so.                     */
const STEPS = [
  {
    key: 'primary_path',
    kind: 'paths',
    required: true,
    question: 'Which path do you want to test first?',
    hint: 'You can change this later. Trying a path is not the same as choosing it.',
    examples: [
      'Investment banking',
      'Product design',
      'Sports analytics',
      'Medicine',
      'Starting my own thing',
      'Climate policy',
    ],
  },
  {
    key: 'comparison_path',
    kind: 'paths',
    question: 'Anything you want to weigh it against?',
    // "your three recommendations" assumed a student already knew what the
    // product does. At this point in the intake they have seen one question.
    hint: 'When you finish, we suggest three paths worth testing. Name a second one and it becomes one of the three, so you can compare them directly.',
    examples: [
      'Management consulting',
      'Grad school',
      'Working at a startup',
      'Something creative',
    ],
  },
  {
    key: 'pressured_path',
    kind: 'paths',
    question: 'Which path do you feel pushed toward?',
    hint: 'By family, by friends, by whoever is around you. Naming it keeps it separate from what you actually want.',
    examples: [
      'Law school',
      'The one my parents want',
      'Whatever everyone recruits for',
      'Medicine',
    ],
  },
  {
    key: 'curious_path',
    kind: 'paths',
    question: 'Which one are you quietly curious about?',
    hint: 'The one you would try if nobody found out. This answer changes what we suggest.',
    examples: [
      'Writing',
      'Running a restaurant',
      'Game design',
      'Teaching',
      'Something I have never told anyone',
    ],
  },
  {
    key: 'available_hours_per_week',
    kind: 'choice',
    question: 'How many hours a week can you really give this?',
    hint: 'Be conservative. A focused 6 hours beats an imaginary 20.',
    options: [
      { value: 4, label: '2-4 hours', desc: 'A couple of evenings' },
      { value: 8, label: '5-8 hours', desc: 'Where most students land' },
      { value: 12, label: '9-12 hours', desc: 'A serious block of your week' },
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
    question: 'What is keeping you stuck?',
    hint: 'Nobody else sees this. Pick the one that is actually true.',
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
    hint: '1 means you do not care. 5 means you will not give it up.',
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
    hint: 'Five or ten years out. Tap whatever fits, and change your mind later.',
  },
  {
    key: 'about',
    kind: 'about',
    required: true,
    question: 'Last one. Who are you?',
    hint: 'Your guides and outreach emails go out in your name, so we need these three.',
  },
];

const REVIEW = STEPS.length;

// Which stretch of the intake each question belongs to. Four questions about
// paths, two about the week, four about what the student wants, one about them.
const SECTIONS = [
  { until: 4,  label: 'Your paths' },
  { until: 6,  label: 'Your week' },
  { until: 10, label: 'What matters to you' },
  { until: 11, label: 'About you' },
];
const sectionFor = (i) => (SECTIONS.find(sn => i < sn.until) || SECTIONS[SECTIONS.length - 1]).label;

const inputCls =
  'w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base md:text-sm outline-none transition focus:border-[color:var(--brand-navy-900)]';
const inputStyle = { borderColor: 'var(--border-light)', background: 'var(--background-secondary)' };

// A pill for the chip grids: paths, vision themes, school year, graduation year.
function Chip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="opt-row inline-flex min-h-[44px] items-center rounded-full border px-4 text-[13px] font-bold"
      style={{
        animationDelay: '0ms',
        borderColor: selected ? 'var(--brand-navy-900)' : 'var(--ink-200)',
        background: selected ? 'var(--brand-navy-900)' : 'var(--brand-white)',
        color: selected ? '#fff' : 'var(--text-primary)',
      }}
    >
      {label}
    </button>
  );
}

/**
 * The whole control for a path question: one box, and examples that type
 * themselves into the placeholder until the student starts answering.
 *
 * Rendered with a key per question so the animation restarts on each one
 * rather than carrying the previous question's half-typed word across.
 */
function PathField({ step, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  const animating = !reduced && !focused && !value;
  const typed = useTypedPlaceholder(step.examples, animating);

  return (
    <label className="block">
      <span className="sr-only">{step.question}</span>
      <input
        autoComplete="off"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Once the cursor is in the box the examples stop moving and settle on
        // one, so the hint is still there but nothing is animating under a
        // student who is mid-sentence.
        placeholder={animating ? `${typed}▌` : step.examples[0]}
        className="w-full rounded-[var(--r-control)] border px-4 py-4 text-lg outline-none transition focus:border-[color:var(--brand-navy-900)]"
        style={{ borderColor: 'var(--border-light)', background: 'var(--background-secondary)' }}
      />
      <span className="tp-meta mt-2 block" style={{ color: 'var(--text-muted)' }}>
        Anything you can name. It does not have to be a job title.
      </span>
    </label>
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
      return [themes.join(', '), (data.desired_lifestyle || '').trim()].filter(Boolean).join(' · ');
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
  const [resumed, setResumed] = useState(false);
  const advanceRef = useRef(null);
  const clearedRef = useRef(null);
  const topRef = useRef(null);
  const headingRef = useRef(null);

  const step = STEPS[index];
  const reviewing = index === REVIEW;

  // Restore a draft, then let ?step= override where it drops you. That is how
  // "edit my path selection" gets back to question one.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      const { draft_version, guest_session_id, started_at, updated_at, completed, current_step, intake_version, ...fields } = draft;
      setData({ available_hours_per_week: 8, ...fields });
      // Only say "still here" when there is something to see. A draft holding
      // nothing but the hours default would make the notice a lie.
      setResumed(Object.values(fields).some(v => (Array.isArray(v) ? v.length : String(v ?? '').trim())));
      // Only trust a saved position from this version of the flow: an older
      // draft's step number points at a question that no longer exists.
      if (intake_version === 2 && current_step != null) setIndex(Math.min(current_step, REVIEW));
    }
    // Read the param before converting it. Number(null) is 0, not NaN, so
    // testing the converted value treated "no ?step at all" as "?step=0" and
    // sent every returning student back to question one holding answers they
    // had already given. Resuming never worked.
    const raw = params.get('step');
    if (raw !== null) {
      const wanted = Number(raw);
      if (Number.isInteger(wanted) && wanted >= 0 && wanted <= REVIEW) setIndex(wanted);
    }

    trackFunnelOnce('intake_started', 'intake_started', {
      resumed: !!draft,
      resumed_at_step: draft?.current_step ?? 0,
    });
  }, []);

  useEffect(() => () => clearTimeout(advanceRef.current), []);

  const startOver = () => {
    clearDraft();
    setData({ available_hours_per_week: 8 });
    setResumed(false);
    setError('');
    setIndex(0);
    setDir('back');
  };

  // Every question starts at the top of the page, however far you had scrolled,
  // and takes focus. Otherwise focus stays on whatever sat at that spot on the
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

  /**
   * Report a question as cleared, at most once in a row.
   *
   * Tapping an answer and pressing Enter before the auto-advance fires are two
   * routes into the same event for one answer, and counting both would inflate
   * the step the student is standing on.
   */
  const reportStepCleared = (i) => {
    if (clearedRef.current === i || !STEPS[i]) return;
    clearedRef.current = i;
    trackFunnel('intake_step_completed', { step_index: i + 1, step_label: STEPS[i].key });
  };

  // Tapping the one answer a question wants should move you on by itself.
  const chooseOne = (key, value) => {
    set(key, value);
    clearTimeout(advanceRef.current);
    advanceRef.current = setTimeout(() => {
      // Auto-advance has to report the question cleared and save the new
      // position, the same as pressing Continue does. It did neither. The only
      // auto-advancing question is the hours one, so on the funnel the step
      // everybody passes read as the step nobody passes, and closing the tab
      // there dropped you back onto a question you had already answered.
      reportStepCleared(index);
      persist({ ...data, [key]: value }, index + 1);
      setDir('fwd');
      setIndex(i => Math.min(i + 1, REVIEW));
    }, 230);
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
      return missingOnAbout().length ? 'We need your name, college and major before we can build this.' : '';
    }
    return String(data[step.key] || '').trim() ? '' : 'Name a path to test, or type your own.';
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
    reportStepCleared(index);
    // The path choice is still the funnel's hinge, so it keeps reporting under
    // the names the existing dashboards already read.
    if (step.key === 'primary_path') {
      trackFunnel('paths_selected', {
        primary_path: bucketPath(data.primary_path),
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
    // Stamped with the version of the flow that sent it. The name comes from
    // the old intake, where path selection was the last step, so this fired
    // once a visitor had answered everything. Path selection is the first four
    // questions now and the equivalent moment is here, at the end. Same
    // meaning, different position in the flow, and nothing in the event said
    // so until this.
    trackFunnelOnce('paths_intake_reached', 'paths_intake_reached', { intake_version: 2 });
    nav('/onboarding-review');
  };

  // Number keys pick an option on the single-choice questions; Enter continues.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      const typing = ['INPUT', 'TEXTAREA'].includes(tag);
      // A focused button, link or select already does something on Enter.
      // Taking it here would advance the question instead of pressing what
      // the student actually pressed, which breaks Back, the option rows and
      // the chips for anyone navigating by keyboard.
      const ownsEnter = ['BUTTON', 'A', 'SELECT'].includes(tag) || e.target?.getAttribute?.('role') === 'button';
      if (e.key === 'Enter' && !e.shiftKey) {
        if (typing && tag === 'TEXTAREA') return;
        if (ownsEnter) return;
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
    <main className="min-h-[100svh] px-5 py-10" style={{ background: 'var(--page-surface)' }}>
      <div ref={topRef} className="mx-auto max-w-2xl">
        <GuidedStyles />
        <div className="mb-8 flex items-center justify-between">
          <LogoWordmark />
          <div className="flex items-center gap-4">
            <span className="tp-eyebrow text-[color:var(--text-secondary)]">
              {reviewing ? 'REVIEW' : `${index + 1} OF ${STEPS.length}`}
            </span>
            <Link to="/login" className="tp-meta font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition">
              Log in
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <ProgressBar value={(index + 1) / (REVIEW + 1)} />
        </div>

        {/* Answers survive a closed tab, which is the point, but a returning
            student used to meet their own old answer with no explanation and no
            way to clear it. Say it, and give them the out. */}
        {resumed && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-control)] px-4 py-3"
            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
            <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>
              Your answers from last time are still here.
            </p>
            <button onClick={startOver}
              className="ui-press tp-meta rounded-[var(--r-control)] border px-3.5 py-2 font-bold"
              style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', background: 'white' }}>
              Start over
            </button>
          </div>
        )}

        <section className="rounded-[var(--r-surface)] bg-white p-6 pb-0 sm:p-8 sm:pb-0" style={{ border: '1px solid var(--border-light)' }}>
          {children}
          {error && (
            <p className="tp-body mt-4 rounded-[var(--r-control)] px-3 py-2.5" role="alert"
              style={{ background: 'var(--danger-50, #FEF2F2)', color: 'var(--danger-700, #B91C1C)' }}>
              {error}
            </p>
          )}
          {footer}
        </section>

        <p className="tp-meta mt-6 text-center" style={{ color: 'var(--text-muted)' }}>
          No account yet. We need four answers. Everything else you can skip.{' '}
          <Link to="/login" className="underline hover:text-[color:var(--text-primary)]">Already have an account?</Link>
        </p>
      </div>
    </main>
  );

  if (reviewing) {
    return shell(
      <div key="review" className="step-pane-fwd">
        <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
          Your intake
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="tp-page mt-2.5 outline-none" style={{ color: 'var(--text-primary)' }}>
          That is everything.
        </h1>
        <p className="tp-lead mt-3" style={{ color: 'var(--text-secondary)' }}>
          Tap any answer to change it.
        </p>
        <div className="mt-5 space-y-1.5">
          {STEPS.map((s, i) => {
            const value = summarise(s, data);
            return (
              <button key={s.key} type="button" onClick={() => go(i, 'back')}
                className="opt-row flex w-full items-start gap-3 rounded-[var(--r-control)] border px-3.5 py-2.5 text-left"
                style={{ animationDelay: `${i * 30}ms`, borderColor: 'var(--border-light)', background: 'var(--brand-white)' }}>
                <span className="min-w-0 flex-1">
                  <span className="tp-eyebrow block" style={{ color: 'var(--text-secondary)' }}>
                    {s.question}
                  </span>
                  <span className="tp-body mt-1 block font-semibold" style={{ color: value ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
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
            className="ui-press flex items-center gap-1 rounded-[var(--r-control)] border px-4 text-sm font-bold"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}>
            <ChevronLeft size={15} /> Back
          </button>
          <button onClick={finish}
            className="ui-press flex flex-1 items-center justify-center gap-2 rounded-[var(--r-control)] text-sm font-bold text-white"
            style={{ background: 'var(--brand-navy-900)', minHeight: '48px', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            See my path test <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    if (step.kind === 'paths') {
      return <PathField key={step.key} step={step} value={data[step.key] || ''} onChange={v => set(step.key, v)} />;
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
            <span className="tp-meta mb-2 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
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
              <p className="tp-meta mb-2" style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>
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
            <span className="tp-meta mb-2 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Anything you want to say in your own words
            </span>
            <textarea rows={3} value={data.desired_lifestyle || ''}
              placeholder="The work, the money, the freedom, or whatever you are still unsure about."
              onChange={e => set('desired_lifestyle', e.target.value)} className={inputCls} style={inputStyle} />
          </label>
        </>
      );
    }

    // about: the only screen that groups fields, because none of them need thought
    const missing = missingOnAbout();
    const textField = (name, label, placeholder) => (
      <label className="block">
        <span className="tp-meta mb-2 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
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
          <p className="tp-meta mb-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>
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
          <p className="tp-meta mb-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>
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
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
        {sectionFor(index)}
      </p>
      <h1 ref={headingRef} tabIndex={-1} className="tp-page mt-2.5 outline-none" style={{ color: 'var(--text-primary)' }}>
        {step.question}
      </h1>
      <p className="tp-lead mt-3" style={{ color: 'var(--text-secondary)' }}>
        {step.hint}
        {!step.required && <span className="ml-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Optional.</span>}
      </p>
      {/* No minimum height. Holding one open to stop the footer moving between
          steps bought a stripe of empty panel under the shortest questions,
          and there is nothing that belongs in it. Each question is its own
          screen, so the buttons sitting closer on a short one is correct
          rather than inconsistent. */}
      <div className="mt-6 mb-2">{renderStep()}</div>
    </div>,
    <div className={footerCls}>
      <div className="flex items-center gap-3">
        <button onClick={back}
          className="ui-press flex items-center gap-1 rounded-[var(--r-control)] border px-4 text-sm font-bold"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}>
          <ChevronLeft size={15} /> Back
        </button>
        <button onClick={next}
          className="ui-press flex flex-1 items-center justify-center gap-2 rounded-[var(--r-control)] text-sm font-bold text-white"
          style={{ background: 'var(--brand-navy-900)', minHeight: '48px', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
          {ctaLabel} <ChevronRight size={15} />
        </button>
      </div>
      {/* Everything between the path questions and the identity fields is
          optional, so say it out loud instead of making people tap Skip eight
          times to find that out. */}
      {index > 0 && index < STEPS.length - 1 && (
        <button onClick={() => go(STEPS.length - 1, 'fwd')}
          className="tp-meta touch-target mt-2.5 flex w-full items-center justify-center text-center font-semibold"
          style={{ color: 'var(--text-secondary)' }}>
          Skip the rest of the optional questions
        </button>
      )}
    </div>
  );
}
