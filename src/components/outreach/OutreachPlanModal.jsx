/**
 * OutreachPlanModal
 * A multi-step flow:
 *  1. Survey — a guided, one-question-at-a-time wizard (tap an answer or write your own)
 *  2. Generate — AI produces outreach experiments, archetypes, and public contact suggestions
 *  3. Results — user can save contacts, create missions, or dismiss suggestions
 *
 * Props:
 *   path        — PathRecommendation object (required)
 *   experiment  — Experiments object (optional, pre-selects context)
 *   onClose     — () => void
 *   onContactSaved — (contact) => void  (called after saving any contact)
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, Users, Beaker, User, ExternalLink, CheckCircle, ChevronRight, ChevronLeft, AlertTriangle, BookOpen, Save, Target, Pencil, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ProgressBar, OptionRow, GuidedStyles, footerCls } from '@/components/guided/GuidedPieces';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { toText, toTextList, isPlainObject } from '@/lib/ai-validation';

const inputCls = 'w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-2.5 text-sm outline-none focus:border-[color:var(--brand-navy-900)]';

// ── Step 1: Survey ─────────────────────────────────────────────────────────────
const DEFAULT_SURVEY = {
  what_to_learn_tags: [],
  what_to_learn: '',
  conversation_type: 'informational_interview',
  industries: '',
  company_size: 'any',
  geography: '',
  seniority: 'any',
  alumni_preference: 'no_preference',
  time_available: '30',
  networking_comfort: 'moderate',
  preferred_channel: 'linkedin',
  suggestion_type: 'archetypes',
};

// What actually gets sent to the model for the open-ended question: the chips they
// tapped plus anything they typed themselves.
const composeWhatToLearn = (s) =>
  [...(s.what_to_learn_tags || []), (s.what_to_learn || '').trim()].filter(Boolean).join('; ');

/* One question per screen. `kind` drives the control:
   multi  — tap any number of suggested answers, plus a free-text box
   choice — tap exactly one (auto-advances)
   text   — type your own, with taps that fill it in for you

   Keep every list to three or four. More than that and people stall
   reading options instead of answering.                                */
const STEPS = [
  {
    key: 'what_to_learn',
    kind: 'multi',
    question: 'What do you want to get out of these conversations?',
    hint: 'Tap anything that fits, or write your own below.',
    options: [
      { value: 'What the day-to-day actually looks like', label: 'What the day-to-day actually looks like' },
      { value: 'How people broke into this field', label: 'How people broke into this field' },
      { value: 'Whether I would genuinely enjoy this work', label: 'Whether I’d genuinely enjoy the work' },
    ],
    customLabel: 'Something else you want to know',
    placeholder: 'e.g. How competitive is recruiting?',
  },
  {
    key: 'conversation_type',
    kind: 'choice',
    question: 'What kind of conversation are you after?',
    options: [
      { value: 'informational_interview', label: 'Informational interview', desc: 'A short chat to learn how the job really works' },
      { value: 'mentor', label: 'A mentor', desc: 'Someone who checks in with you over time' },
      { value: 'shadowing', label: 'Job shadow', desc: 'Sit alongside someone for a day' },
    ],
  },
  {
    key: 'seniority',
    kind: 'choice',
    question: 'Who do you most want to hear from?',
    hint: 'People closer to your level usually reply more often.',
    options: [
      { value: 'any', label: 'Anyone in the field' },
      { value: 'entry', label: 'People 0-3 years in', desc: 'Closest to what you’d be doing next year' },
      { value: 'mid', label: 'People 3-8 years in', desc: 'Far enough along to see the whole path' },
      { value: 'senior', label: 'Senior (8+ years in)' },
    ],
  },
  {
    key: 'networking_comfort',
    kind: 'choice',
    question: 'How do you feel about messaging someone you don’t know?',
    hint: 'This sets how much hand-holding your plan gives you. There’s no wrong answer.',
    options: [
      { value: 'low', label: 'Honestly, it makes me nervous', desc: 'You’ll get word-for-word scripts and small first steps' },
      { value: 'moderate', label: 'Fine with it, some guidance helps', desc: 'Templates you can adjust' },
      { value: 'high', label: 'Comfortable, I’ll cold message anyone', desc: 'Lighter structure, higher volume' },
    ],
  },
  {
    key: 'preferred_channel',
    kind: 'choice',
    question: 'Where do you want to reach people?',
    options: [
      { value: 'linkedin', label: 'LinkedIn' },
      { value: 'email', label: 'Email' },
      { value: 'in_person', label: 'In person, at events' },
      { value: 'any', label: 'Open to any of it' },
    ],
  },
  {
    key: 'time_available',
    kind: 'choice',
    question: 'How much time can you give each conversation?',
    options: [
      { value: '15', label: '15 minutes', desc: 'Easiest ask to say yes to' },
      { value: '30', label: '30 minutes', desc: 'The standard informational interview' },
      { value: 'async', label: 'Email only, no calls' },
    ],
  },
  {
    key: 'alumni_preference',
    kind: 'choice',
    question: 'Do you want to focus on alumni from your school?',
    hint: 'Alumni reply far more often than strangers do.',
    options: [
      { value: 'no_preference', label: 'No preference' },
      { value: 'prefer_alumni', label: 'Lean toward alumni' },
      { value: 'alumni_only', label: 'Alumni only' },
    ],
  },
  {
    key: 'industries',
    kind: 'text',
    optional: true,
    question: 'Any particular industry or niche?',
    hint: 'Optional. Skip it and we’ll cover the field broadly.',
    options: [
      { value: 'Healthcare', label: 'Healthcare' },
      { value: 'FinTech', label: 'FinTech' },
      { value: 'Early-stage startups', label: 'Early-stage startups' },
    ],
    customLabel: 'Or type your own',
    placeholder: 'e.g. Climate tech, sports analytics',
  },
  {
    key: 'company_size',
    kind: 'choice',
    optional: true,
    question: 'What size company appeals to you?',
    options: [
      { value: 'any', label: 'No preference' },
      { value: 'startup', label: 'Startup', desc: 'Under 50 people' },
      { value: 'mid', label: 'Mid-size', desc: '200-1,000 people' },
      { value: 'large', label: 'Large', desc: '1,000+ people' },
    ],
  },
  {
    key: 'geography',
    kind: 'text',
    optional: true,
    question: 'Anywhere in particular?',
    hint: 'Optional.',
    options: [
      { value: 'Anywhere', label: 'Anywhere' },
      { value: 'Remote OK', label: 'Remote is fine' },
      { value: 'Near campus', label: 'Near campus' },
    ],
    customLabel: 'Or type your own',
    placeholder: 'e.g. Chicago, the Bay Area',
  },
];

