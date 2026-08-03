import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { toText, toTextList } from '@/lib/ai-validation';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';
import { Sk, SkCards } from '@/components/PageSkeleton';
import AddToCalendarModal from '@/components/calendar/AddToCalendarModal';
import {
  ensureActiveCycle, assertNoActiveExperiment, attachExperimentToCycle,
  ActiveExperimentError, cycleLinks,
} from '@/lib/career-cycle';

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
function repairMissionGuide(raw) {
  const steps = toTextList(raw?.mission_steps);
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

// ─── Step 1: Path context + experiment picker ────────────────────────────────
function StepPick({ rec, options, selected, onSelect, onCustom, onNext }) {
  return (
    <div className="space-y-6">
      {/* Path context card */}
      <div className="rounded-[20px] p-5 space-y-3" style={{ background: 'var(--surface-dark-700)', color: 'white' }}>
        <p className="text-xs font-bold uppercase tracking-[.14em] opacity-60">Testing Path</p>
        <h2 className="font-heading text-2xl font-bold">{rec.path_name}</h2>
        {rec.fit_reason && (
          <div>
            <p className="text-xs font-bold uppercase tracking-[.12em] opacity-60 mb-1">Why it was recommended</p>
            <p className="text-sm opacity-80 leading-6">{rec.fit_reason}</p>
          </div>
        )}
        {rec.current_gaps?.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-[.12em] opacity-60 mb-1">Your current gaps</p>
            <div className="flex flex-wrap gap-2">
              {rec.current_gaps.map((g, i) => (
                <span key={i} className="rounded-full px-2.5 py-1 text-xs" style={{ background: 'rgba(255,255,255,0.1)' }}>{g}</span>
              ))}
            </div>
          </div>
        )}
        {rec.first_experiment && (
          <div>
            <p className="text-xs font-bold uppercase tracking-[.12em] opacity-60 mb-1">Suggested first experiment</p>
            <p className="text-sm opacity-80">{rec.first_experiment}</p>
          </div>
        )}
      </div>

      {/* Experiment options */}
      <div>
        <p className="text-sm font-bold text-[color:var(--surface-dark-900)] mb-3">Choose your experiment:</p>
        <div className="space-y-3">
          {options.map((opt, i) => (
            <button key={i} onClick={() => onSelect(opt)}
              className="w-full text-left rounded-[16px] border p-4 transition"
              style={selected === i
                ? { background: 'var(--ink-100)', borderColor: 'var(--brand-navy-900)' }
                : { background: 'white', borderColor: 'var(--ink-200)' }}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: selected === i ? 'var(--brand-navy-900)' : 'var(--ink-300)' }}>
                  {selected === i && <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--brand-navy-900)' }} />}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--brand-navy-700)' }}>{opt.type}</p>
                  <p className="font-semibold text-[color:var(--surface-dark-900)] text-sm">{opt.title}</p>
                  <p className="mt-1 text-xs text-[color:var(--ink-500)]">{opt.objective}</p>
                  <p className="mt-1 text-xs text-[color:var(--ink-400)]">~{opt.estimated_hours}h · Deliverable: {opt.deliverable.substring(0, 60)}…</p>
                </div>
              </div>
            </button>
          ))}
          <button onClick={onCustom}
            className="w-full text-left rounded-[16px] border border-dashed p-4 text-sm font-semibold text-[color:var(--ink-500)] transition hover:border-[color:var(--brand-navy-700)] hover:text-[color:var(--brand-navy-700)]"
            style={{ background: 'white' }}>
            + Create a custom experiment
          </button>
        </div>
      </div>

      <button onClick={onNext} disabled={selected === null}
        className="w-full flex items-center justify-center gap-2 rounded-[12px] py-3.5 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-40"
        style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
        Confirm Experiment & Generate Mission Guide <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ─── Step 2: Custom experiment form ─────────────────────────────────────────
