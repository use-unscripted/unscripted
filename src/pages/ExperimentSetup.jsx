import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { toText, toTextList, STEP_TEXT_KEYS } from '@/lib/ai-validation';
import { generateValidated } from '@/lib/ai-generate';
import { reportAiFailure } from '@/lib/ai-failures';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';
import { Sk, SkCards } from '@/components/PageSkeleton';
import ExperimentDesignOption from '@/components/experiments/ExperimentDesignOption';
import UncertaintyPicker from '@/components/experiments/UncertaintyPicker';
import BiggestUnknownCard from '@/components/experiments/BiggestUnknownCard';
import OtherTestOptions from '@/components/experiments/OtherTestOptions';
import { testBrief, evidenceRequirementFallback } from '@/lib/experiment-types';
import { designExperiments } from '@/lib/experiment-design';
import { deriveHypothesis } from '@/lib/career-hypothesis';
import {
  ensureActiveCycle, assertNoActiveExperiment, attachExperimentToCycle,
  ActiveExperimentError, cycleLinks, getActiveCycle,
} from '@/lib/career-cycle';
import { resolveCurrentPath } from '@/lib/current-path';

/**
 * Repair a generated Mission Guide into the shape the experiment record and the
 * three screens that read it actually expect.
 *
 * The schema asks for `mission_steps` as an array of strings. When the model
 * returns objects instead, the old code wrapped each one as `{ step: <object> }`
 * and saved it, and both the experiment list and the success screen the student
 * is looking at render `step.step` directly. React refuses an object as a child,
 * so that threw and unmounted the page. Steps are coerced to strings here, at
 * the one place they are written.
 *
 * Returns `{ guide, usable }`. `usable` is false when nothing survived that a
 * student could act on, which is the signal not to stamp the experiment as
 * having a guide.
 */
export function repairMissionGuide(raw) {
  const steps = toTextList(raw?.mission_steps, { splitLines: true });
  return {
    guide: {
      mission_objective: toText(raw?.mission_objective),
      why_this_helps: toText(raw?.why_this_helps),
      expected_learning: toText(raw?.expected_learning),
      mission_steps: steps,
      tools: toTextList(raw?.tools),
      proof_required: toText(raw?.proof_required),
      reflection_questions: toTextList(raw?.reflection_questions),
      common_mistakes: toTextList(raw?.common_mistakes),
      completion_criteria: toText(raw?.completion_criteria),
      next_step: toText(raw?.next_step),
    },
    // A guide with no steps is not a guide. Everything else can be thin without
    // making the mission impossible to start.
    usable: steps.length > 0,
  };
}

/**
 * The retry loop's view of the same repair: a guide with no steps is rejected
 * with a reason the model can act on, rather than becoming a dead experiment.
 */
export function validateMissionGuide(raw) {
  const { guide, usable } = repairMissionGuide(raw);
  if (usable) return { ok: true, data: guide, errors: [], codes: [] };
  return {
    ok: false,
    data: null,
    errors: ['You returned no usable mission steps. "mission_steps" must be an array of 8 to 12 plain strings, each one an action the student can actually do.'],
    codes: ['guide_no_steps'],
  };
}