// ── The guided survey ──────────────────────────────────────────────────────────
function SurveyStep({ pathName, survey, setSurvey, index, setIndex, onGenerate, onClose, error }) {
  const [dir, setDir] = useState('fwd');           // index: 0..STEPS.length (last = review)
  const advanceRef = useRef(null);
  const rootRef = useRef(null);
  const reviewing = index === STEPS.length;
  const step = STEPS[index];

  useEffect(() => () => clearTimeout(advanceRef.current), []);

  // A new question should always start at the top, even on a short screen.
  useEffect(() => {
    rootRef.current?.closest('[data-modal-scroll]')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [index]);

  const go = useCallback((next, direction) => {
    clearTimeout(advanceRef.current);
    setDir(direction);
    setIndex(next);
  }, [setIndex]);

  const next = useCallback(() => go(Math.min(index + 1, STEPS.length), 'fwd'), [go, index]);
  const back = useCallback(() => go(Math.max(index - 1, 0), 'back'), [go, index]);

  const set = (key, value) => setSurvey(s => ({ ...s, [key]: value }));

  const toggleTag = (value) => setSurvey(s => {
    const tags = s.what_to_learn_tags || [];
    return { ...s, what_to_learn_tags: tags.includes(value) ? tags.filter(t => t !== value) : [...tags, value] };
  });

  // Tapping a suggestion on a free-text question toggles it in the comma list,
  // so it behaves like a preset without locking out typing.
  const toggleTextSuggestion = (key, value) => setSurvey(s => {
    const parts = (s[key] || '').split(',').map(p => p.trim()).filter(Boolean);
    const has = parts.some(p => p.toLowerCase() === value.toLowerCase());
    const nextParts = has ? parts.filter(p => p.toLowerCase() !== value.toLowerCase()) : [...parts, value];
    return { ...s, [key]: nextParts.join(', ') };
  });

  const textHasSuggestion = (key, value) =>
    (survey[key] || '').split(',').map(p => p.trim().toLowerCase()).includes(value.toLowerCase());

  const chooseOne = (key, value) => {
    set(key, value);
    clearTimeout(advanceRef.current);
    advanceRef.current = setTimeout(() => { setDir('fwd'); setIndex(i => Math.min(i + 1, STEPS.length)); }, 230);
  };

  const answered = !reviewing && step.kind === 'multi'
    ? composeWhatToLearn(survey).length > 0
    : true;

  // Keyboard: number keys pick an option, Enter continues, Esc closes.
  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(e.target?.tagName);
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Enter' && !e.shiftKey) {
        if (typing && e.target.tagName === 'TEXTAREA') return;
        if (reviewing) return;
        if (answered) { e.preventDefault(); next(); }
        return;
      }
      if (typing || reviewing || !step) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > (step.options?.length || 0)) return;
      const option = step.options[n - 1];
      if (step.kind === 'choice') chooseOne(step.key, option.value);
      else if (step.kind === 'multi') toggleTag(option.value);
      else toggleTextSuggestion(step.key, option.value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const header = (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="truncate rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>
          {pathName}
        </span>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {reviewing ? 'Review' : `${index + 1} of ${STEPS.length}`}
          </span>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-0.5" style={{ color: 'var(--ink-500)' }}>
            <X size={18} />
          </button>
        </div>
      </div>
      <ProgressBar value={(index + 1) / (STEPS.length + 1)} />
    </div>
  );

  if (reviewing) {
    return (
      <div ref={rootRef}>
        <GuidedStyles />
        {header}
        <div key="review" className="step-pane-fwd">
          <h2 className="font-heading text-[26px] font-bold leading-tight" style={{ color: 'var(--surface-dark-900)' }}>
            That’s everything.
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Tap any answer to change it.
          </p>

          <div className="mt-5 space-y-1.5">
            {STEPS.map((s, i) => {
              const value = s.kind === 'multi'
                ? composeWhatToLearn(survey)
                : s.kind === 'text'
                  ? (survey[s.key] || '').trim()
                  : s.options.find(o => o.value === survey[s.key])?.label;
              return (
                <button key={s.key} type="button" onClick={() => go(i, 'back')}
                  className="opt-row flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left"
                  style={{ animationDelay: `${i * 30}ms`, borderColor: 'var(--ink-200)', background: 'var(--brand-white)' }}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                      {s.question}
                    </span>
                    <span className="mt-0.5 block text-sm font-semibold" style={{ color: value ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {value || 'No preference'}
                    </span>
                  </span>
                  <Pencil size={13} className="mt-1 shrink-0" style={{ color: 'var(--ink-300)' }} />
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: 'var(--ink-200)', background: '#FAFBFC' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Also suggest real people to contact?</p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Public figures in this field. You’ll still need to verify each one.
            </p>
            <div className="mt-3 space-y-2">
              {[
                { value: 'archetypes', label: 'Just role types' },
                { value: 'both', label: 'Role types + real people' },
              ].map((o, i) => (
                <OptionRow key={o.value} option={o} index={i}
                  selected={survey.suggestion_type === o.value}
                  onSelect={() => set('suggestion_type', o.value)} />
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
              <AlertTriangle size={14} />{error}
            </div>
          )}

          <div className={footerCls}>
            <div className="flex items-center gap-3">
              <button onClick={back}
                className="flex items-center gap-1 rounded-[10px] border px-4 py-3 text-sm font-semibold"
                style={{ borderColor: 'var(--ink-200)', color: 'var(--text-primary)' }}>
                <ChevronLeft size={15} /> Back
              </button>
              <button onClick={onGenerate}
                className="flex flex-1 items-center justify-center gap-2 rounded-[10px] py-3 text-sm font-semibold text-white"
                style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
                <Sparkles size={15} /> Build my outreach plan
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <GuidedStyles />
      {header}

      <div key={index} className={dir === 'fwd' ? 'step-pane-fwd' : 'step-pane-back'}>
        <h2 className="font-heading text-[26px] font-bold leading-tight" style={{ color: 'var(--surface-dark-900)' }}>
          {step.question}
        </h2>
        {step.hint && (
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{step.hint}</p>
        )}

        <div className="mt-5 min-h-[220px]">
          {step.kind === 'choice' && (
            <div className="space-y-2">
              {step.options.map((o, i) => (
                <OptionRow key={o.value} option={o} index={i}
                  selected={survey[step.key] === o.value}
                  onSelect={() => chooseOne(step.key, o.value)} />
              ))}
            </div>
          )}

          {step.kind === 'multi' && (
            <>
              <div className="space-y-2">
                {step.options.map((o, i) => (
                  <OptionRow key={o.value} option={o} index={i} multi
                    selected={(survey.what_to_learn_tags || []).includes(o.value)}
                    onSelect={() => toggleTag(o.value)} />
                ))}
              </div>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {step.customLabel}
                </span>
                <textarea rows={2} value={survey[step.key]} placeholder={step.placeholder}
                  onChange={(e) => set(step.key, e.target.value)} className={inputCls} />
              </label>
            </>
          )}

          {step.kind === 'text' && (
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
                <input value={survey[step.key]} placeholder={step.placeholder}
                  onChange={(e) => set(step.key, e.target.value)} className={inputCls} />
              </label>
            </>
          )}
        </div>
      </div>

      <div className={footerCls}>
        <div className="flex items-center gap-3">
          {index > 0 ? (
            <button onClick={back}
              className="flex items-center gap-1 rounded-[10px] border px-4 py-3 text-sm font-semibold"
              style={{ borderColor: 'var(--ink-200)', color: 'var(--text-primary)' }}>
              <ChevronLeft size={15} /> Back
            </button>
          ) : (
            <button onClick={onClose}
              className="rounded-[10px] border px-4 py-3 text-sm font-semibold"
              style={{ borderColor: 'var(--ink-200)', color: 'var(--text-primary)' }}>
              Cancel
            </button>
          )}

          <button onClick={next} disabled={!answered}
            className="flex flex-1 items-center justify-center gap-2 rounded-[10px] py-3 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            {step.optional && !((survey[step.key] || '').toString().trim()) ? 'Skip' : 'Continue'}
            <ChevronRight size={15} />
          </button>
        </div>

        {index > 0 && (
          <button onClick={() => go(STEPS.length, 'fwd')}
            className="mt-2.5 block w-full text-center text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}>
            Skip the rest and build my plan
          </button>
        )}
      </div>
    </div>
  );
}
// ── Contact archetype card ─────────────────────────────────────────────────────
function ArchetypeCard({ archetype }) {
  return (
    <div className="rounded-[16px] border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <User size={14} style={{ color: 'var(--brand-navy-900)' }} />
        <p className="text-sm font-bold text-[color:var(--surface-dark-900)]">{archetype.title}</p>
      </div>
      <p className="text-xs text-[color:var(--ink-700)] mb-2">{archetype.why_useful}</p>
      <div className="flex flex-wrap gap-1.5">
        {archetype.where_to_find?.map((w, i) => (
          <span key={i} className="rounded-full border border-[color:var(--ink-200)] px-2 py-0.5 text-[10px] text-[color:var(--ink-500)]">{w}</span>
        ))}
      </div>
    </div>
  );
}

// ── Outreach experiment card ───────────────────────────────────────────────────
function OutreachExperimentCard({ exp }) {
  return (
    <div className="rounded-[16px] border border-[color:var(--ink-200)] bg-white p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Beaker size={14} style={{ color: 'var(--brand-navy-900)' }} />
        <p className="text-sm font-bold text-[color:var(--surface-dark-900)]">{exp.title}</p>
      </div>
      <p className="text-xs text-[color:var(--ink-700)]">{exp.objective}</p>
      <div className="grid grid-cols-2 gap-2 text-xs text-[color:var(--ink-500)]">
        {exp.target_contact_type && <span><span className="font-semibold">Target:</span> {exp.target_contact_type}</span>}
        {exp.suggested_contacts && <span><span className="font-semibold">Contacts:</span> {exp.suggested_contacts}</span>}
        {exp.timeline && <span><span className="font-semibold">Timeline:</span> {exp.timeline}</span>}
        {exp.deliverable && <span><span className="font-semibold">Deliverable:</span> {exp.deliverable}</span>}
      </div>
      {exp.why_it_tests_path && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>
          <span className="font-semibold">Why it tests this path:</span> {exp.why_it_tests_path}
        </p>
      )}
    </div>
  );
}

// ── Outreach message template ──────────────────────────────────────────────────
function MessageTemplate({ template }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(template.body).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-[16px] border border-[color:var(--ink-200)] bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)]">{template.label}</p>
        <button onClick={copy} className="text-xs font-semibold transition" style={{ color: 'var(--brand-navy-900)' }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="text-xs text-[color:var(--ink-700)] whitespace-pre-wrap font-body leading-5 max-h-40 overflow-y-auto">{template.body}</pre>
    </div>
  );
}

// ── Safe LinkedIn search URL (never a guessed direct profile) ─────────────────
function linkedInSearchUrl(name, organization, role) {
  const parts = [name, organization, role].filter(Boolean).join(' ');
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(parts)}`;
}

// Detect if a URL is a direct LinkedIn profile (linkedin.com/in/...) — these must never come from AI
function isLinkedInProfileUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.includes('linkedin.com') && u.pathname.startsWith('/in/');
  } catch { return false; }
}

// ── Public contact suggestion card ────────────────────────────────────────────
function ContactSuggestionCard({ suggestion, pathName, experimentId, onSaved, onMissionCreated, dismissed, onDismiss, experiments }) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [missionLoading, setMissionLoading] = useState(false);
  const [missionError, setMissionError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleCreateMission = async () => {
    setMissionError('');
    setMissionLoading(true);
    try {
      const user = await base44.auth.me();
      // Find or create a linked experiment
      let expId = experimentId;
      if (!expId) {
        const linkedExp = experiments.find(e => e.path_name === pathName);
        expId = linkedExp?.id;
      }
      if (!expId) {
        setMissionLoading(false);
        return;
      }
      await base44.entities.Missions.create({
        user_id: user.id,
        experiment_id: expId,
        path_name: pathName,
        title: `Outreach: ${suggestion.name || suggestion.archetype_title}`,
        objective: `Complete informational outreach to ${suggestion.name || suggestion.archetype_title}`,
        description: `Steps to reach out to ${suggestion.name || suggestion.archetype_title} for insights on ${pathName}.`,
        status: 'planned',
        estimated_hours: 1,
        proof_required: 'Notes from the conversation saved to Outreach Tracker.',
      });
      onMissionCreated?.();
    } catch (e) {
      // Without this the button just stopped spinning and the count never
      // moved, which reads as the click having done nothing.
      console.error(`[outreach] mission create failed (${e?.name || 'error'})`);
      setMissionError('We could not create that mission. Try again.');
    } finally {
      setMissionLoading(false);
    }
  };

  if (dismissed) return null;

  const isArchetype = !suggestion.name;

  return (
    <>
      {showSaveModal && (
        <SaveContactConfirmModal
          suggestion={suggestion}
          pathName={pathName}
          experimentId={experimentId}
          experiments={experiments}
          onClose={() => setShowSaveModal(false)}
          onSaved={(contact) => { setShowSaveModal(false); setSaved(true); onSaved?.(contact); }}
        />
      )}
      <div className={`rounded-[16px] border p-4 space-y-3 transition ${saved ? 'border-green-200 bg-green-50' : 'border-[color:var(--ink-200)] bg-white'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isArchetype ? (
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}>Archetype</span>
                <p className="text-sm font-bold text-[color:var(--surface-dark-900)]">{suggestion.archetype_title}</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--info-50)', color: 'var(--info-700)' }}>Suggested Contact</span>
                  <p className="text-sm font-bold text-[color:var(--surface-dark-900)]">{suggestion.name}</p>
                </div>
                <p className="text-xs text-[color:var(--ink-700)]">{suggestion.role}{suggestion.role && suggestion.organization ? ' · ' : ''}{suggestion.organization}</p>
              </div>
            )}
            <p className="text-xs text-[color:var(--ink-500)] mt-1">{suggestion.why_relevant}</p>
            {!isArchetype && (
              <>
                {/* Never link directly to a LinkedIn profile URL from AI — always use verified search */}
                <a
                  href={linkedInSearchUrl(suggestion.name, suggestion.organization, suggestion.role)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold hover:underline"
                  style={{ color: 'var(--brand-navy-700)' }}>
                  <ExternalLink size={10} /> Search on LinkedIn
                </a>
                <p className="text-[10px] text-[color:var(--ink-400)] mt-0.5">
                  Direct profile not verified. Review search results and confirm this person's company and role before reaching out.
                </p>
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-600">
                  <AlertTriangle size={10} />
                  <span>Verify identity independently. Role and company may have changed.</span>
                </div>
              </>
            )}
          </div>
          <button onClick={onDismiss} aria-label="Dismiss suggestion"
            className="shrink-0 rounded-lg p-1 text-[color:var(--ink-300)] hover:text-[color:var(--ink-400)] transition">
            <X size={14} />
          </button>
        </div>

        {saved ? (
          <div className="flex items-center gap-2 text-xs text-green-700 font-semibold">
            <CheckCircle size={13} /> Saved to Outreach
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition"
              style={{ background: 'var(--brand-navy-900)' }}>
              <Save size={11} /> Save to Outreach
            </button>
            <button onClick={handleCreateMission} disabled={missionLoading}
              className="flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] disabled:opacity-60 transition">
              {missionLoading ? <Loader2 size={11} className="animate-spin" /> : <Target size={11} />}
              Create Mission
            </button>
          </div>
        )}
        {missionError && (
          <p className="mt-2 text-xs" style={{ color: 'var(--warning-700)' }}>{missionError}</p>
        )}
      </div>
    </>
  );
}

// ── Save Contact Confirm Modal ─────────────────────────────────────────────────
function SaveContactConfirmModal({ suggestion, pathName, experimentId, experiments, onClose, onSaved }) {
  const isArchetype = !suggestion.name;
  const linkedExp = experimentId
    ? experiments.find(e => e.id === experimentId)
    : experiments.find(e => e.path_name === pathName);

  // Never pre-fill profile_url from AI-generated source_url — could be a fabricated LinkedIn link
  const placeholders = new Set(['n/a', 'na', 'unknown', 'tbd', '']);
  const cleanName = (v) => {
    const s = (v || '').trim();
    return placeholders.has(s.toLowerCase()) ? '' : s;
  };

  const [form, setForm] = useState({
    name: cleanName(suggestion.name),
    company: suggestion.organization || '',
    role: suggestion.role || '',
    profile_url: '',
    reason_for_contact: suggestion.why_relevant || '',
    notes: suggestion.context || '',
    response_status: 'planning',
    contact_type: 'informational_interview',
  });
  const [saving, setSaving] = useState(false);

  const ch = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const contact = await base44.entities.OutreachContacts.create({
        user_id: user.id,
        name: form.name,
        company: form.company,
        role: form.role,
        profile_url: form.profile_url,
        reason_for_contact: form.reason_for_contact,
        notes: form.notes,
        response_status: form.response_status,
        contact_type: form.contact_type,
        path_being_tested: pathName,
        experiment_id: linkedExp?.id || undefined,
      });
      onSaved(contact);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.6)' }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-bold text-[color:var(--surface-dark-900)]">Save to Outreach</h3>
          <button onClick={onClose}><X size={18} className="text-[color:var(--ink-500)]" /></button>
        </div>

        {isArchetype && (
          <div className="mb-4 rounded-xl p-3" style={{ background: 'var(--warning-50)', border: '1px solid rgba(180,83,9,0.2)' }}>
            <p className="text-xs text-[color:var(--warning-700)] font-semibold">This is an archetype template. Fill in the actual contact details below before saving.</p>
          </div>
        )}

        <div className="space-y-3">
          {[
            { name: 'name', label: 'Full name', placeholder: 'Contact name', required: true },
            { name: 'company', label: 'Company', placeholder: 'Organization' },
            { name: 'role', label: 'Role / Title', placeholder: 'e.g. Analyst, Founder' },
            { name: 'profile_url', label: 'LinkedIn or public profile URL', placeholder: 'https://...' },
          ].map(f => (
            <label key={f.name} className="block">
              <span className="text-xs font-semibold text-[color:var(--ink-700)] block mb-1">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
              <input name={f.name} value={form[f.name]} onChange={ch} placeholder={f.placeholder} className={inputCls} />
            </label>
          ))}
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--ink-700)] block mb-1">Reason for outreach</span>
            <textarea name="reason_for_contact" rows={2} value={form.reason_for_contact} onChange={ch} className={inputCls} />
          </label>
          <div className="rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3 text-xs">
            <p className="font-semibold text-[color:var(--ink-500)] mb-0.5">Path</p>
            <p className="text-[color:var(--surface-dark-900)] font-bold">{pathName}</p>
            {linkedExp && <>
              <p className="font-semibold text-[color:var(--ink-500)] mt-2 mb-0.5">Linked experiment</p>
              <p className="text-[color:var(--ink-700)]">{linkedExp.title}</p>
            </>}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-3 text-sm font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-[10px] py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--brand-navy-900)' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {saving ? 'Saving…' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Coerce a generated outreach plan into the shape the results tabs render.
 *
 * This is the highest-stakes text in the product: the templates are pasted into
 * messages students send to real professionals, and the suggestions name real
 * people. Nothing here is written to an entity by this function, so the job is
 * to make every field a safe type and to drop items too empty to act on, rather
 * than to reject the plan wholesale.
 *
 * Items with no title and no body are dropped rather than rendered as a card
 * with a Copy button that copies nothing.
 */
