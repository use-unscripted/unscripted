/**
 * The guest intake: one question per screen.
 *
 * Rebuilt around the product's assumption that THE STUDENT DOES NOT NEED TO
 * KNOW WHAT CAREER THEY WANT. Naming a career is optional at every point. What
 * the intake is actually for is a clarity baseline, a few candidate hypotheses,
 * and an explicit list of what has not been tested yet.
 *
 * This is the same onboarding system as before, not a second one: the same
 * guest draft in localStorage, the same review screen, the same
 * /claim-onboarding write into the one StudentProfile row, the same funnel
 * events. The questions changed; the plumbing did not.
 *
 * Two rules govern what is asked:
 *
 *   1. Four answers are required: the clarity baseline, plus name, college and
 *      major. Everything else says "optional" and has a visible Skip.
 *
 *   2. A question earns its place only if something downstream reads it. Every
 *      key is consumed by ClaimOnboarding when the profile is written, and from
 *      there by the path generator, the uncertainty model, or the campus
 *      matcher.
 *
 * The questions themselves live in src/lib/onboarding-steps.js and the controls
 * in src/components/onboarding/OnboardingFields.jsx, so this file only decides
 * what comes next.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';
import { ProgressBar, OptionRow, GuidedStyles, footerCls } from '@/components/guided/GuidedPieces';
import { saveDraft, loadDraft, clearDraft } from '@/lib/guest-draft';
import { trackFunnel, trackFunnelOnce } from '@/lib/funnel';
import { bucketPath } from '@/lib/intake-bucket';
import {
  STEPS, REVIEW, sectionFor, summarise, blockedReason, missingOnAbout,
  DRAINS, DRAIN_RESPONSES, VALUES, VALUE_LEVELS, WORK_SETTINGS,
  EXPERIENCE_KINDS, SCHOOL_YEARS, GRAD_YEARS,
} from '@/lib/onboarding-steps';
import {
  Chip, Scale, Tags, ChipsMulti, Matrix, ValuesGrid, Experiences,
} from '@/components/onboarding/OnboardingFields';
import OnboardingScenarioStep from '@/components/onboarding/OnboardingScenarioStep';
import OnboardingEarlyRead from '@/components/onboarding/OnboardingEarlyRead';
import { earlyRead, earlyReadEventProps } from '@/lib/onboarding-early-read';

/** Bumped with the question set. An older draft's step number points at a
 *  question that no longer exists, so only a matching version restores it. */
const INTAKE_VERSION = 4;

/**
 * The early read sits between this question and the next one, which is the end
 * of the first section. Found by key rather than written as a number so that
 * reordering the questions moves it instead of stranding it, and so that
 * removing that question turns it off rather than breaking the flow.
 *
 * It is an interstitial, not a question: `index` does not move while it is up,
 * so STEPS.length is still the total the student was promised and the counter
 * does not jump. The one thing it must never become is STEPS[n].
 */
const EARLY_READ_AFTER = STEPS.findIndex(s => s.key === 'current_decision_pressure');

const TOGGLES = [
  { name: 'willing_financial_risk', label: 'I will take financial risk for better upside' },
  { name: 'willing_long_hours', label: 'I will work long hours early in my career' },
];

const inputCls =
  'w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base md:text-sm outline-none transition focus:border-[color:var(--brand-navy-900)]';
const inputStyle = { borderColor: 'var(--border-light)', background: 'var(--background-secondary)' };