// Generate 3 path-specific experiment options based on path name
function getExperimentOptions(pathName) {
  const name = (pathName || '').toLowerCase();

  if (name.includes('investment banking') || name.includes('ib')) {
    return [
      { type: 'Interview a professional', title: 'Interview an investment banking analyst', objective: 'Understand daily work, recruiting, and lifestyle from someone currently in the role', deliverable: 'Written notes on 10+ questions answered about deal process, hours, and career trajectory', estimated_hours: 4 },
      { type: 'Complete a virtual simulation', title: 'Complete a virtual IB deal simulation', objective: 'Experience the analytical work of investment banking in a low-stakes environment', deliverable: 'Completed simulation certificate or summary of key takeaways', estimated_hours: 8 },
      { type: 'Build a portfolio sample', title: 'Build a basic company valuation or deal case study', objective: 'Demonstrate analytical capability and understand what IB work actually involves', deliverable: 'A simple DCF model or M&A case study memo (2-4 pages)', estimated_hours: 10 },
    ];
  }

  if (name.includes('startup') || name.includes('operator') || name.includes('operations')) {
    return [
      { type: 'Interview a professional', title: 'Interview a startup operator or early-stage founder', objective: 'Understand what operating inside an early-stage company actually looks like day to day', deliverable: 'Notes on role, challenges, what they wish they knew, and advice for breaking in', estimated_hours: 3 },
      { type: 'Complete a virtual simulation', title: 'Complete a startup operating problem case study', objective: 'Test your ability to think through real operational problems under constraints', deliverable: 'Written analysis of a startup operations case (growth, process, or team problem)', estimated_hours: 6 },
      { type: 'Build a portfolio sample', title: 'Build a short market or growth analysis project', objective: 'Produce tangible proof that you can do the analytical and strategic work of an operator', deliverable: 'A 1-2 page market sizing or growth strategy memo for a startup of your choosing', estimated_hours: 8 },
    ];
  }

  if (name.includes('personal brand') || name.includes('creator') || name.includes('content')) {
    return [
      { type: 'Interview a professional', title: 'Interview a creator in your target niche', objective: 'Understand what the day-to-day reality of building a personal brand looks like', deliverable: 'Notes on how they built their audience, content cadence, monetization, and mindset', estimated_hours: 3 },
      { type: 'Publish content', title: 'Publish three structured pieces of content', objective: 'Test your ability to create content consistently and observe how it performs', deliverable: 'Three published posts (LinkedIn, Twitter, Substack, or similar) with engagement data', estimated_hours: 6 },
      { type: 'Build a portfolio sample', title: 'Build a 30-day personal brand content plan', objective: 'Create a tangible strategy that shows you understand audience building', deliverable: 'A documented 30-day content calendar with themes, formats, and distribution plan', estimated_hours: 5 },
    ];
  }

  if (name.includes('healthcare') || name.includes('health admin') || name.includes('hospital')) {
    return [
      { type: 'Interview a professional', title: 'Interview a healthcare administrator or nonclinical operator', objective: 'Understand what working in healthcare operations or administration actually involves', deliverable: 'Notes on career path, daily work, how to break in without a clinical background', estimated_hours: 3 },
      { type: 'Complete a virtual simulation', title: 'Map a nonclinical operational workflow at a hospital or clinic', objective: 'Understand how healthcare organizations run operationally behind the scenes', deliverable: 'A simple process map or written analysis of a healthcare workflow (billing, scheduling, staffing)', estimated_hours: 5 },
      { type: 'Build a portfolio sample', title: 'Complete a healthcare operations case study', objective: 'Demonstrate analytical ability applied to a healthcare-specific problem', deliverable: 'A 2-page case analysis of a healthcare efficiency or policy challenge', estimated_hours: 8 },
    ];
  }

  if (name.includes('entrepreneur') || name.includes('founder') || name.includes('business owner')) {
    return [
      { type: 'Interview a professional', title: 'Interview five potential customers for a business idea', objective: 'Test whether a real problem exists before building anything', deliverable: 'Notes from 5 conversations validating or invalidating your core hypothesis', estimated_hours: 5 },
      { type: 'Build a small project', title: 'Build a simple prototype or landing page', objective: 'Create something tangible to test market interest with zero or minimal spending', deliverable: 'A live landing page or working prototype with at least 10 visitors or sign-ups', estimated_hours: 8 },
      { type: 'Test a freelance service', title: 'Test a narrowly defined service idea with a real client', objective: 'Complete one paid or volunteer engagement to test your ability to deliver value', deliverable: 'One completed project with written client feedback or testimonial', estimated_hours: 10 },
    ];
  }

  if (name.includes('consulting') || name.includes('management consulting') || name.includes('mckinsey') || name.includes('bain') || name.includes('bcg')) {
    return [
      { type: 'Interview a professional', title: 'Interview a management consulting analyst or associate', objective: 'Understand the recruiting process, case interview expectations, and daily work', deliverable: 'Notes on career path, how to prepare, and honest assessment of lifestyle fit', estimated_hours: 3 },
      { type: 'Complete a virtual simulation', title: 'Complete a practice case interview with a peer or coach', objective: 'Test your case-solving ability under real interview-like conditions', deliverable: 'Completed case with written self-assessment or coach feedback', estimated_hours: 6 },
      { type: 'Build a portfolio sample', title: 'Build a structured recommendation memo on a business problem', objective: 'Demonstrate you can structure problems and communicate recommendations clearly', deliverable: 'A 2-page structured memo with situation, complication, and recommendation', estimated_hours: 6 },
    ];
  }

  if (name.includes('law') || name.includes('legal')) {
    return [
      { type: 'Interview a professional', title: 'Interview a law student, attorney, or legal professional', objective: 'Understand the reality of law school, legal work, and career options beyond being a litigator', deliverable: 'Notes on day-to-day work, lifestyle, debt, recruiting, and their honest advice', estimated_hours: 3 },
      { type: 'Complete a virtual simulation', title: 'Complete a legal writing or moot court simulation', objective: 'Test your interest in legal reasoning and written argument', deliverable: 'A completed brief, memo, or simulation participation certificate', estimated_hours: 6 },
      { type: 'Build a portfolio sample', title: 'Write a legal analysis memo on a real case or policy question', objective: 'Produce tangible proof of your ability to research and argue a legal position', deliverable: 'A 2-3 page structured legal memo', estimated_hours: 7 },
    ];
  }

  if (name.includes('medicine') || name.includes('medical') || name.includes('doctor') || name.includes('physician')) {
    return [
      { type: 'Interview a professional', title: 'Interview a medical student, resident, or attending physician', objective: 'Get an honest picture of medical training, lifestyle, debt, and career options', deliverable: 'Notes on their path, what they would do differently, and advice for pre-meds', estimated_hours: 3 },
      { type: 'Complete a virtual simulation', title: 'Complete a clinical shadowing or virtual patient simulation', objective: 'Observe or simulate the clinical decision-making process', deliverable: 'Reflection on 5+ hours of shadowing or simulation with key takeaways', estimated_hours: 8 },
      { type: 'Build a portfolio sample', title: 'Complete a structured research literature review in a medical area', objective: 'Build a research habit and test your comfort with medical evidence', deliverable: 'A 2-page summary of findings from 5+ peer-reviewed sources', estimated_hours: 8 },
    ];
  }

  // Generic fallback
  return [
    { type: 'Interview a professional', title: `Interview someone working in ${pathName}`, objective: `Understand the day-to-day reality of a career in ${pathName} from someone currently doing the work`, deliverable: 'Notes from the conversation covering daily work, lifestyle, income, and how to break in', estimated_hours: 3 },
    { type: 'Complete a virtual simulation', title: `Complete a simulation or case study related to ${pathName}`, objective: `Experience the core work of ${pathName} in a controlled, low-risk environment`, deliverable: 'Completed deliverable with written reflection on what you learned', estimated_hours: 6 },
    { type: 'Build a portfolio sample', title: `Build a tangible proof-of-work sample for ${pathName}`, objective: `Produce something concrete that demonstrates your capability and interest in ${pathName}`, deliverable: 'A document, project, or portfolio piece you could show to someone in the field', estimated_hours: 8 },
  ];
}