function repairOutreachPlan(raw) {
  if (!isPlainObject(raw)) return null;
  const list = (value) => (Array.isArray(value) ? value.filter(isPlainObject) : []);

  return {
    outreach_experiments: list(raw.outreach_experiments).map(e => ({
      title: toText(e.title),
      objective: toText(e.objective),
      why_it_tests_path: toText(e.why_it_tests_path),
      target_contact_type: toText(e.target_contact_type),
      suggested_contacts: toText(e.suggested_contacts),
      timeline: toText(e.timeline),
      deliverable: toText(e.deliverable),
      reflection_question: toText(e.reflection_question),
    })).filter(e => e.title),

    contact_archetypes: list(raw.contact_archetypes).map(a => ({
      title: toText(a.title),
      why_useful: toText(a.why_useful),
      where_to_find: toTextList(a.where_to_find),
    })).filter(a => a.title),

    contact_suggestions: list(raw.contact_suggestions).map(c => ({
      is_archetype: c.is_archetype === true,
      archetype_title: toText(c.archetype_title),
      name: toText(c.name),
      role: toText(c.role),
      organization: toText(c.organization),
      why_relevant: toText(c.why_relevant),
      source_url: toText(c.source_url),
      verified_date: toText(c.verified_date),
      context: toText(c.context),
    })).filter(c => c.name || c.archetype_title),

    message_templates: list(raw.message_templates).map(t => ({
      label: toText(t.label),
      body: toText(t.body),
    })).filter(t => t.body),
  };
}