function StepCustom({ pathName, data, onChange, onBack, onNext }) {
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-[color:var(--ink-500)] hover:text-[color:var(--surface-dark-900)]">
        <ArrowLeft size={15} /> Back to suggestions
      </button>
      <h3 className="font-heading text-xl font-bold text-[color:var(--surface-dark-900)]">Custom Experiment</h3>
      {[
        { name: 'title', label: 'Experiment title', placeholder: 'e.g. Shadow a product manager for a day' },
        { name: 'objective', label: 'What do you want to learn?', placeholder: 'What question are you trying to answer?' },
        { name: 'deliverable', label: 'Deliverable', placeholder: 'What will you produce or submit as proof?' },
      ].map(f => (
        <label key={f.name} className="block">
          <span className="text-sm font-semibold text-[color:var(--ink-700)] block mb-1">{f.label}</span>
          <input className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
            placeholder={f.placeholder} value={data[f.name] || ''} onChange={e => onChange(f.name, e.target.value)} />
        </label>
      ))}
      <label className="block">
        <span className="text-sm font-semibold text-[color:var(--ink-700)] block mb-1">Path being tested</span>
        <input className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-100)] px-4 py-3 text-sm outline-none text-[color:var(--ink-700)]"
          value={pathName} readOnly />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-[color:var(--ink-700)] block mb-1">Estimated hours</span>
        <input type="number" min="1" max="40" className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
          value={data.estimated_hours || 5} onChange={e => onChange('estimated_hours', Number(e.target.value))} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-[color:var(--ink-700)] block mb-1">Deadline (optional)</span>
        <input type="date" className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
          value={data.deadline || ''} onChange={e => onChange('deadline', e.target.value)} />
      </label>
      <button onClick={onNext} disabled={!data.title || !data.objective}
        className="w-full flex items-center justify-center gap-2 rounded-[12px] py-3.5 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-40"
        style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
        Generate Mission Guide <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ─── Step 3: Generating + Success ────────────────────────────────────────────
function StepGenerating({ experiment, missionGuide, error }) {
  if (error) {
    return (
      <div className="rounded-[20px] border border-red-200 bg-red-50 p-6 text-center space-y-3">
        <AlertCircle className="mx-auto text-red-500" size={32} />
        <p className="font-semibold text-red-700">Mission Guide generation failed</p>
        <p className="text-sm text-red-600">{error}</p>
        <p className="text-xs text-red-500">Your experiment draft was saved. Return to Missions to retry.</p>
        <Link to="/experiments" className="inline-block mt-2 text-sm font-semibold" style={{ color: 'var(--brand-navy-900)' }}>Go to Missions →</Link>
      </div>
    );
  }

  if (!missionGuide) {
    return (
      <div className="py-16 text-center space-y-4">
        <Loader2 className="mx-auto animate-spin" size={36} style={{ color: 'var(--brand-navy-900)' }} />
        <p className="font-heading text-xl font-bold text-[color:var(--surface-dark-900)]">Generating your Mission Guide...</p>
        <p className="text-sm text-[color:var(--ink-500)]">Building a step-by-step guide specific to {experiment?.path_name} and your selected experiment.</p>
      </div>
    );
  }

  return null; // success handled by parent
}