// The rail. "What to Test" is first because the uncertainty a student picks is
// what every design that follows is built to answer.
const STEPS = ['What to Test', 'Select Experiment', 'Confirm Details', 'Build Experiment', 'Experiment Created'];

// ─── Step 1: Path context + experiment picker ────────────────────────────────
function StepPick({ rec, options, selected, onSelect, onCustom, onNext, designing, focus, onChangeFocus, brief, onTestRecommended }) {
  const [showOptions, setShowOptions] = useState(false);
  return (
    <div className="space-y-6">
      {/* Path context card */}
      <div className="rounded-[var(--r-surface)] p-5 space-y-3" style={{ background: 'var(--surface-dark-700)', color: 'white' }}>
        <p className="tp-eyebrow opacity-60">Testing Path</p>
        <h2 className="tp-page">{rec.path_name}</h2>
        {rec.fit_reason && (
          <div>
            <p className="tp-eyebrow opacity-60 mb-1">Why it was recommended</p>
            <p className="tp-prose opacity-80">{rec.fit_reason}</p>
          </div>
        )}
        {rec.current_gaps?.length > 0 && (
          <div>
            <p className="tp-eyebrow opacity-60 mb-1">Your current gaps</p>
            <div className="flex flex-wrap gap-2">
              {rec.current_gaps.map((g, i) => (
                <span key={i} className="tp-meta rounded-full px-2.5 py-1" style={{ background: 'rgba(255,255,255,0.1)' }}>{g}</span>
              ))}
            </div>
          </div>
        )}
        {rec.first_experiment && (
          <div>
            <p className="tp-eyebrow opacity-60 mb-1">Suggested first experiment</p>
            <p className="tp-body opacity-80">{rec.first_experiment}</p>
          </div>
        )}
      </div>

      {/* What the student chose to test, and a way back to change it */}
      {focus && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-surface)] border p-4"
          style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}>
          <div>
            <p className="tp-eyebrow mb-1" style={{ color: 'var(--ink-500)' }}>You are testing</p>
            <p className="tp-body font-semibold text-[color:var(--surface-dark-900)]">{focus.label}</p>
            <p className="tp-meta mt-0.5" style={{ color: 'var(--ink-500)' }}>{focus.question}</p>
          </div>
          <button onClick={onChangeFocus} className="tp-meta font-bold" style={{ color: 'var(--brand-navy-700)' }}>
            Change
          </button>
        </div>
      )}

      {/* Selection, framed as the uncertainty rather than the career. */}
      <BiggestUnknownCard brief={brief} onTest={onTestRecommended} busy={designing} />

      {/* The default: a few minutes of the actual work. The long simulations
          below stay available as Deep Dives. */}
      <Link to={`/moment?recId=${rec.id || ''}&variable=${encodeURIComponent(focus?.variable || '')}`}
        className="block rounded-[var(--r-surface)] border p-5 transition hover:-translate-y-px"
        style={{ borderColor: 'var(--brand-navy-900)', background: 'white', boxShadow: '0 8px 24px rgba(31,58,95,0.12)' }}>
        <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-700)' }}>Recommended · about 4 minutes</p>
        <p className="tp-card mt-2 text-[color:var(--surface-dark-900)]">Try 4 minutes of {rec.path_name}</p>
        <p className="tp-body mt-1 text-[color:var(--ink-500)]">
One realistic decision, instant feedback, two quick questions.
        </p>
      </Link>

      {/* Experiment options, collapsed by default so the recommended test above
          is the only thing competing for the decision. */}
      <OtherTestOptions count={options.length} open={showOptions} onToggle={() => setShowOptions(o => !o)}>
        {designing && (
          <div className="mb-3 space-y-3">
            <div className="flex items-center gap-2 tp-body text-[color:var(--ink-500)]">
              <Loader2 size={15} className="animate-spin" /> Designing experiments to answer {focus ? focus.label.toLowerCase() : `this question about ${rec.path_name}`}…
            </div>
            <SkCards count={3} h={132} gap={12} r={16} />
          </div>
        )}
        <div className="space-y-3">
          {!designing && options.map((opt, i) => opt.realistic_scenario ? (
            <ExperimentDesignOption
              key={i}
              design={opt}
              selected={selected === i}
              onSelect={() => onSelect(opt)}
            />
          ) : (
            <button key={i} onClick={() => onSelect(opt)}
              className="w-full text-left rounded-[var(--r-surface)] border p-4 transition"
              style={selected === i
                ? { background: 'var(--ink-100)', borderColor: 'var(--brand-navy-900)' }
                : { background: 'white', borderColor: 'var(--ink-200)' }}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: selected === i ? 'var(--brand-navy-900)' : 'var(--ink-300)' }}>
                  {selected === i && <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--brand-navy-900)' }} />}
                </div>
                <div>
                  <p className="tp-eyebrow mb-1" style={{ color: 'var(--brand-navy-700)' }}>{opt.type}</p>
                  <p className="tp-card text-[color:var(--surface-dark-900)]">{opt.title}</p>
                  <p className="tp-body mt-1 text-[color:var(--ink-500)]">{opt.objective}</p>
                  <p className="tp-meta mt-1 text-[color:var(--ink-400)]">~{opt.estimated_hours}h · Deliverable: {opt.deliverable.substring(0, 60)}…</p>
                </div>
              </div>
            </button>
          ))}
          <button onClick={onCustom}
            className="tp-body w-full text-left rounded-[var(--r-surface)] border border-dashed p-4 font-semibold text-[color:var(--ink-500)] transition hover:border-[color:var(--brand-navy-700)] hover:text-[color:var(--brand-navy-700)]"
            style={{ background: 'white' }}>
            + Create a custom experiment
          </button>
        </div>
      </OtherTestOptions>

      {selected !== null && (
      <button onClick={onNext} disabled={selected === null}
        className="tp-body w-full flex items-center justify-center gap-2 rounded-[var(--r-control)] py-3.5 font-semibold text-white transition hover:-translate-y-px disabled:opacity-40"
        style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
        Confirm & Build My Experiment <ArrowRight size={16} />
      </button>
      )}
    </div>
  );
}