// ── Results Step ───────────────────────────────────────────────────────────────
function ResultsStep({ plan, pathName, experimentId, experiments, onContactSaved, onClose }) {
  const [dismissed, setDismissed] = useState(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const [missionCount, setMissionCount] = useState(0);
  const [activeTab, setActiveTab] = useState(() => {
    const first = ['experiments', 'archetypes', 'suggestions', 'templates']
      .find(id => ({
        experiments: plan.outreach_experiments,
        archetypes: plan.contact_archetypes,
        suggestions: plan.contact_suggestions,
        templates: plan.message_templates,
      })[id]?.length);
    return first || 'experiments';
  });

  // Every tab stays, including empty ones. Filtering them out meant a section
  // the model skipped simply vanished, and the student had no way to know it
  // was supposed to be there or that trying again would produce it.
  const tabs = [
    { id: 'experiments', label: 'Outreach Experiments', icon: Beaker, count: plan.outreach_experiments.length },
    { id: 'archetypes', label: 'Contact Archetypes', icon: Users, count: plan.contact_archetypes.length },
    { id: 'suggestions', label: 'Suggested Contacts', icon: User, count: plan.contact_suggestions.length },
    { id: 'templates', label: 'Message Templates', icon: BookOpen, count: plan.message_templates.length },
  ];

  const activeCount = tabs.find(t => t.id === activeTab)?.count ?? 0;

  return (
    <div className="space-y-4">
      {savedCount > 0 && (
        <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-green-700" style={{ background: 'var(--success-50)', border: '1px solid #BBF7D0' }}>
          <CheckCircle size={13} /> {savedCount} contact{savedCount !== 1 ? 's' : ''} saved to Outreach
          {missionCount > 0 && ` · ${missionCount} mission${missionCount !== 1 ? 's' : ''} created`}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition border"
            style={activeTab === t.id
              ? { background: 'var(--brand-navy-900)', color: '#fff', borderColor: 'var(--brand-navy-900)' }
              : { background: 'white', color: 'var(--ink-700)', borderColor: 'var(--ink-200)' }}>
            <t.icon size={11} /> {t.label}
            <span className="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px]"
              style={activeTab === t.id ? { background: 'rgba(255,255,255,0.25)' } : { background: 'var(--ink-100)', color: 'var(--ink-500)' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
        {activeCount === 0 && (
          <p className="rounded-xl px-4 py-3 text-xs text-[color:var(--ink-500)]"
            style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)' }}>
            This section came back empty. Close the plan and build it again to fill it in.
          </p>
        )}

        {activeTab === 'experiments' && plan.outreach_experiments?.map((exp, i) => (
          <OutreachExperimentCard key={i} exp={exp} />
        ))}

        {activeTab === 'archetypes' && plan.contact_archetypes?.map((a, i) => (
          <ArchetypeCard key={i} archetype={a} />
        ))}

        {activeTab === 'suggestions' && plan.contact_suggestions?.map((s, i) => (
          <ContactSuggestionCard
            key={i}
            suggestion={s}
            pathName={pathName}
            experimentId={experimentId}
            experiments={experiments}
            dismissed={dismissed.has(i)}
            onDismiss={() => setDismissed(prev => new Set([...prev, i]))}
            onSaved={(contact) => { setSavedCount(c => c + 1); onContactSaved?.(contact); }}
            onMissionCreated={() => setMissionCount(c => c + 1)}
          />
        ))}

        {activeTab === 'templates' && plan.message_templates?.map((t, i) => (
          <MessageTemplate key={i} template={t} />
        ))}
      </div>

      <button onClick={onClose}
        className="w-full rounded-[10px] border border-[color:var(--ink-200)] py-3 text-sm font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
        Done
      </button>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function OutreachPlanModal({ path, experiment, onClose, onContactSaved }) {
  const [step, setStep] = useState('survey'); // survey | generating | results
  const [survey, setSurvey] = useState(DEFAULT_SURVEY);
  const [surveyIndex, setSurveyIndex] = useState(0);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [experiments, setExperiments] = useState([]);
  const generatingRef = useRef(false);

  // Load experiments for linking
  useState(() => {
    base44.entities.Experiments.list('-created_date', 200).catch(() => []).then(exps => {
      setExperiments(Array.isArray(exps) ? exps : []);
    });
  });

  const generate = async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setStep('generating');
    setError('');

    const wantPublicProfiles = survey.suggestion_type === 'both';

    try {
      // Produces message templates the student sends to real professionals and
      // names real people — the site least tolerant of a weaker model. Highest
      // quality tier; see src/lib/llm.js.
      const result = unwrapLLM(await base44.integrations.Core.InvokeLLM({
        model: 'gemini_3_1_pro',
        prompt: `You are an expert career coach helping a college student build a targeted outreach plan for the career path: "${path.path_name}".

Student's context:
- What they want to learn: ${composeWhatToLearn(survey)}
- Conversation type: ${survey.conversation_type}
- Industry/subsector focus: ${survey.industries || 'any'}
- Company size preference: ${survey.company_size}
- Geography preference: ${survey.geography || 'any'}
- Seniority preference: ${survey.seniority}
- Alumni preference: ${survey.alumni_preference}
- Time per conversation: ${survey.time_available} minutes
- Networking comfort: ${survey.networking_comfort}
- Preferred channel: ${survey.preferred_channel}

Generate a complete outreach plan with:

1. outreach_experiments: 3-5 practical outreach experiments the student can do (NOT general career experiments; these must be outreach-specific). Examples: "Interview 3 professionals at different seniority levels", "Attend one industry event and collect 2 contacts", "Interview an alumnus in this field", "Shadow a professional for one day". Each must include: title, objective, why_it_tests_path, target_contact_type, suggested_contacts (number), timeline, deliverable, reflection_question.

2. contact_archetypes: 4-6 role archetypes most useful for this path. Each must include: title (specific job title like "Investment Banking Analyst"), why_useful (concrete 1-2 sentence explanation), where_to_find (array of 2-3 platforms or methods like ["LinkedIn", "Alumni network", "On-campus recruiting"]).

3. contact_suggestions: ${wantPublicProfiles
  ? `3-5 well-known professionals relevant to "${path.path_name}". CRITICAL RULES: (a) Only include people you are highly confident about based on their public professional reputation (b) Do NOT include any LinkedIn URLs or profile links; these will be generated safely as search queries by the app (c) Include the specific organization they are known to work at (d) Do NOT invent email addresses or phone numbers (e) If you are not highly confident about the person's current role, use an archetype instead (f) Set is_archetype: false. Each must have: name, role, organization, why_relevant, context.`
  : `3-5 useful contact ARCHETYPES formatted as contact suggestions (not real people). Each must have: archetype_title, why_relevant, context. Set is_archetype: true. Do NOT include real people's names.`
}

4. message_templates: 3 outreach message templates tailored to "${path.path_name}" and the preferred channel (${survey.preferred_channel}). Match the student's networking comfort level (${survey.networking_comfort}). Each must include: label (e.g. "Cold LinkedIn message"), body (complete editable template using [Name], [Your Name], [School] placeholders).

Return only valid JSON. Do not add commentary outside the JSON.
${PLAIN_PROSE_RULES}`,
        response_json_schema: {
          type: 'object',
          properties: {
            outreach_experiments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  objective: { type: 'string' },
                  why_it_tests_path: { type: 'string' },
                  target_contact_type: { type: 'string' },
                  suggested_contacts: { type: 'string' },
                  timeline: { type: 'string' },
                  deliverable: { type: 'string' },
                  reflection_question: { type: 'string' },
                }
              }
            },
            contact_archetypes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  why_useful: { type: 'string' },
                  where_to_find: { type: 'array', items: { type: 'string' } },
                }
              }
            },
            contact_suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  is_archetype: { type: 'boolean' },
                  archetype_title: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  organization: { type: 'string' },
                  why_relevant: { type: 'string' },
                  source_url: { type: 'string' },
                  verified_date: { type: 'string' },
                  context: { type: 'string' },
                }
              }
            },
            message_templates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  body: { type: 'string' },
                }
              }
            },
          }
        }
      }));

      const repaired = repairOutreachPlan(result);
      const total = repaired
        ? repaired.outreach_experiments.length + repaired.contact_archetypes.length
          + repaired.contact_suggestions.length + repaired.message_templates.length
        : 0;

      if (!total) {
        console.error('[outreach] rejected: empty plan');
        setError('That plan came back empty. Try building it again.');
        setStep('survey');
        return;
      }

      setPlan(repaired);
      setStep('results');
    } catch (e) {
      // The prompt carries the student's own survey answers, so log shape only.
      console.error(`[outreach] plan generation failed (${e?.name || 'error'})`);
      setError('That didn’t go through. Try building the plan again.');
      setStep('survey');
    } finally {
      generatingRef.current = false;
    }
  };

  const isSurvey = step === 'survey';

  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      <div
        data-modal-scroll
        className={`anim-modal w-full max-h-[94vh] overflow-y-auto rounded-[24px] bg-white ${
          isSurvey ? 'max-w-xl px-6 pb-0 pt-6 sm:px-8 sm:pt-8' : 'max-w-2xl p-6 sm:p-8'
        }`}
        style={{ boxShadow: '0 30px 80px rgba(5,8,22,0.28)' }}
      >
        {!isSurvey && (
          <>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold text-[color:var(--surface-dark-900)]">
                {step === 'generating' ? 'Building your outreach plan…' : 'Your Outreach Plan'}
              </h2>
              {step !== 'generating' && (
                <button onClick={onClose} aria-label="Close"><X size={20} className="text-[color:var(--ink-500)]" /></button>
              )}
            </div>
            {step !== 'generating' && (
              <p className="mb-5 text-sm text-[color:var(--ink-500)]">Tailored outreach strategy for {path.path_name}.</p>
            )}
          </>
        )}

        {isSurvey && (
          <SurveyStep
            pathName={path.path_name}
            survey={survey}
            setSurvey={setSurvey}
            index={surveyIndex}
            setIndex={setSurveyIndex}
            onGenerate={generate}
            onClose={onClose}
            error={error}
          />
        )}

        {step === 'generating' && (
          <div className="py-16 flex flex-col items-center gap-4 text-center">
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--brand-navy-900)' }} />
            <p className="font-heading text-lg font-bold text-[color:var(--surface-dark-900)]">Generating your personalized outreach plan…</p>
            <p className="text-sm text-[color:var(--ink-500)] max-w-sm">
              Building outreach experiments, contact archetypes, and message templates tailored to {path.path_name}.
            </p>
          </div>
        )}

        {step === 'results' && plan && (
          <ResultsStep
            plan={plan}
            pathName={path.path_name}
            experimentId={experiment?.id}
            experiments={experiments}
            onContactSaved={onContactSaved}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}