export default function Onboarding() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState('fwd');
  // Hours starts on the middle bucket rather than empty. The generator plans
  // against 8 hours when nothing is set, so leaving it blank would silently
  // pick for the student.
  const [data, setData] = useState({ available_hours_per_week: 8 });
  const [error, setError] = useState('');
  const [resumed, setResumed] = useState(false);
  // The early read is a screen, not a step. Once per visit: a student who goes
  // back to change an answer and comes forward again is not shown it twice.
  const [onEarlyRead, setOnEarlyRead] = useState(false);
  const earlyReadShownRef = useRef(false);
  const advanceRef = useRef(null);
  const clearedRef = useRef(null);
  const topRef = useRef(null);
  const headingRef = useRef(null);

  const step = STEPS[index];
  const reviewing = index === REVIEW;

  // Restore a draft, then let ?step= override where it drops you.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      const { draft_version, guest_session_id, started_at, updated_at, completed, current_step, intake_version, ...fields } = draft;
      setData({ available_hours_per_week: 8, ...fields });
      setResumed(Object.values(fields).some(v => (Array.isArray(v) ? v.length : String(v ?? '').trim())));
      if (intake_version === INTAKE_VERSION && current_step != null) setIndex(Math.min(current_step, REVIEW));
    }
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
    setOnEarlyRead(false);
    earlyReadShownRef.current = false;
    setIndex(0);
    setDir('back');
  };

  // Every question starts at the top of the page and takes focus. The early
  // read is in here too: it swaps the whole card without moving `index`, so
  // leaving it out would change the screen under a student and leave their
  // focus and scroll position on the last one.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    headingRef.current?.focus({ preventScroll: true });
  }, [index, onEarlyRead]);

  // A student who has seen the review screen has answered everything, so a
  // screen headed "from your first five answers" is behind them. Editing an
  // early answer from the review must not surface it.
  useEffect(() => {
    if (index === REVIEW) earlyReadShownRef.current = true;
  }, [index]);

  const persist = (nextData, nextStep) =>
    saveDraft({ ...nextData, intake_version: INTAKE_VERSION, current_step: nextStep ?? index });

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

  /** Report a question as cleared, at most once in a row. */
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
      reportStepCleared(index);
      persist({ ...data, [key]: value }, index + 1);
      setDir('fwd');
      setIndex(i => Math.min(i + 1, REVIEW));
    }, 230);
  };

  // A tapped suggestion on a free-text question joins the comma list.
  const toggleTextSuggestion = (key, value) => {
    const parts = (data[key] || '').split(',').map(p => p.trim()).filter(Boolean);
    const has = parts.some(p => p.toLowerCase() === value.toLowerCase());
    set(key, (has ? parts.filter(p => p.toLowerCase() !== value.toLowerCase()) : [...parts, value]).join(', '));
  };

  const textHasSuggestion = (key, value) =>
    (data[key] || '').split(',').map(p => p.trim().toLowerCase()).includes(value.toLowerCase());

  const next = () => {
    const reason = blockedReason(step, data);
    if (reason) {
      setError(reason);
      trackFunnel('intake_step_blocked', { step_index: index + 1, step_label: step.key, missing_count: 1 });
      return;
    }
    setError('');
    reportStepCleared(index);
    // Kept under the name the existing dashboards read. A student who named no
    // career reports as undecided rather than dropping out of the funnel.
    if (step.key === 'current_careers_considered') {
      const considered = Array.isArray(data.current_careers_considered) ? data.current_careers_considered : [];
      trackFunnel('paths_selected', {
        primary_path: considered.length ? bucketPath(considered[0]) : 'undecided',
        has_comparison: considered.length > 1,
      });
    }
    // The end of the first section, once. The draft still points at the
    // question behind it, so a reload from here lands on an answered question
    // rather than skipping a screen the student had not finished reading.
    if (index === EARLY_READ_AFTER && !earlyReadShownRef.current) {
      earlyReadShownRef.current = true;
      persist(data, index);
      setDir('fwd');
      setOnEarlyRead(true);
      return;
    }
    persist(data, index + 1);
    go(Math.min(index + 1, REVIEW), 'fwd');
  };

  const back = () => {
    if (index === 0) { nav('/'); return; }
    persist(data, index - 1);
    go(index - 1, 'back');
  };

  const leaveEarlyRead = (direction) => {
    setOnEarlyRead(false);
    setDir(direction);
    if (direction === 'back') return;
    persist(data, EARLY_READ_AFTER + 1);
    go(Math.min(EARLY_READ_AFTER + 1, REVIEW), 'fwd');
  };

  const finish = () => {
    persist(data, REVIEW);
    trackFunnelOnce('paths_intake_reached', 'paths_intake_reached', { intake_version: INTAKE_VERSION });
    nav('/onboarding-review');
  };

  // Number keys pick an option on the single-choice questions; Enter continues.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      const typing = ['INPUT', 'TEXTAREA'].includes(tag);
      const ownsEnter = ['BUTTON', 'A', 'SELECT'].includes(tag) || e.target?.getAttribute?.('role') === 'button';
      if (e.key === 'Enter' && !e.shiftKey) {
        // Enter continues everywhere else in the intake, so it continues here
        // too. Without this branch it would fall through to next() and advance
        // the question underneath the early read.
        if (onEarlyRead) {
          if (ownsEnter) return;
          e.preventDefault();
          leaveEarlyRead('fwd');
          return;
        }
        if (typing && tag === 'TEXTAREA') return;
        // The tag list on a question that adds items on Enter belongs to that
        // control, not to the footer.
        if (typing && step?.kind === 'tags') return;
        if (ownsEnter) return;
        if (reviewing) return;
        e.preventDefault();
        next();
        return;
      }
      if (typing || reviewing || onEarlyRead || step?.kind !== 'choice') return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > step.options.length) return;
      chooseOne(step.key, step.options[n - 1].value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Derived from the answers already in hand. No model call, no network, no
  // wait: that is the whole point of showing it here rather than at the end.
  const read = useMemo(() => (onEarlyRead ? earlyRead(data) : null), [onEarlyRead, data]);

  useEffect(() => {
    if (!read) return;
    // Counts and booleans only, the same rule as every other funnel event.
    trackFunnelOnce('intake_early_read_shown', 'intake_early_read_shown', earlyReadEventProps(read));
  }, [onEarlyRead]);

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
              {reviewing ? 'REVIEW' : onEarlyRead ? 'EARLY READ' : `${index + 1} OF ${STEPS.length}`}
            </span>
            <Link to="/login" className="tp-meta font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition">
              Log in
            </Link>
          </div>
        </div>

        {/* Driven by `index` alone, which the early read deliberately does not
            move. The bar sits exactly where the last question left it. */}
        <div className="mb-8">
          <ProgressBar value={(index + 1) / (REVIEW + 1)} />
        </div>

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
          No account yet. You do not need to know what career you want.{' '}
          <Link to="/login" className="underline hover:text-[color:var(--text-primary)]">Already have an account?</Link>
        </p>
      </div>
    </main>
  );

  if (onEarlyRead && read) {
    return shell(
      <div key="early-read" className={dir === 'fwd' ? 'step-pane-fwd' : 'step-pane-back'}>
        <OnboardingEarlyRead read={read} headingRef={headingRef} />
      </div>,
      <div className={footerCls}>
        <div className="flex items-center gap-3">
          <button onClick={() => leaveEarlyRead('back')}
            className="ui-press flex items-center gap-1 rounded-[var(--r-control)] border px-4 text-sm font-bold"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}>
            <ChevronLeft size={15} /> Back
          </button>
          <button onClick={() => leaveEarlyRead('fwd')}
            className="ui-press flex flex-1 items-center justify-center gap-2 rounded-[var(--r-control)] text-sm font-bold text-white"
            style={{ background: 'var(--brand-navy-900)', minHeight: '48px', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            Keep going <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

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
          Tap any answer to change it. None of this is treated as settled, and your experiments are what test it.
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
            See what I should test <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    if (step.kind === 'clarity') {
      return (
        <div className="space-y-6">
          <Scale
            label="How certain are you about what you want to do?"
            value={data.baseline_career_clarity || null}
            onChange={v => set('baseline_career_clarity', v)}
            lowLabel="No idea at all"
            highLabel="Completely certain"
          />
          <Scale
            label="And how confident are you in that answer?"
            description="Optional. Someone can be fairly sure of a direction and not at all confident in it."
            value={data.baseline_confidence || null}
            onChange={v => set('baseline_confidence', v)}
            lowLabel="Not confident"
            highLabel="Very confident"
          />
        </div>
      );
    }

    if (step.kind === 'tags') {
      return (
        <Tags
          value={Array.isArray(data[step.key]) ? data[step.key] : []}
          onChange={v => set(step.key, v)}
          placeholder={step.placeholder}
        />
      );
    }

    if (step.kind === 'pressure') {
      return (
        <div className="space-y-4">
          {[
            { name: 'pressured_path', label: 'Something you feel pushed toward', placeholder: 'e.g. Law school, or the one my parents want' },
            { name: 'curious_path', label: 'Something you are quietly curious about', placeholder: 'e.g. Writing, or something I have never told anyone' },
          ].map(f => (
            <label key={f.name} className="block">
              <span className="tp-meta mb-2 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {f.label} <span className="font-normal">· optional</span>
              </span>
              <input value={data[f.name] || ''} placeholder={f.placeholder} autoComplete="off"
                onChange={e => set(f.name, e.target.value)} className={inputCls} style={inputStyle} />
            </label>
          ))}
        </div>
      );
    }

    if (step.kind === 'chips') {
      return (
        <ChipsMulti
          options={step.options}
          value={Array.isArray(data[step.key]) ? data[step.key] : []}
          onChange={v => set(step.key, v)}
          note={data[step.noteKey]}
          onNote={v => set(step.noteKey, v)}
          noteLabel={step.noteLabel}
          notePlaceholder={step.notePlaceholder}
        />
      );
    }

    if (step.kind === 'matrix') {
      return (
        <Matrix
          items={DRAINS}
          responses={DRAIN_RESPONSES}
          value={Array.isArray(data.self_reported_drains) ? data.self_reported_drains : []}
          onChange={v => set('self_reported_drains', v)}
        />
      );
    }

    if (step.kind === 'values') {
      return (
        <ValuesGrid
          factors={VALUES}
          levels={VALUE_LEVELS}
          value={Array.isArray(data.values_importance) ? data.values_importance : []}
          onChange={v => set('values_importance', v)}
          settings={WORK_SETTINGS}
          setting={data.work_setting_preference || ''}
          onSetting={v => set('work_setting_preference', v)}
        />
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

    if (step.kind === 'scenarios') {
      return (
        <OnboardingScenarioStep
          value={Array.isArray(data.scenario_answers) ? data.scenario_answers : []}
          onChange={v => set('scenario_answers', v)}
        />
      );
    }

    if (step.kind === 'experiences') {
      return (
        <Experiences
          kinds={EXPERIENCE_KINDS}
          value={Array.isArray(data.prior_experiences) ? data.prior_experiences : []}
          onChange={v => set('prior_experiences', v)}
        />
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
            <span className="tp-meta mb-2 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {step.customLabel}
            </span>
            <input value={data[step.key] || ''} placeholder={step.placeholder}
              onChange={e => set(step.key, e.target.value)} className={inputCls} style={inputStyle} />
          </label>
        </>
      );
    }

    // about: the only screen that groups fields, because none of them need thought
    const missing = missingOnAbout(data);
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