// ─── Step 2: Custom experiment form ─────────────────────────────────────────
function StepCustom({ pathName, data, onChange, onBack, onNext }) {
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="tp-body flex items-center gap-1 text-[color:var(--ink-500)] hover:text-[color:var(--surface-dark-900)]">
        <ArrowLeft size={15} /> Back to suggestions
      </button>
      <h3 className="tp-section text-[color:var(--surface-dark-900)]">Custom Experiment</h3>
      {[
        { name: 'title', label: 'Experiment title', placeholder: 'e.g. Shadow a product manager for a day' },
        { name: 'objective', label: 'What do you want to learn?', placeholder: 'What question are you trying to answer?' },
        { name: 'deliverable', label: 'Deliverable', placeholder: 'What will you produce or submit as proof?' },
      ].map(f => (
        <label key={f.name} className="block">
          <span className="tp-body font-semibold text-[color:var(--ink-700)] block mb-1">{f.label}</span>
          <input className="w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
            placeholder={f.placeholder} value={data[f.name] || ''} onChange={e => onChange(f.name, e.target.value)} />
        </label>
      ))}
      <label className="block">
        <span className="tp-body font-semibold text-[color:var(--ink-700)] block mb-1">Path being tested</span>
        <input className="w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--ink-100)] px-4 py-3 text-base md:text-sm outline-none text-[color:var(--ink-700)]"
          value={pathName} readOnly />
      </label>
      <label className="block">
        <span className="tp-body font-semibold text-[color:var(--ink-700)] block mb-1">Estimated hours</span>
        <input type="number" min="1" max="40" className="w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
          value={data.estimated_hours || 5} onChange={e => onChange('estimated_hours', Number(e.target.value))} />
      </label>
      <label className="block">
        <span className="tp-body font-semibold text-[color:var(--ink-700)] block mb-1">Deadline (optional)</span>
        <input type="date" className="w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
          value={data.deadline || ''} onChange={e => onChange('deadline', e.target.value)} />
      </label>
      <button onClick={onNext} disabled={!data.title || !data.objective}
        className="tp-body w-full flex items-center justify-center gap-2 rounded-[var(--r-control)] py-3.5 font-semibold text-white transition hover:-translate-y-px disabled:opacity-40"
        style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
        Build My Experiment <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ─── Step 3: Generating + Success ────────────────────────────────────────────
function StepGenerating({ experiment, missionGuide, error }) {
  if (error) {
    return (
      <div className="rounded-[var(--r-surface)] border border-red-200 bg-red-50 p-6 text-center space-y-3">
        <AlertCircle className="mx-auto text-red-500" size={32} />
        <p className="font-semibold text-red-700">We could not build your experiment</p>
        <p className="tp-body text-red-600">{error}</p>
        <p className="tp-meta text-red-500">Your experiment draft was saved. Return to My Experiments to retry.</p>
        <Link to="/experiments" className="tp-body inline-block mt-2 font-semibold" style={{ color: 'var(--brand-navy-900)' }}>Go to My Experiments →</Link>
      </div>
    );
  }

  if (!missionGuide) {
    return (
      <div className="py-16 text-center space-y-4">
        <Loader2 className="mx-auto animate-spin" size={36} style={{ color: 'var(--brand-navy-900)' }} />
        <p className="tp-section text-[color:var(--surface-dark-900)]">Building your experiment...</p>
        <p className="tp-body text-[color:var(--ink-500)]">Writing the step-by-step experiment specific to {experiment?.path_name} and your selected experiment.</p>
      </div>
    );
  }

  return null; // success handled by parent
}

// ─── Step 4: Success ─────────────────────────────────────────────────────────
function StepSuccess({ experiment, missionGuide, onViewGuide }) {
  // Rows written before guides were validated can hold steps as objects, and an
  // object handed to React as a child throws and blanks this screen.
  const firstStepText = toText(missionGuide?.mission_steps?.[0], STEP_TEXT_KEYS) || 'Start your first action';

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--r-surface)] text-center p-8 space-y-3" style={{ background: 'var(--success-50)', border: '1px solid #86EFAC' }}>
        <CheckCircle className="mx-auto text-green-600" size={40} />
        <h2 className="tp-page text-[color:var(--surface-dark-900)]">Experiment Created</h2>
        <div className="space-y-1">
          <p className="tp-body text-[color:var(--ink-700)]"><span className="font-semibold">You are testing:</span> {experiment.path_name}</p>
          <p className="tp-body text-[color:var(--ink-700)]"><span className="font-semibold">Your experiment:</span> {experiment.title}</p>
        </div>
      </div>

      <div className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-5">
        <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Your first action</p>
        <p className="tp-body font-semibold text-[color:var(--surface-dark-900)]">{firstStepText}</p>
      </div>

      {missionGuide?.mission_steps?.length > 0 && (
        <div className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-5">
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-3">Experiment Preview</p>
          <ol className="space-y-2">
            {missionGuide.mission_steps.slice(0, 5).map((s, i) => (
              <li key={i} className="tp-body flex gap-3 text-[color:var(--ink-700)]">
                <span className="shrink-0 font-bold" style={{ color: 'var(--brand-navy-900)' }}>{i + 1}.</span>
                <span>{toText(s, STEP_TEXT_KEYS)}</span>
              </li>
            ))}
            {missionGuide.mission_steps.length > 5 && (
              <li className="tp-meta text-[color:var(--ink-400)] pl-6">+ {missionGuide.mission_steps.length - 5} more steps in the full experiment</li>
            )}
          </ol>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        <button onClick={onViewGuide}
          className="tp-body rounded-[var(--r-control)] py-3 font-semibold text-white"
          style={{ background: 'var(--brand-navy-900)' }}>
          View My Full Experiment
        </button>
        <Link to="/paths" className="tp-body text-center font-semibold transition hover:opacity-80" style={{ color: 'var(--brand-navy-900)' }}>
          ← Return to Path Comparison
        </Link>
      </div>
    </div>
  );
}