// ─── Step 4: Success ─────────────────────────────────────────────────────────
function StepSuccess({ experiment, missionGuide, onViewGuide }) {
  const [showCal, setShowCal] = useState(false);
  // Rows written before guides were validated can hold steps as objects, and an
  // object handed to React as a child throws and blanks this screen.
  const firstStepText = toText(missionGuide?.mission_steps?.[0]) || 'Start your first action';

  return (
    <div className="space-y-6">
      {showCal && (
        <AddToCalendarModal
          item={experiment}
          itemType="experiment"
          onClose={() => setShowCal(false)}
        />
      )}

      <div className="rounded-[20px] text-center p-8 space-y-3" style={{ background: 'var(--success-50)', border: '1px solid #86EFAC' }}>
        <CheckCircle className="mx-auto text-green-600" size={40} />
        <h2 className="font-heading text-2xl font-bold text-[color:var(--surface-dark-900)]">Mission Created</h2>
        <div className="space-y-1">
          <p className="text-sm text-[color:var(--ink-700)]"><span className="font-semibold">You are testing:</span> {experiment.path_name}</p>
          <p className="text-sm text-[color:var(--ink-700)]"><span className="font-semibold">Your experiment:</span> {experiment.title}</p>
        </div>
      </div>

      <div className="rounded-[16px] border border-[color:var(--ink-200)] bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-[color:var(--ink-500)] mb-2">Your first action</p>
        <p className="text-sm font-semibold text-[color:var(--surface-dark-900)]">{firstStepText}</p>
      </div>

      {missionGuide?.mission_steps?.length > 0 && (
        <div className="rounded-[16px] border border-[color:var(--ink-200)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[color:var(--ink-500)] mb-3">Mission Guide Preview</p>
          <ol className="space-y-2">
            {missionGuide.mission_steps.slice(0, 5).map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-[color:var(--ink-700)]">
                <span className="shrink-0 font-bold" style={{ color: 'var(--brand-navy-900)' }}>{i + 1}.</span>
                <span>{toText(s)}</span>
              </li>
            ))}
            {missionGuide.mission_steps.length > 5 && (
              <li className="text-xs text-[color:var(--ink-400)] pl-6">+ {missionGuide.mission_steps.length - 5} more steps in the full guide</li>
            )}
          </ol>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onViewGuide}
          className="rounded-[12px] py-3 text-sm font-semibold text-white"
          style={{ background: 'var(--brand-navy-900)' }}>
          View Full Mission Guide
        </button>
        <button onClick={() => setShowCal(true)}
          className="rounded-[12px] border py-3 text-sm font-semibold transition hover:bg-[color:var(--ink-50)]"
          style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-700)' }}>
          Add to Calendar
        </button>
        <Link to="/paths" className="col-span-2 text-center text-sm font-semibold transition hover:opacity-80" style={{ color: 'var(--brand-navy-900)' }}>
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
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 space-y-4">
        <h3 className="font-heading text-lg font-bold text-[color:var(--surface-dark-900)]">You already have an experiment for this path</h3>
        <p className="text-sm text-[color:var(--ink-700)]">
          <span className="font-semibold">"{existing.title}"</span> is {existing.status === 'draft' ? 'a saved draft' : 'currently active'} for <span className="font-semibold">{existing.path_name}</span>.
        </p>
        <div className="space-y-2">
          <button onClick={onContinue}
            className="w-full rounded-[10px] py-3 text-sm font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)' }}>
            Continue Existing Experiment
          </button>
          <button onClick={onCreateNew}
            className="w-full rounded-[10px] border py-3 text-sm font-semibold transition hover:bg-[color:var(--ink-50)]"
            style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-700)' }}>
            Create a New Experiment
          </button>
          <button onClick={onCancel} className="w-full py-2 text-sm text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)]">Cancel</button>
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

  const [rec, setRec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [step, setStep] = useState('pick'); // pick | custom | generating | success
  const [options, setOptions] = useState([]);
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
  }, [recId, pathNameParam]);

  const loadRec = async () => {
    setLoading(true);
    try {
      let resolved = null;
      if (recId) {
        const results = await base44.entities.PathRecommendations.filter({ id: recId });
        resolved = results[0] || null;
      }
      if (!resolved && pathNameParam) {
        resolved = { path_name: decodeURIComponent(pathNameParam), fit_reason: '', current_gaps: [], first_experiment: '' };
      }
      if (!resolved) {
        setLoadError('We could not identify the path you selected. Return to Path Comparison and select the path again.');
        setLoading(false);
        return;
      }
      setRec(resolved);
      setOptions(getExperimentOptions(resolved.path_name));
    } catch (e) {
      setLoadError('We could not identify the path you selected. Return to Path Comparison and select the path again.');
    }
    setLoading(false);
  };

  const handleSelectOption = (opt) => {
    const idx = options.findIndex(o => o.title === opt.title);
    setSelectedIndex(idx);
  };

  const handleConfirmPick = async () => {
    if (selectedIndex === null) return;
    const opt = options[selectedIndex];
    await proceedToGenerate({
      title: opt.title,
      experiment_type: opt.type,
      objective: opt.objective,
      deliverable: opt.deliverable,
      estimated_hours: opt.estimated_hours,
      path_name: rec.path_name,
      path_recommendation_id: rec.id || '',
    });
  };

  const handleConfirmCustom = async () => {
    await proceedToGenerate({
      ...customData,
      experiment_type: 'Custom',
      path_name: rec.path_name,
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
        path_id: rec.id || links.path_id,
        experiment_id: undefined,
        status: 'draft',
        mission_guide_status: 'not_generated',
      });
      setExperiment(saved);
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
      const rawGuide = unwrapLLM(await base44.integrations.Core.InvokeLLM({
        model: 'gemini_3_1_pro',
        prompt: `You are Unscripted, a path-testing platform for ambitious college students.

Generate a highly specific Mission Guide for this exact experiment:

PATH BEING TESTED: ${experimentData.path_name}
EXPERIMENT: ${experimentData.title}
OBJECTIVE: ${experimentData.objective}
DELIVERABLE: ${experimentData.deliverable}

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
${PLAIN_PROSE_RULES}`,
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
      }));

      const { guide, usable } = repairMissionGuide(rawGuide);

      // An experiment stamped "generated" is one the app stops offering to
      // generate. Stamping an empty answer is how a student ends up with a
      // mission the product says is ready and that has nothing in it, so a
      // guide with no steps is treated as a failure and left retryable.
      if (!usable) {
        console.error('[mission-guide] rejected: no usable steps');
        setGenError('The Mission Guide came back empty. Your experiment draft was saved. You can retry from the Missions page.');
        await base44.entities.Experiments.update(saved.id, { status: 'planned', mission_guide_status: 'not_generated' });
        return;
      }

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
      // Shape only. The prompt carries the student's own path and objective, so
      // a raw error can echo them back into the console.
      console.error(`[mission-guide] generation failed (${e?.name || 'error'})`);
      setGenError('Mission Guide generation failed. Your experiment draft was saved. You can retry from the Missions page.');
      await base44.entities.Experiments.update(saved.id, { status: 'planned', mission_guide_status: 'not_generated' })
        .catch(() => console.error('[mission-guide] could not reset the draft status'));
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
    // the path comes back — only the card's contents depend on the fetch. This
    // was a spinner centred on an empty page, so the step rail that tells the
    // student how long this takes arrived last instead of first.
    return (
      <main className="min-h-screen px-5 py-10" style={{ background: 'var(--page-surface)' }}>
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex items-center justify-between">
            <LogoWordmark />
            <Link to="/paths" className="flex items-center gap-1 text-sm text-[color:var(--ink-500)] hover:text-[color:var(--surface-dark-900)]">
              <ArrowLeft size={15} /> Path Comparison
            </Link>
          </div>

          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2">
              {['Select Experiment', 'Confirm Details', 'Generate Guide', 'Mission Created'].map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ background: i === 0 ? 'var(--brand-navy-900)' : 'var(--ink-300)' }} />
                    <span className="hidden text-xs font-semibold sm:block"
                      style={{ color: i === 0 ? 'var(--brand-navy-900)' : 'var(--ink-400)' }}>{label}</span>
                  </div>
                  {i < 3 && <div className="h-px w-4 bg-[color:var(--ink-200)]" />}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[color:var(--ink-200)] bg-white p-6 sm:p-8">
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
      <main className="min-h-screen px-5 py-10 flex items-center justify-center" style={{ background: 'var(--page-surface)' }}>
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="mx-auto text-red-500" size={40} />
          <h2 className="font-heading text-xl font-bold text-[color:var(--surface-dark-900)]">{loadError}</h2>
          <Link to="/paths"
            className="inline-flex items-center gap-2 rounded-[10px] px-5 py-3 text-sm font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)' }}>
            Return to Path Comparison
          </Link>
        </div>
      </main>
    );
  }

  const progressStep = step === 'pick' ? 1 : step === 'custom' ? 2 : step === 'generating' ? 3 : 4;

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: 'var(--page-surface)' }}>
      {duplicate && (
        <DuplicateModal
          existing={duplicate}
          onContinue={handleContinueExisting}
          onCreateNew={handleCreateNew}
          onCancel={() => setDuplicate(null)}
        />
      )}

      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <LogoWordmark />
          <Link to="/paths" className="flex items-center gap-1 text-sm text-[color:var(--ink-500)] hover:text-[color:var(--surface-dark-900)]">
            <ArrowLeft size={15} /> Path Comparison
          </Link>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            {['Select Experiment', 'Confirm Details', 'Generate Guide', 'Mission Created'].map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full transition-colors"
                    style={{ background: progressStep > i + 1 ? 'var(--success-700)' : progressStep === i + 1 ? 'var(--brand-navy-900)' : 'var(--ink-300)' }} />
                  <span className="text-xs font-semibold hidden sm:block"
                    style={{ color: progressStep === i + 1 ? 'var(--brand-navy-900)' : 'var(--ink-400)' }}>{label}</span>
                </div>
                {i < 3 && <div className="h-px w-4 bg-[color:var(--ink-200)]" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="rounded-[24px] border border-[color:var(--ink-200)] bg-white p-6 sm:p-8">
          {step === 'pick' && (
            <StepPick
              rec={rec}
              options={options}
              selected={selectedIndex}
              onSelect={handleSelectOption}
              onCustom={() => setStep('custom')}
              onNext={handleConfirmPick}
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
              onViewGuide={() => navigate('/experiments')}
            />
          )}
        </div>
      </div>
    </main>
  );
}