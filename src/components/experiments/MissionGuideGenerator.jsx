import { useState, useRef, useEffect } from 'react';
import { X, Loader2, Wand2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { unwrapLLM } from '@/lib/llm';
import { buildGuidePrompt, GUIDE_JSON_SCHEMA, validateGuide, attachCampusEvent } from './guideSchema';
import { logAiFailure } from '@/lib/ai-failures';

/**
 * The guide validator returns prose reasons, which quote generated text. The
 * failure log only ever holds slugs, so reasons are reduced to a count here
 * rather than passed through.
 */
function guideFailureCodes(errors = []) {
  return errors.length ? [`guide_rejected_${Math.min(errors.length, 9)}`] : ['guide_rejected'];
}
import { createGuideOnce, newIdempotencyKey } from './guideIdempotency';
import CampusEventPicker from './CampusEventPicker';
import CampusEventCard from './CampusEventCard';

/**
 * What the wait screen says while the guide is being written.
 *
 * Measured, not guessed: one generation call took 42s on a real experiment,
 * and a guide that fails validation pays for a second one. That is far too
 * long for a spinner in a button. At 40 seconds an unlabelled spinner reads
 * as a hang, and the student's next move is to press it again or leave.
 *
 * The lines below track what the model is actually asked to produce, in the
 * order the prompt asks for it, so they are a description rather than
 * decoration. They advance on a timer because the call streams nothing back to
 * key off, which means they must never claim a step is *finished*.
 */
const GUIDE_STAGES = [
  'Reading your experiment and what it has to prove',
  'Working out the first move, and the one after that',
  'Writing the email you send, in full and ready to use',
  'Setting what counts as done, and the proof to keep',
];
const STAGE_MS = 9000;

const VARIATION_OPTIONS = [
  { value: 'shorter', label: 'Shorter', description: 'Reduce scope and time commitment' },
  { value: 'detailed', label: 'More detailed', description: 'Add depth, resources, and sub-steps' },
  { value: 'challenging', label: 'More challenging', description: 'Raise the bar and stretch further' },
  { value: 'lower_time', label: 'Lower time commitment', description: 'Fit into a tighter schedule' },
  { value: 'different_style', label: 'Different experiment style', description: 'Try a different approach entirely' },
  { value: 'custom', label: 'Custom instructions', description: 'Write your own direction' },
];

/**
 * MissionGuideGenerator
 * Props:
 *   experiment: Experiments record
 *   existingGuides: MissionGuides[] already saved for this experiment
 *   onGenerated: (newGuide) => void, called after successful save
 *   onClose: () => void
 */
export default function MissionGuideGenerator({ experiment, existingGuides = [], onGenerated, onClose }) {
  const hasExisting = existingGuides.length > 0;
  const [variation, setVariation] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [pendingGuide, setPendingGuide] = useState(null); // guide waiting for active decision
  const [activeDecision, setActiveDecision] = useState(null); // 'make_active' | 'keep_current' | 'compare'
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [campusEvent, setCampusEvent] = useState(null);
  // The picker saying it still has something coming. Generating is never
  // blocked on it; the button underneath just stops claiming to be ready.
  const [pickerBusy, setPickerBusy] = useState(true);
  const generatingRef = useRef(false);
  // Which of the two attempts is running. The second one exists because the
  // model drifts on artifact completeness; when it happens the wait roughly
  // doubles, and saying so beats leaving the student on a stalled estimate.
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!generating) { setStage(0); return; }
    const id = setInterval(() => setStage(s => Math.min(s + 1, GUIDE_STAGES.length - 1)), STAGE_MS);
    return () => clearInterval(id);
  }, [generating]);

  // The picker needs the profile to judge which events are worth a walk across
  // campus. A missing profile just means no events are offered.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me();
        // created_by_id, not user_id: StudentProfile has no user_id field, so
        // the old filter matched nothing and every student looked profile-less.
        const rows = await base44.entities.StudentProfile.filter({ created_by_id: user.id }, '-created_date', 1);
        if (!cancelled) setProfile(rows?.[0] || null);
      } catch {
        if (!cancelled) setProfile(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const nextVersion = (existingGuides.length > 0
    ? Math.max(...existingGuides.map(g => g.version_number || 0)) + 1
    : 1);

  const VARIATION_INSTRUCTIONS = {
    shorter: 'Make this guide shorter and more focused. Reduce the number of steps and time commitment.',
    detailed: 'Make this guide more detailed. Add sub-steps, specific resources, and deeper guidance.',
    challenging: 'Make this guide more challenging. Raise the expectations and push further.',
    lower_time: 'Design this guide for a lower time commitment. Keep it practical for a busy student.',
    different_style: 'Use a completely different approach or experiment style than a typical informational interview or research project.',
    custom: customInstruction,
  };

  const buildPrompt = (repairNote = '') => {
    const variationInstruction = hasExisting && variation
      ? (VARIATION_INSTRUCTIONS[variation] || variation)
      : '';
    const prompt = buildGuidePrompt(experiment, { variationInstruction, version: nextVersion, campusEvent });
    return repairNote ? `${prompt}\n\n${repairNote}` : prompt;
  };

  const handleGenerate = async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setAttempt(0);
    setStage(0);
    setError('');

    let promptContext = buildPrompt();

    try {
      // The model reliably drifts on artifact completeness, so validate and give
      // it one guided retry before surfacing a failure to the student.
      let validation = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        setAttempt(attempt);
        if (attempt > 0) setStage(0);
        // Mission Guides carry the outreach email a student sends to a real
        // professional. Highest-quality tier; see src/lib/llm.js.
        const result = unwrapLLM(await base44.integrations.Core.InvokeLLM({
          prompt: promptContext,
          model: 'gemini_3_1_pro',
          response_json_schema: GUIDE_JSON_SCHEMA,
        }));

        validation = validateGuide(result, { campusEvent });
        if (import.meta.env?.DEV && validation.warnings.length) {
          console.warn('[MissionGuide] repaired:', validation.warnings);
        }
        if (validation.ok) {
          if (attempt > 0) {
            // The student never saw this one. It is still the model drifting.
            logAiFailure('mission_guide', {
              stage: 'validate', codes: guideFailureCodes(validation.errors),
              attempts: attempt + 1, recovered: true, model: 'gemini_3_1_pro',
              experiment_id: experiment?.id,
            });
          }
          break;
        }

        if (attempt === 0) {
          promptContext = buildPrompt(
            `Your previous attempt was rejected for these reasons:\n${validation.errors
              .map(e => `- ${e}`)
              .join('\n')}\nFix every one of them. Write the artifacts out in full.`
          );
        }
      }

      if (!validation.ok) {
        logAiFailure('mission_guide', {
          stage: 'validate', codes: guideFailureCodes(validation.errors),
          attempts: 2, recovered: false, model: 'gemini_3_1_pro',
          experiment_id: experiment?.id,
        });
        throw new Error(validation.errors[0] || 'Generation failed. Please try again.');
      }

      // The calendar record is pinned on after validation, never generated.
      // when and where come from the school's feed, not from the model.
      const guide = campusEvent ? attachCampusEvent(validation.guide, campusEvent) : validation.guide;

      // The key is minted here, with the content, and not a moment later. Every
      // retry of this save reuses it, so a create whose response was lost gets
      // adopted instead of duplicated; generating again replaces the pending
      // guide and mints a fresh key, so a genuinely new guide still saves.
      setPendingGuide({
        ...guide,
        promptContext,
        version_number: nextVersion,
        idempotency_key: newIdempotencyKey(),
      });
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.');
    } finally {
      setGenerating(false);
      generatingRef.current = false;
    }
  };

  const handleSave = async (makeActive) => {
    if (saving || !pendingGuide) return;
    setSaving(true);
    setError('');
    try {
      const user = await base44.auth.me();

      // Create BEFORE deactivating anything.
      //
      // These are two independent writes with no transaction across them, so the
      // ordering is decided by which half-finished state a student can survive.
      // Deactivating first and then failing the create left them with ZERO
      // active guides: the guide they were using was already dead in the
      // database, nothing had replaced it, and the screen still offered "keep my
      // current active guide", which saved a draft and stranded them with
      // nothing. Silent, and only visible after a reload.
      //
      // Rolling the deactivation back on failure was the other option and is
      // worse: the compensating write is only as reliable as the write that just
      // failed, and whatever broke the create (offline, auth, API down) breaks
      // the rollback too. Create-first needs no compensation to be correct.
      //
      // createGuideOnce keeps that ordering exactly as it is. The only thing it
      // adds ahead of the create is a READ: has this pending guide's key
      // already been written? That cannot leave the database in any state,
      // so nothing below needs to change to accommodate it.
      const status = makeActive ? 'active' : 'draft';
      const { row: saved } = await createGuideOnce(
        base44.entities.MissionGuides,
        pendingGuide.idempotency_key,
        {
          user_id: user.id,
          experiment_id: experiment.id,
          path_id: experiment.path_recommendation_id || '',
          guide_title: pendingGuide.guide_title || `Mission Guide v${pendingGuide.version_number}`,
          version_number: pendingGuide.version_number,
          generation_prompt_context: pendingGuide.promptContext,
          objective: pendingGuide.objective,
          steps: pendingGuide.steps,
          deliverable: pendingGuide.deliverable || '',
          proof_requirement: pendingGuide.proof_requirement || '',
          reflection_questions: pendingGuide.reflection_questions || [],
          estimated_time: pendingGuide.estimated_time || '',
          status,
          is_active: makeActive,
        },
        // A retry is free to pick a different option than the attempt whose
        // response was lost, so the adopted row is brought in line with the
        // choice the student just made instead of keeping the vanished one.
        { reconcile: { status, is_active: makeActive } },
      );

      // Now that a replacement exists, retire the guides it replaces. A failure
      // here is survivable in a way the old ordering's failure was not: it
      // leaves two active guides rather than none, and the student still has a
      // working guide either way. So don't throw: the save the student asked
      // for did happen, and reporting it as failed would only invite a retry
      // that creates a duplicate.
      let deactivatedIds = [];
      if (makeActive) {
        const toRetire = existingGuides.filter(g => g.is_active && g.id !== saved.id);
        const results = await Promise.allSettled(toRetire.map(g =>
          base44.entities.MissionGuides.update(g.id, { is_active: false, status: 'inactive' })
        ));
        deactivatedIds = toRetire.filter((_, i) => results[i].status === 'fulfilled').map(g => g.id);
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length) {
          console.error(
            `[MissionGuide] saved ${saved.id} but could not deactivate ${failed.length} previous guide(s); experiment ${experiment.id} now shows more than one active guide:`,
            failed.map(f => f.reason)
          );
        }
      }

      // Report only what actually landed in the database, so the parent's
      // guidesMap cannot claim a guide was retired when the update for it failed.
      onGenerated(saved, makeActive, deactivatedIds);
    } catch (err) {
      // Nothing the student can see was written: the create is still the first
      // write, so a throw here leaves the database holding what it held before,
      // and the parent's guidesMap, which is only ever touched on success,
      // still matches it. The decision screen's "you already have an active
      // guide" is therefore still true, and the student can simply choose again.
      //
      // The one case where that is not literally true is the case this catch
      // used to make expensive: the create landed and its response was lost. The
      // row exists, we never saw it, and the honest thing is that the retry
      // finds it by key and adopts it rather than writing a second copy.
      console.error('[MissionGuide] save failed:', err);
      setError("We couldn't save your guide. Nothing was lost. Choose an option above to try again.");
      setActiveDecision(null);
      setSaving(false);
    }
  };

  // ── Step 3: Active decision ───────────────────────────────────────────────
  if (pendingGuide && !activeDecision) {
    const hasActive = existingGuides.some(g => g.is_active);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="tp-section text-[color:var(--surface-dark-900)]">Guide generated</h2>
            <button onClick={onClose}><X size={20} className="text-[color:var(--ink-500)]" /></button>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-4 mb-5">
            <p className="tp-eyebrow text-[color:var(--ink-500)] mb-1">Version {pendingGuide.version_number}</p>
            <p className="tp-card text-[color:var(--surface-dark-900)]">{pendingGuide.guide_title}</p>
            <p className="tp-body text-[color:var(--ink-500)] mt-1">{pendingGuide.objective}</p>
            <div className="tp-meta flex gap-3 mt-2 text-[color:var(--ink-400)]">
              <span>{pendingGuide.steps?.length} steps</span>
              {pendingGuide.estimated_time && <span>· {pendingGuide.estimated_time}</span>}
            </div>
            {pendingGuide.steps?.[0] && (
              <div className="mt-3 rounded-lg border border-[color:var(--ink-200)] bg-white p-3">
                <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-500, var(--brand-gold-500))' }}>
                  Start here · {pendingGuide.steps[0].estimated_minutes} min
                </p>
                <p className="tp-body font-semibold text-[color:var(--surface-dark-900)] mt-0.5">{pendingGuide.steps[0].title}</p>
                {pendingGuide.steps[0].artifact?.kind !== 'none' && (
                  <p className="tp-meta text-[color:var(--ink-500)] mt-1">Comes pre-written. You fill in the blanks.</p>
                )}
                {pendingGuide.steps[0].campus_event && (
                  <div className="mt-2">
                    <CampusEventCard event={pendingGuide.steps[0].campus_event} college={profile?.college} compact />
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="tp-body font-semibold text-[color:var(--ink-700)] mb-3">
            {hasActive ? 'You already have an active guide. What would you like to do?' : 'Set this as your active guide?'}
          </p>

          <div className="space-y-2 mb-5">
            <button
              onClick={() => { setActiveDecision('make_active'); handleSave(true); }}
              disabled={saving}
              className="tp-body w-full rounded-xl border-2 px-4 py-3 font-semibold text-left transition hover:bg-[#F8ECEF] disabled:opacity-60"
              style={{ borderColor: 'var(--brand-navy-700)', color: 'var(--brand-navy-700)' }}>
              Make this the active guide
              {hasActive && <span className="tp-meta block font-normal text-[color:var(--warning-700)] mt-0.5">Will deactivate your current guide</span>}
            </button>
            <button
              onClick={() => { setActiveDecision('keep_current'); handleSave(false); }}
              disabled={saving}
              className="tp-body w-full rounded-xl border border-[color:var(--ink-200)] px-4 py-3 font-semibold text-[color:var(--ink-700)] text-left transition hover:bg-[color:var(--ink-50)] disabled:opacity-60">
              {hasActive ? 'Keep my current active guide' : 'Save as draft'}
              <span className="tp-meta block font-normal text-[color:var(--ink-400)] mt-0.5">New guide saved as draft</span>
            </button>
            {hasActive && (
              <button
                onClick={() => { setActiveDecision('compare'); handleSave(false); }}
                disabled={saving}
                className="tp-body w-full rounded-xl border border-[color:var(--ink-200)] px-4 py-3 font-semibold text-[color:var(--ink-500)] text-left transition hover:bg-[color:var(--ink-50)] disabled:opacity-60">
                Compare guides first
                <span className="tp-meta block font-normal text-[color:var(--ink-400)] mt-0.5">Opens comparison view after saving</span>
              </button>
            )}
          </div>

          {saving && (
            <div className="tp-body flex items-center justify-center gap-2 text-[color:var(--ink-500)]">
              <Loader2 size={15} className="animate-spin" /> Saving guide...
            </div>
          )}
          {error && <p className="tp-body text-red-600 mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  // ── While the guide is being written ──────────────────────────────────────
  //
  // A screen of its own rather than a spinner in the button. The call was
  // measured at 42 seconds, and a validation retry doubles it; nothing else in
  // the product asks a student to wait that long at a control that still looks
  // pressable. The options they picked are gone from view on purpose: there is
  // nothing to change now, and leaving them there invites a second press.
  if (generating) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
        <div className="w-full max-w-lg rounded-[24px] bg-white p-6 text-center sm:p-8" role="status" aria-live="polite">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--ink-100)' }}>
            <Wand2 size={24} style={{ color: 'var(--brand-navy-700)' }} aria-hidden="true" />
          </div>

          <h2 className="tp-section mt-5 text-[color:var(--surface-dark-900)]">
            {attempt > 0 ? 'Rewriting a section that came back short' : 'Writing your Mission Guide'}
          </h2>
          <p className="tp-body mx-auto mt-2 max-w-sm text-[color:var(--ink-500)]">
            {experiment.title}
          </p>

          {/* Reserved so the line changing underneath never moves the dialog. */}
          <p className="tp-body mx-auto mt-5 flex min-h-[40px] max-w-sm items-center justify-center text-[color:var(--ink-700)]">
            {GUIDE_STAGES[stage]}
          </p>

          <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full" style={{ background: 'var(--ink-200)' }}>
            <div className="picker-progress h-full rounded-full" style={{ background: 'var(--brand-navy-700)' }} />
          </div>

          <p className="tp-meta mt-5 text-[color:var(--ink-400)]">
            {attempt > 0
              ? 'This one needs a second pass, so it will take about another forty seconds.'
              : 'This usually takes about forty seconds. It writes the whole guide in one go: steps, the email, and what counts as proof.'}
          </p>

          {/* A way out. Forty seconds with no exit is a trap, and the previous
              version had one too, and its close button was disabled for the whole
              call. Backing out is safe: nothing is written until the student
              picks what to do with the finished guide, so leaving just drops a
              result that was never saved. */}
          <button
            onClick={onClose}
            className="tp-meta mt-6 py-2 font-semibold text-[color:var(--ink-500)] underline underline-offset-2 hover:text-[color:var(--ink-700)]"
          >
            Stop and go back
          </button>
          <p className="tp-meta mt-2 text-[color:var(--ink-400)]">
            Nothing is saved until you choose what to do with it.
          </p>
        </div>
      </div>
    );
  }

  // ── Step 1 & 2: Generate UI ───────────────────────────────────────────────
  //
  // A student who has already chosen an event is not waiting for anything, even
  // if the picker is still ranking behind them, so the button stays ordinary.
  const waitingOnCalendar = pickerBusy && !campusEvent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="tp-section text-[color:var(--surface-dark-900)]">
            {hasExisting ? 'Generate Another Mission Guide' : 'Generate Mission Guide'}
          </h2>
          <button onClick={onClose} disabled={generating}><X size={20} className="text-[color:var(--ink-500)]" /></button>
        </div>
        <p className="tp-lead text-[color:var(--ink-500)] mb-5">
          {hasExisting
            ? `Version ${nextVersion} will be created. Previous guides are preserved.`
            : 'AI will generate a step-by-step guide for this experiment.'}
        </p>

        {/* Experiment context */}
        <div className="rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-3 mb-5">
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-0.5">Experiment</p>
          <p className="tp-body font-semibold text-[color:var(--surface-dark-900)]">{experiment.title}</p>
          {experiment.path_name && <p className="tp-meta" style={{ color: 'var(--brand-navy-700)' }}>{experiment.path_name}</p>}
        </div>

        {/* Real campus events: gives the first step a date the student didn't set */}
        <CampusEventPicker
          pathName={experiment.path_name}
          selected={campusEvent}
          onSelect={setCampusEvent}
          disabled={generating}
          onBusy={setPickerBusy}
        />

        {/* Variation picker: only for subsequent guides */}
        {hasExisting && (
          <div className="mb-5">
            <p className="tp-body font-semibold text-[color:var(--ink-700)] mb-2">What should be different?</p>
            <div className="space-y-2">
              {VARIATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setVariation(variation === opt.value ? '' : opt.value)}
                  className="tp-body w-full rounded-xl border px-4 py-3 text-left transition"
                  style={variation === opt.value
                    ? { borderColor: 'var(--brand-navy-700)', background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }
                    : { borderColor: 'var(--ink-200)', background: 'white', color: 'var(--ink-700)' }}>
                  <span className="font-semibold">{opt.label}</span>
                  <span className="tp-meta block text-[color:var(--ink-400)] mt-0.5">{opt.description}</span>
                </button>
              ))}
            </div>
            {variation === 'custom' && (
              <textarea
                rows={3}
                placeholder="Describe what you want to change or focus on..."
                value={customInstruction}
                onChange={e => setCustomInstruction(e.target.value)}
                className="mt-3 w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
              />
            )}
          </div>
        )}

        {error && (
          <div className="tp-body mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-red-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <div>
              <p>{error}</p>
              <button onClick={handleGenerate} className="mt-1 font-semibold underline">Retry</button>
            </div>
          </div>
        )}

        {/*
          Still pressable while the calendar is being read. An event is an
          enhancement and nothing in this product should hold a student at a
          disabled button. What changes is that the button says what it will
          actually do if pressed right now, which is the part that was missing:
          it read "Generate Mission Guide" in exactly the same words it uses
          when everything is ready, so a student looking at a loading panel had
          no reason to think waiting bought them anything.
        */}
        {waitingOnCalendar && (
          <p className="tp-meta mb-2.5 text-center text-[color:var(--ink-500)]">
            Your campus calendar is still loading. Wait for it and your first step gets a real
            date, set by somebody other than you.
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={generating}
            className="tp-body flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-3 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] disabled:opacity-60">
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || (variation === 'custom' && !customInstruction.trim())}
            className="tp-body flex-1 rounded-[10px] py-3 font-semibold text-white transition disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            {generating ? (
              <><Loader2 size={15} className="animate-spin" /> Generating...</>
            ) : (
              <><Wand2 size={15} /> {waitingOnCalendar
                ? 'Generate without an event'
                : hasExisting ? 'Generate Another Mission Guide' : 'Generate Mission Guide'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}