// ─── Duplicate check modal ────────────────────────────────────────────────────
function DuplicateModal({ existing, onContinue, onCreateNew, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-md rounded-[var(--r-surface)] bg-white p-6 space-y-4">
        <h3 className="tp-section text-[color:var(--surface-dark-900)]">You already have an experiment for this path</h3>
        <p className="tp-body text-[color:var(--ink-700)]">
          <span className="font-semibold">"{existing.title}"</span> is {existing.status === 'draft' ? 'a saved draft' : 'currently active'} for <span className="font-semibold">{existing.path_name}</span>.
        </p>
        <div className="space-y-2">
          <button onClick={onContinue}
            className="tp-body w-full rounded-[var(--r-control)] py-3 font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)' }}>
            Continue Existing Experiment
          </button>
          <button onClick={onCreateNew}
            className="tp-body w-full rounded-[var(--r-control)] border py-3 font-semibold transition hover:bg-[color:var(--ink-50)]"
            style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-700)' }}>
            Create a New Experiment
          </button>
          <button onClick={onCancel} className="tp-body w-full py-2 text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)]">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ExperimentSetup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const recId = searchParams.get('recId');
  const pathId = searchParams.get('pathId');
  const pathNameParam = searchParams.get('pathName');
  // Set when the student came from a recommended next test: the unknown that
  // recommendation exists to answer, so the designed experiments test it.
  const variableParam = searchParams.get('variable');

  const [rec, setRec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // uncertainty | pick | custom | generating | success
  const [step, setStep] = useState('uncertainty');
  // The uncertainty map for this career, and the one unknown the student chose.
  const [variables, setVariables] = useState([]);
  const [focusId, setFocusId] = useState(variableParam || '');
  const [options, setOptions] = useState([]);
  const [designing, setDesigning] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [customData, setCustomData] = useState({});
  const [experiment, setExperiment] = useState(null);
  const [missionGuide, setMissionGuide] = useState(null);
  const [genError, setGenError] = useState(null);
  const [duplicate, setDuplicate] = useState(null);
  const [forceNew, setForceNew] = useState(false);
  // Guards a repeated submit (double-click, Enter twice) from creating two
  // experiments before the first create resolves.
  const submitting = useRef(false);

  useEffect(() => {
    loadRec();
  }, [recId, pathId, pathNameParam]);

  const loadRec = async () => {
    setLoading(true);
    try {
      /* A Deep Dive can arrive from several places, and each one knows the path
         by a different handle: the recommendation's record id, the path_id on
         that record, or only the name. Resolving just one of them is why
         "we could not identify the path you selected" was reachable from a
         working recommendation — the id was fine, it was simply the handle this
         screen did not read. All of them are honoured now, and the path the
         student is already testing is the last resort. */
      let resolved = null;
      const wanted = recId || pathId;
      if (wanted) {
        const owned = await base44.entities.PathRecommendations.list('-created_date', 200).catch(() => []);
        const rows = Array.isArray(owned) ? owned : [];
        resolved = rows.find(p => p.id === wanted)
          || rows.find(p => p.path_id === wanted)
          || null;
        // A name in the URL still identifies the path when the id came from a
        // merged or library record that this student does not own a row for.
        if (!resolved && pathNameParam) {
          const name = decodeURIComponent(pathNameParam).toLowerCase();
          resolved = rows.find(p => (p.path_name || '').toLowerCase() === name) || null;
        }
      }
      if (!resolved && pathNameParam) {
        resolved = { path_name: decodeURIComponent(pathNameParam), fit_reason: '', current_gaps: [], first_experiment: '' };
      }
      if (!resolved) {
        // Nothing usable in the URL: the path this student is currently testing
        // is a better answer than an error screen.
        const [cycle, owned] = await Promise.all([
          getActiveCycle().catch(() => null),
          base44.entities.PathRecommendations.list('-created_date', 200).catch(() => []),
        ]);
        const current = resolveCurrentPath(cycle, Array.isArray(owned) ? owned : []);
        if (current) resolved = current;
      }
      if (!resolved) {
        setLoadError('We could not identify the path you selected. Return to Path Comparison and select the path again.');
        setLoading(false);
        return;
      }
      setRec(resolved);
      setOptions(getExperimentOptions(resolved.path_name));
      setLoading(false);
      await loadUncertainty(resolved);
      return;
    } catch (e) {
      setLoadError('We could not identify the path you selected. Return to Path Comparison and select the path again.');
    }
    setLoading(false);
  };

  /**
   * The uncertainty map for this career, which is what the student chooses from
   * before anything is designed. A recommended next test arrives with the
   * unknown it exists to answer already in the URL, so that one is preselected.
   */
  const loadUncertainty = async (resolved) => {
    if (!resolved?.path_name) return;
    try {
      const [profs, exps, prf, refs] = await Promise.all([
        base44.entities.StudentProfile.list('-created_date', 1).catch(() => []),
        base44.entities.Experiments.list('-created_date', 200).catch(() => []),
        base44.entities.ProofOfWork.list('-created_date', 200).catch(() => []),
        base44.entities.WeeklyReflections.list('-created_date', 200).catch(() => []),
      ]);
      const hyp = deriveHypothesis(resolved, {
        profile: (Array.isArray(profs) ? profs[0] : null) || {},
        experiments: exps || [], proof: prf || [], reflections: refs || [],
      });
      // Unknowns first, since those are what an experiment can still move.
      const vars = (hyp.uncertainty?.variables || []);
      const unknownIds = new Set((hyp.uncertainty?.top_unknowns || []).map(v => v.variable));
      setVariables([...vars.filter(v => unknownIds.has(v.variable)), ...vars.filter(v => !unknownIds.has(v.variable))]);
      // Nothing to choose between: don't show an empty dropdown.
      if (!vars.length) setStep('pick');
    } catch (_) {
      // With no map the student goes straight to the activity suggestions.
      setVariables([]);
      setStep('pick');
    }
  };

  /**
   * Design experiments for the one uncertainty the student chose, so all three
   * options answer that question through different kinds of work. If the design
   * step cannot run, the older activity suggestions stay in place rather than
   * blocking the page.
   */
  const designForFocus = async (focus) => {
    if (!rec?.path_name) return;
    setDesigning(true);
    try {
      const result = await designExperiments(rec, null, { focus });
      if (result?.ok && result.data?.length) setOptions(result.data);
    } catch (_) {
      // Static suggestions remain.
    } finally {
      setDesigning(false);
    }
  };

  const focus = variables.find(v => v.variable === focusId) || null;
  // The biggest current unknown, the test recommended for it, and the effort it
  // takes. Derived from the uncertainty the student chose, never invented.
  const brief = focus
    ? testBrief({ path: rec, careerName: rec?.path_name, target: { id: focus.variable, label: focus.label, question: focus.question } })
    : null;

  /**
   * "Test This" runs the recommended kind of test: the designed option matching
   * the recommended type when one came back, otherwise the first design.
   */
  const handleTestRecommended = async () => {
    const designed = options.filter(o => o.realistic_scenario || o.test_question);
    // The designed option matching the recommended type, then any designed one,
    // then the first suggestion. That last fallback is the difference between
    // this button working and doing nothing at all: when the design step fails
    // or returns nothing, `options` is still the static suggestion list, none of
    // which carries a scenario or a test question, so `designed` is empty and
    // the click used to return silently.
    const match = designed.find(o => o.experiment_type === brief?.experiment_type)
      || designed[0]
      || options[0];
    if (!match) return;
    setSelectedIndex(options.indexOf(match));
    await handleConfirmPickWith(match);
  };

  const handleConfirmFocus = () => {
    setSelectedIndex(null);
    setStep('pick');
    designForFocus(focus);
  };

  const handleSelectOption = (opt) => {
    const idx = options.findIndex(o => o.title === opt.title);
    setSelectedIndex(idx);
  };

  const handleConfirmPickWith = async (opt) => {
    const { type, ...designFields } = opt;
    await proceedToGenerate({
      ...designFields,
      experiment_type: opt.experiment_type || type,
      // Every experiment records the uncertainty it tests and the decision
      // dimensions that uncertainty moves, whichever option was chosen.
      test_question: opt.test_question || opt.unresolved_question || brief?.biggest_unknown || '',
      why_this_test_matters: opt.why_this_test_matters || brief?.why_it_matters || '',
      uncertainty_ids: opt.uncertainty_ids?.length ? opt.uncertainty_ids : (focus?.variable ? [focus.variable] : []),
      uncertainty_label: opt.uncertainty_label || focus?.label || '',
      decision_dimension_ids: opt.decision_dimension_ids?.length ? opt.decision_dimension_ids : (brief?.decision_dimension_ids || []),
      effort: opt.effort || brief?.effort || undefined,
      evidence_requirements: opt.evidence_requirements?.length
        ? opt.evidence_requirements
        : [evidenceRequirementFallback({ test_question: opt.test_question || brief?.biggest_unknown })],
      path_name: rec.path_name,
      career_name: opt.career_name || rec.path_name,
      career_hypothesis_id: rec.id || '',
      path_recommendation_id: rec.id || '',
    });
  };

  const handleConfirmPick = async () => {
    if (selectedIndex === null) return;
    await handleConfirmPickWith(options[selectedIndex]);
  };

  const handleConfirmCustom = async () => {
    await proceedToGenerate({
      ...customData,
      experiment_type: 'Custom',
      design_source: 'custom',
      path_name: rec.path_name,
      career_name: rec.path_name,
      career_hypothesis_id: rec.id || '',
      path_recommendation_id: rec.id || '',
    });
  };

  const proceedToGenerate = async (experimentData) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await runGenerate(experimentData);
    } finally {
      submitting.current = false;
    }
  };

  const runGenerate = async (experimentData) => {
    // The cycle is the authority on whether a second experiment may start.
    let cycle;
    try {
      cycle = await ensureActiveCycle({ selected_path_id: rec.id, selected_path_name: rec.path_name });
      if (!forceNew) await assertNoActiveExperiment(cycle);
    } catch (e) {
      if (e instanceof ActiveExperimentError) {
        setDuplicate(e.experiment);
        return;
      }
      cycle = cycle || null;
    }

    if (!forceNew) {
      // Duplicate check
      try {
        const existing = await base44.entities.Experiments.filter({ path_name: rec.path_name });
        const active = existing.find(e => e.status === 'draft' || e.status === 'planned' || e.status === 'in_progress');
        if (active) {
          setDuplicate(active);
          return;
        }
      } catch (_) {}
    }
    setForceNew(false);

    setStep('generating');
    setGenError(null);

    // Create draft
    let saved;
    try {
      const links = await cycleLinks({ path: { id: rec.id } });
      saved = await base44.entities.Experiments.create({
        ...links,
        ...experimentData,
        career_cycle_id: links.cycle_id || undefined,
        path_id: rec.id || links.path_id,
        experiment_id: undefined,
        status: 'draft',
        mission_guide_status: 'not_generated',
      });
      setExperiment(saved);
      /* Generated by us, and chosen by the student: two facts one row cannot
         tell apart, which is why a custom or designed Deep Dive previously
         recorded neither. */
      await import('@/lib/analytics/decision-funnel-events')
        .then(async (m) => {
          await m.experimentGenerated({ experimentId: saved.id, pathId: rec.id, stage: experimentData.experiment_type || 'designed' });
          await m.experimentSelected({
            experimentId: saved.id,
            pathId: rec.id,
            cycleId: links.cycle_id,
            stage: experimentData.design_source === 'custom' ? 'custom' : 'designed',
          });
        })
        .catch(() => {});
      await attachExperimentToCycle(saved);
    } catch (e) {
      setGenError('Experiment draft could not be saved. Please try again.');
      setStep('generating');
      return;
    }

    // Generate Mission Guide
    try {
      await base44.entities.Experiments.update(saved.id, { mission_guide_status: 'generating' });
      // Generates the Mission Guide, including the outreach email template a
      // student sends to a real professional. Highest-quality tier; see
      // src/lib/llm.js.
      const guideResult = await generateValidated({
        feature: 'mission_guide_prefilled',
        model: 'gemini_3_1_pro',
        context: { path_id: rec.id, experiment_id: saved.id },
        validate: validateMissionGuide,
        call: async (correction) => unwrapLLM(await base44.integrations.Core.InvokeLLM({
        model: 'gemini_3_1_pro',
        prompt: `You are Unscripted, a path-testing platform for ambitious college students.

Generate a highly specific Mission Guide for this exact experiment:

PATH BEING TESTED: ${experimentData.path_name}
EXPERIMENT: ${experimentData.title}
OBJECTIVE: ${experimentData.objective}
DELIVERABLE: ${experimentData.deliverable}
${experimentData.unresolved_question ? `THE QUESTION THIS MUST ANSWER: ${experimentData.unresolved_question}` : ''}
${experimentData.realistic_scenario ? `THE SCENARIO THE STUDENT IS WORKING FROM: ${experimentData.realistic_scenario}` : ''}

${experimentData.test_question ? `THE UNCERTAINTY THIS EXPERIMENT EXISTS TO REDUCE: ${experimentData.test_question}
Every step must move that question forward. Missions exist to create decision evidence, never to fill time: between them they should have the student DOING, OBSERVING, SPEAKING and PRODUCING wherever those make sense for this career. Add no step that does not help answer the question above.
If a step asks the student to contact a professional, the conversation must test that same uncertainty: say what to ask about their real week, the hardest stretches and the tradeoffs, rather than "talk to someone in the field".
Remind the student in at least one step that we are testing whether this type of work is energizing, not whether they can perform it perfectly.` : ''}

The guide must be specific to "${experimentData.path_name}", not generic networking advice. Include:
1. Mission objective (1 sentence)
2. Why this experiment helps test ${experimentData.path_name} specifically
3. Exact step-by-step instructions (8-12 steps, each actionable)
4. Where to find the right people or resources for ${experimentData.path_name}
5. A specific outreach email template if applicable (tailored to ${experimentData.path_name})
6. Specific questions to ask or things to look for
7. How to prepare
8. Completion checklist
9. Proof-of-work requirement
10. 3 reflection questions
11. Common mistakes specific to ${experimentData.path_name}
12. What to do next after completing this experiment

Be specific. If the experiment involves outreach, include field-specific details. If it involves building something, specify exactly what to build.

"mission_steps" must be an array of plain strings. A step returned as an object is a failure.
${PLAIN_PROSE_RULES}${correction}`,
        response_json_schema: {
          type: 'object',
          properties: {
            mission_objective: { type: 'string' },
            why_this_helps: { type: 'string' },
            expected_learning: { type: 'string' },
            mission_steps: { type: 'array', items: { type: 'string' } },
            tools: { type: 'array', items: { type: 'string' } },
            proof_required: { type: 'string' },
            reflection_questions: { type: 'array', items: { type: 'string' } },
            common_mistakes: { type: 'array', items: { type: 'string' } },
            completion_criteria: { type: 'string' },
            next_step: { type: 'string' },
          }
        }
        })),
      });

      // An experiment stamped "generated" is one the app stops offering to
      // generate. Stamping an empty answer is how a student ends up with a
      // mission the product says is ready and that has nothing in it, so a
      // guide with no usable steps stays retryable instead. The model has
      // already been asked a second time with the reason in hand by this point.
      if (!guideResult.ok) {
        setGenError('The experiment came back empty both times we asked. Your experiment draft was saved. You can retry from My Experiments.');
        await base44.entities.Experiments.update(saved.id, { status: 'planned', mission_guide_status: 'not_generated' })
          .catch(() => {});
        return;
      }

      const guide = guideResult.data;

      await base44.entities.Experiments.update(saved.id, {
        status: 'planned',
        mission_guide_status: 'generated',
        expected_learning: guide.expected_learning,
        mission_steps: guide.mission_steps.map(s => ({ step: s })),
        tools: guide.tools,
        proof_required: guide.proof_required,
        reflection_questions: guide.reflection_questions,
        common_mistakes: guide.common_mistakes,
        completion_criteria: guide.completion_criteria,
      });

      // Reload the saved record
      const updated = await base44.entities.Experiments.filter({ id: saved.id });
      setExperiment(updated[0] || { ...saved, status: 'planned' });
      setMissionGuide(guide);
      setStep('success');
    } catch (e) {
      // Slugs only. The prompt carries the student's own path and objective, so
      // a raw error can echo them back into the console and the log.
      reportAiFailure('mission_guide_prefilled', {
        stage: 'save_experiment',
        codes: ['unexpected_error'],
        model: 'gemini_3_1_pro',
        path_id: rec.id,
        experiment_id: saved.id,
      });
      setGenError('We could not build your experiment. Your experiment draft was saved. You can retry from My Experiments.');
      await base44.entities.Experiments.update(saved.id, { status: 'planned', mission_guide_status: 'not_generated' })
        .catch(() => {});
    }
  };

  const handleContinueExisting = () => {
    navigate('/experiments');
  };

  const handleCreateNew = () => {
    setDuplicate(null);
    setForceNew(true);
    // Re-trigger with force
    const selectedData = step === 'custom'
      ? { ...customData, path_name: rec.path_name, path_recommendation_id: rec.id || '', experiment_type: 'Custom' }
      : selectedIndex !== null
        ? { ...options[selectedIndex], path_name: rec.path_name, path_recommendation_id: rec.id || '' }
        : null;
    if (selectedData) {
      setTimeout(() => proceedToGenerate(selectedData), 0);
    }
  };

  if (loading) {
    // The wordmark, the back link and the four-step rail are all known before
    // the path comes back, only the card's contents depend on the fetch. This
    // was a spinner centred on an empty page, so the step rail that tells the
    // student how long this takes arrived last instead of first.
    return (
      <main className="min-h-[100svh]" style={{ background: 'var(--page-surface)' }}>
        <div className="app-page">
          <div className="mb-8 flex items-center justify-between">
            <LogoWordmark />
            <Link to="/paths" className="tp-body flex items-center gap-1 text-[color:var(--ink-500)] hover:text-[color:var(--surface-dark-900)]">
              <ArrowLeft size={15} /> Path Comparison
            </Link>
          </div>

          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2">
              {STEPS.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ background: i === 0 ? 'var(--brand-navy-900)' : 'var(--ink-300)' }} />
                    <span className="tp-meta hidden font-semibold sm:block"
                      style={{ color: i === 0 ? 'var(--brand-navy-900)' : 'var(--ink-400)' }}>{label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className="h-px w-4 bg-[color:var(--ink-200)]" />}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-6 sm:p-8">
            <div className="flex h-8 items-center"><Sk h={24} w="70%" r={7} /></div>
            <div className="mt-2 flex h-6 items-center"><Sk h={13} w="92%" r={5} /></div>
            <div className="mt-6"><SkCards count={3} h={92} gap={12} r={16} /></div>
            <Sk h={48} r={10} className="mt-6" />
          </div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-[100svh] px-5 py-10 flex items-center justify-center" style={{ background: 'var(--page-surface)' }}>
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="mx-auto text-red-500" size={40} />
          <h2 className="tp-section text-[color:var(--surface-dark-900)]">{loadError}</h2>
          <Link to="/paths"
            className="tp-body inline-flex items-center gap-2 rounded-[var(--r-control)] px-5 py-3 font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)' }}>
            Return to Path Comparison
          </Link>
        </div>
      </main>
    );
  }

  const progressStep = step === 'uncertainty' ? 1 : step === 'pick' ? 2 : step === 'custom' ? 3 : step === 'generating' ? 4 : 5;

  return (
    <main className="min-h-[100svh]" style={{ background: 'var(--page-surface)' }}>
      {duplicate && (
        <DuplicateModal
          existing={duplicate}
          onContinue={handleContinueExisting}
          onCreateNew={handleCreateNew}
          onCancel={() => setDuplicate(null)}
        />
      )}

      <div className="app-page">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <LogoWordmark />
          <Link to="/paths" className="tp-body flex items-center gap-1 text-[color:var(--ink-500)] hover:text-[color:var(--surface-dark-900)]">
            <ArrowLeft size={15} /> Path Comparison
          </Link>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full transition-colors"
                    style={{ background: progressStep > i + 1 ? 'var(--success-700)' : progressStep === i + 1 ? 'var(--brand-navy-900)' : 'var(--ink-300)' }} />
                  <span className="tp-meta font-semibold hidden sm:block"
                    style={{ color: progressStep === i + 1 ? 'var(--brand-navy-900)' : 'var(--ink-400)' }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="h-px w-4 bg-[color:var(--ink-200)]" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-6 sm:p-8">
          {step === 'uncertainty' && (
            <UncertaintyPicker
              pathName={rec.path_name}
              variables={variables}
              value={focusId}
              onChange={setFocusId}
              onNext={handleConfirmFocus}
            />
          )}
          {step === 'pick' && (
            <StepPick
              rec={rec}
              options={options}
              selected={selectedIndex}
              onSelect={handleSelectOption}
              onCustom={() => setStep('custom')}
              onNext={handleConfirmPick}
              designing={designing}
              focus={focus}
              onChangeFocus={() => setStep('uncertainty')}
              brief={brief}
              onTestRecommended={handleTestRecommended}
            />
          )}
          {step === 'custom' && (
            <StepCustom
              pathName={rec.path_name}
              data={customData}
              onChange={(k, v) => setCustomData(d => ({ ...d, [k]: v }))}
              onBack={() => setStep('pick')}
              onNext={handleConfirmCustom}
            />
          )}
          {step === 'generating' && (
            <StepGenerating experiment={experiment} missionGuide={missionGuide} error={genError} />
          )}
          {step === 'success' && experiment && missionGuide && (
            <StepSuccess
              experiment={experiment}
              missionGuide={missionGuide}
              onViewGuide={() => navigate(`/experiment?experimentId=${experiment.id}`)}
            />
          )}
        </div>
      </div>
    </main>
  );
}