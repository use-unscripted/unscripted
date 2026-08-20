/**
 * Weekly reflection, asked one question at a time instead of eight blank
 * textareas on one screen.
 *
 * The number this page exists to move: no StudentProfile has ever been updated
 * on a later day than it was created, and this entity has never had a row. A
 * student at the end of a tiring week does not fill in eight boxes, so the flow
 * leads with things that are tappable and keeps the single genuinely open
 * question for last.
 *
 * The rule that makes this a win rather than a regression: **saving is
 * reachable from the first question onward.** A four-screen mandatory flow
 * would cost more interactions than the old form did. "Done for now" appears on
 * every step except the experiment picker, gated by the same `hasContent`
 * expression the save uses, so the button and the rule can never disagree.
 *
 * Built on src/components/guided/GuidedPieces.jsx, the same pieces
 * AddProofFlow uses. Two things AddProofFlow does are deliberately NOT copied,
 * because both are modal-only and fail silently on a page:
 *   - its scroll-to-top reaches for `closest('[data-modal-scroll]')`; there is
 *     no such element on a page and the optional chain swallows the miss, so a
 *     student on a phone lands mid-step. This scrolls the window instead.
 *   - its sticky footer's `-mx-6 sm:-mx-8` has to cancel the container's
 *     padding exactly. There is no sticky footer here at all, so deleting the
 *     invariant beats matching it.
 */
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { reportAiFailure } from '@/lib/ai-failures';
import {
  ArrowRight, CheckCircle, Plus, Search, X, ExternalLink, Trash2,
  ChevronLeft, ChevronRight, Loader2, AlertCircle, Save, Sparkles,
} from 'lucide-react';
import SoftDeleteConfirm, { softDeletePayload } from '@/components/SoftDeleteConfirm';
import PageHeader from '@/components/PageHeader';
import { SkCards } from '@/components/PageSkeleton';
import { useNavigate } from 'react-router-dom';
import PathSwitcher from '@/components/PathSwitcher';
import { ProgressBar, OptionRow, GuidedStyles } from '@/components/guided/GuidedPieces';
import { linksForExperiment } from '@/lib/career-cycle';
// Week keys, and the parse that turns a Base44 timestamp into the right
// instant. Both used to live in this file; they moved so they could be tested.
// See src/lib/dates.js for what Base44 sends and why it cannot go straight into
// `new Date()`.
import { getMonday, fmtWeek, sameWeek } from '@/lib/dates';
import { activityFor } from '@/lib/weekly-activity';
import { readReflectionDraft, writeReflectionDraft, clearReflectionDraft } from '@/lib/student-drafts';

// ── Small helpers ──────────────────────────────────────────────────────────────
const isActive = (r) => !r?.deletion_status || r.deletion_status === 'active';

// The entity stores completed_items / avoided_items as string arrays. Nothing
// in this component ever puts one of those arrays into a text control. That is
// what used to throw a TypeError in the component body and white-screen the
// page the moment a saved reflection was opened for editing. Arrays live in
// array state, prose lives in its own string state, and this is the only place
// the two meet.
function toStringArray(value) {
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim());
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function splitLines(text) {
  return String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
}

function dedupe(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

const inputCls = 'w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm text-[color:var(--surface-dark-900)] placeholder-[color:var(--ink-400)] outline-none focus:border-[color:var(--brand-navy-900)]';
const bigInputCls = 'w-full rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-4 text-base text-[color:var(--surface-dark-900)] placeholder-[color:var(--ink-400)] outline-none focus:border-[color:var(--brand-navy-900)]';

// ── Step 1 options ─────────────────────────────────────────────────────────────
// Asked, never asserted. The page cannot substantiate "nothing got logged this
// week" (the first option here concedes as much) so it opens with a question
// and lets the student say which of these it was.
//
// `text` is what gets stored, and it is also how a saved row is read back into
// a selection. Changing one of these strings orphans reflections saved under
// the old wording: they will reappear as free text rather than as a selection.
const WEEK_OPTIONS = [
  {
    value: 'unlogged', bucket: 'completed', text: 'Did work this week but did not log it',
    label: "I did things, I just didn't log them", desc: 'Common. It still counts.',
  },
  {
    value: 'stuck', bucket: 'avoided', text: 'Started something and got stuck',
    label: 'I started and got stuck', desc: 'Where it stalled is worth more than that it stalled.',
  },
  {
    value: 'nothing', bucket: 'avoided', text: 'Did not get to it this week',
    label: "I didn't get to it", desc: 'One week is a week, not a verdict.',
  },
  {
    value: 'real', bucket: 'completed', text: 'Got real work done this week',
    label: 'I got real work done', desc: 'Say what it was.', opensFreeText: true,
  },
];

const COMPLETED_TEXTS = new Set(WEEK_OPTIONS.filter(o => o.bucket === 'completed').map(o => o.text));
const AVOIDED_TEXTS = new Set(WEEK_OPTIONS.filter(o => o.bucket === 'avoided').map(o => o.text));
const ALL_OPTION_TEXTS = new Set(WEEK_OPTIONS.map(o => o.text));

const OTHER_KEY = '__other';

// The only stems in the whole flow, on the only genuinely open question. They
// are inserted into the box to be edited, not options to be picked. A
// reflection that can be completed by tapping is not a reflection.
const STEMS = [
  'I was surprised that',
  'I expected … but',
  'The part I actually liked was',
  'What I got wrong was',
];

// ── Path fit ───────────────────────────────────────────────────────────────────
// The whole loop ends in "Adjust", and the pitch is that we can tell a student
// whether a path fits. A reflection that collects no path signal cannot feed
// either. One tap, one string, into `path_feedback`, which already exists on
// the entity, so this needs no schema change.
//
// THIS IS A SIGNAL, NOT A DECISION, and that split is deliberate. Continue /
// adjust / stop is asked in exactly one place: the end-of-experiment conclusion
// (`/reflect` → DecisionStep), which is the only surface that acts on the answer
// it pauses or promotes the path, closes the CareerCycle and opens the next
// one. Asking it weekly would let one slow week read as quitting a path, and
// would produce an answer nothing carries out. If a fourth version of this
// question shows up, delete it rather than adding a storage location.
//
// The three values are the `interest_direction` enum (more / same / less) the
// conclusion form already writes, so a weekly signal and a final answer are in
// the same units and a trend across a cycle is one query instead of prose
// matching. Both are written: the typed field for reading, the sentence in
// `path_feedback` for the student and for the summary prompt.
//
// As with WEEK_OPTIONS, `text` is both what gets stored and how a saved row is
// read back into a selection; changing the wording orphans existing answers.
const PATH_FIT_OPTIONS = [
  { value: 'more', text: 'Fits better than I expected', label: 'More than I expected', desc: 'This week made the path look stronger.' },
  { value: 'same', text: 'About what I expected', label: 'About the same', desc: 'Nothing moved much either way.' },
  { value: 'less', text: 'Fits less than I expected', label: 'Less than I expected', desc: 'Worth saying out loud early.' },
];
const PATH_FIT_TEXTS = new Set(PATH_FIT_OPTIONS.map(o => o.text));

// Fields the guided flow no longer asks about. A student who answered them in
// the old eight-textarea form must not lose that answer by opening the row in
// this one, so they are read off the record and written straight back.
// `path_feedback` is deliberately NOT here. The fit step owns it now, and it
// preserves old prose itself rather than carrying it blind.
const CARRIED_FIELDS = ['avoidance_reasons', 'surprises', 'skill_gaps_noticed'];

// ── Local draft ────────────────────────────────────────────────────────────────
// Precedence is explicit and one-directional: a saved row always wins. A draft
// is only ever offered when there is no server row for its week, and it is
// never applied without the student saying so, so a stale draft cannot
// overwrite answers that are already saved.
//
// Where it is kept, who it belongs to and when it dies are all in
// src/lib/student-drafts.js. Read that before changing anything here: the draft
// is tied to one signed-in student, it goes on sign-out, and it expires. Those
// rules exist because this text is a student's private career doubts and the
// machine they typed it on is often not theirs.
function loadDraft(userId) {
  const d = readReflectionDraft(userId);
  return d && typeof d.week_start === 'string' ? d : null;
}

// The activity read-out (what this student actually logged against this
// experiment during this week) is src/lib/weekly-activity.js. When there is
// anything in it, step 1 shows it back to them instead of the canned options:
// their own record beats a guess about their week.

// ── Success Toast ──────────────────────────────────────────────────────────────
function SuccessToast({ experiment, mission, onOpenExp, onDismiss }) {
  return (
    <div role="alert" className="fixed bottom-24 right-4 z-[100] max-w-sm w-[calc(100%-2rem)] sm:bottom-6 sm:right-6 sm:w-full rounded-[var(--r-surface)] bg-white border border-green-100 shadow-2xl p-5 flex flex-col gap-3"
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--success-50)' }}>
          <CheckCircle size={20} className="text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="tp-card text-[color:var(--surface-dark-900)]">Reflection saved.</p>
          {experiment && <p className="tp-meta mt-1 truncate text-[color:var(--ink-500)]">Experiment: {experiment.title}</p>}
          {mission && <p className="tp-meta truncate text-[color:var(--ink-400)]">Mission: {mission.title}</p>}
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)]">
          <X size={16} />
        </button>
      </div>
      {/* No "View Reflection" button: saving already switches to History with
          the row on screen, so it did nothing at all when pressed. */}
      {experiment && (
        <button onClick={onOpenExp} className="tp-meta w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] py-2.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
          Open Experiment
        </button>
      )}
    </div>
  );
}

// ── The guided flow ────────────────────────────────────────────────────────────
function ReflectionFlow({ experiments, missions, proofs, initialData, draft, userId, onSaved, onDraftWritten }) {
  const isEdit = !!initialData?.id;

  // week_start on an edit comes off the record and is never recomputed.
  // Recomputing it while "fixing getMonday" would quietly re-file a historical
  // reflection under the current week.
  const weekStart = initialData?.week_start || draft?.week_start || getMonday(new Date());

  const activityData = useMemo(() => ({ missions, proofs }), [missions, proofs]);

  // One lazy seed, run once per mounted record. The page keys this component on
  // the record id, so switching between "new" and an existing reflection
  // remounts it and re-runs this rather than leaving the previous answers in
  // the boxes.
  const [seed] = useState(() => {
    const startExpId = initialData?.experiment_id || draft?.experiment_id
      || (experiments.length === 1 ? experiments[0].id : '');

    const activityLabels = activityFor(activityData, startExpId, weekStart).map(i => i.label);
    const labels = new Set(activityLabels);

    if (draft && !isEdit) {
      // A draft's ticked items are labels, and the activity list they came from
      // is recomputed live. Editing a mission moves it out of the week and its
      // label stops matching. Orphans go into the free-text box rather than
      // vanishing, the same routing an edited record gets below.
      const draftPicks = Array.isArray(draft.picks) ? draft.picks : [];
      const orphans = draftPicks.filter(v => !labels.has(v));
      const draftFree = [draft.freeText || '', ...orphans].filter(Boolean).join('\n');
      return {
        expId: startExpId,
        missionId: draft.mission_id || '',
        weekChoice: draft.weekChoice || '',
        picks: draftPicks.filter(v => labels.has(v)),
        otherOpen: !!draft.otherOpen || orphans.length > 0,
        freeText: draftFree,
        avoidedProse: draft.avoidedProse || '',
        energySources: draft.energySources || '',
        energyDrains: draft.energyDrains || '',
        pathFit: draft.pathFit || '',
        pathFitProse: draft.pathFitProse || '',
        lessons: draft.lessons || '',
        nextChanges: draft.nextChanges || '',
        summary: draft.summary || '',
        adjustments: toStringArray(draft.adjustments),
      };
    }

    const completed = toStringArray(initialData?.completed_items);
    const avoided = toStringArray(initialData?.avoided_items);

    const cannedText = completed.find(v => COMPLETED_TEXTS.has(v)) || avoided.find(v => AVOIDED_TEXTS.has(v)) || '';
    const freeLines = completed.filter(v => !labels.has(v) && !ALL_OPTION_TEXTS.has(v));

    // path_feedback is one string. A line matching an option restores the
    // selection; anything else is prose from the old form and stays editable
    // rather than being replaced by a canned label.
    const fitLines = splitLines(initialData?.path_feedback);

    return {
      expId: startExpId,
      missionId: initialData?.mission_id || '',
      weekChoice: WEEK_OPTIONS.find(o => o.text === cannedText)?.value || '',
      // A new reflection starts with everything the student logged already
      // ticked, so the question is "untick anything that isn't part of this"
      // rather than "re-enter your own week". An edit restores exactly what was
      // saved instead.
      picks: isEdit ? completed.filter(v => labels.has(v)) : activityLabels,
      otherOpen: freeLines.length > 0,
      freeText: freeLines.join('\n'),
      // Free prose a student typed into the old "What did you avoid or not
      // finish?" box. It is shown back to them so it is editable rather than
      // invisible, and it is always written back. A canned label is appended
      // alongside it, never over it.
      avoidedProse: avoided.filter(v => !ALL_OPTION_TEXTS.has(v)).join('\n'),
      energySources: initialData?.energy_sources || '',
      energyDrains: initialData?.energy_drains || '',
      // The typed field wins when it is there; the prose match is the fallback
      // for rows written before this step wrote `interest_direction`.
      pathFit: PATH_FIT_OPTIONS.find(o => o.value === initialData?.interest_direction)?.value
        || PATH_FIT_OPTIONS.find(o => fitLines.includes(o.text))?.value
        || '',
      pathFitProse: fitLines.filter(v => !PATH_FIT_TEXTS.has(v)).join('\n'),
      lessons: initialData?.lessons || '',
      nextChanges: initialData?.next_changes || '',
      summary: initialData?.generated_summary || '',
      adjustments: toStringArray(initialData?.path_adjustments),
    };
  });

  const [expId, setExpId] = useState(seed.expId);
  const [missionId, setMissionId] = useState(seed.missionId);
  const [weekChoice, setWeekChoice] = useState(seed.weekChoice);
  const [picks, setPicks] = useState(seed.picks);
  const [otherOpen, setOtherOpen] = useState(seed.otherOpen);
  const [freeText, setFreeText] = useState(seed.freeText);
  const [avoidedProse, setAvoidedProse] = useState(seed.avoidedProse);
  const [energySources, setEnergySources] = useState(seed.energySources);
  const [energyDrains, setEnergyDrains] = useState(seed.energyDrains);
  const [pathFit, setPathFit] = useState(seed.pathFit);
  const [pathFitProse, setPathFitProse] = useState(seed.pathFitProse);
  const [lessons, setLessons] = useState(seed.lessons);
  const [nextChanges, setNextChanges] = useState(seed.nextChanges);

  const [summary, setSummary] = useState(seed.summary);
  const [adjustments, setAdjustments] = useState(seed.adjustments);

  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [genError, setGenError] = useState('');
  const submittingRef = useRef(false);

  const selectedExp = experiments.find(e => e.id === expId) || null;
  const expMissions = missions.filter(m => m.experiment_id === expId && isActive(m));
  const activity = useMemo(() => activityFor(activityData, expId, weekStart), [activityData, expId, weekStart]);
  const activityMode = activity.length > 0;

  // ── Steps ────────────────────────────────────────────────────────────────────
  // The experiment question only exists when there is a choice to make. With
  // exactly one experiment it is answered already and asking would be a screen
  // that costs an interaction and returns nothing.
  const steps = experiments.length > 1
    ? ['experiment', 'week', 'energy', 'fit', 'learn']
    : ['week', 'energy', 'fit', 'learn'];
  const lastIndex = steps.length - 1;
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState('fwd');
  const stepKey = steps[index];

  const advanceRef = useRef(null);
  const cardRef = useRef(null);
  const headingRef = useRef(null);
  const lessonsRef = useRef(null);
  const firstRun = useRef(true);

  useEffect(() => () => clearTimeout(advanceRef.current), []);

  const go = useCallback((to, direction) => {
    clearTimeout(advanceRef.current);
    setError('');
    setDir(direction);
    setIndex(to);
  }, []);
  const next = useCallback(() => go(Math.min(index + 1, lastIndex), 'fwd'), [go, index, lastIndex]);
  const back = useCallback(() => go(Math.max(index - 1, 0), 'back'), [go, index]);

  // A new question starts at the top of the card. This is a page, not a modal:
  // the window is what scrolls, and the element is this component's own div, so
  // there is no selector to miss and nothing for an optional chain to swallow.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const el = cardRef.current;
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
    // Changing step unmounts whatever had focus, dropping it to <body> and
    // sending the next Tab into the page behind. Move it to the new question,
    // unless the step autofocused a field of its own.
    const active = document.activeElement;
    if (!active || active === document.body) headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  // ── What the student has actually said ───────────────────────────────────────
  const chosen = WEEK_OPTIONS.find(o => o.value === weekChoice) || null;
  const fitChoice = PATH_FIT_OPTIONS.find(o => o.value === pathFit) || null;

  // ONE definition of "the free-text box is open", read by the step that
  // renders it and by the payload that saves it. They must never disagree:
  // text behind a box the student has closed is text they can no longer see,
  // and saving it files words under a week they just said they didn't get to.
  const freeTextOpen = activityMode ? otherOpen : (!!chosen?.opensFreeText || otherOpen);

  const pickedLabels = activityMode ? picks : [];
  const freeLines = freeTextOpen ? splitLines(freeText) : [];

  const completedItems = dedupe([
    ...pickedLabels,
    ...(chosen?.bucket === 'completed' ? [chosen.text] : []),
    ...freeLines,
  ]);
  const avoidedItems = dedupe([
    ...(chosen?.bucket === 'avoided' ? [chosen.text] : []),
    ...splitLines(avoidedProse),
  ]);
  const pathFeedback = [fitChoice?.text, ...splitLines(pathFitProse)].filter(Boolean).join('\n');

  // One definition of "there is something here", used by every Done-for-now
  // button and by the save itself, so nothing is ever enabled and then
  // rejected. A single tap on step 1 satisfies it.
  const hasContent = !!(
    completedItems.length
    || avoidedItems.length
    || energySources.trim()
    || energyDrains.trim()
    || pathFeedback
    || lessons.trim()
    || nextChanges.trim()
  );

  // Has the student changed anything from what this opened with? Logged
  // activity arrives pre-ticked, so `hasContent` is true before they touch
  // anything and cannot on its own mean "there is something worth saving".
  //
  // A resumed draft is the exception: it IS the seed, so nothing would ever
  // read as changed, and the student who just pressed "Pick it up" could not
  // save the work they came back for. Picking it up is the deliberate act.
  const resumedDraft = !isEdit && !!draft;
  const touched = resumedDraft
    || expId !== seed.expId
    || missionId !== seed.missionId
    || weekChoice !== seed.weekChoice
    || otherOpen !== seed.otherOpen
    || freeText !== seed.freeText
    || avoidedProse !== seed.avoidedProse
    || energySources !== seed.energySources
    || energyDrains !== seed.energyDrains
    || pathFit !== seed.pathFit
    || pathFitProse !== seed.pathFitProse
    || lessons !== seed.lessons
    || nextChanges !== seed.nextChanges
    || summary !== seed.summary
    || picks.length !== seed.picks.length
    || picks.some(p => !seed.picks.includes(p));

  // `touched` gates the save, not just the draft. Without it a pre-ticked
  // activity read-out could be saved with zero taps, filing a row that only
  // echoes rows already in the database, and "WeeklyReflections finally has
  // rows" is precisely the number that must not be an echo.
  const canSave = !!expId && hasContent && touched && !saving;

  // ── Draft ────────────────────────────────────────────────────────────────────
  // Only a new reflection is drafted. An edit already has a server row, and a
  // draft that could shadow it is exactly the overwrite this is meant to avoid.
  // Merely opening the page is not "you started a reflection".
  //
  // No signed-in user, no draft. There is no shared key to fall back to, and
  // writing private text somewhere nobody owns is the bug this replaced.
  useEffect(() => {
    if (isEdit || !touched || !hasContent || !userId) return;
    const t = setTimeout(() => {
      writeReflectionDraft(userId, {
        week_start: weekStart,
        experiment_id: expId,
        mission_id: missionId,
        weekChoice, picks, otherOpen, freeText, avoidedProse,
        energySources, energyDrains, pathFit, pathFitProse, lessons, nextChanges,
        // A generated summary costs a model call. Leaving it out meant
        // generating insights and then closing the tab threw them away.
        summary, adjustments,
        saved_at: new Date().toISOString(),
      });
      onDraftWritten?.();
    }, 600);
    return () => clearTimeout(t);
  }, [isEdit, touched, hasContent, userId, weekStart, expId, missionId, weekChoice, picks, otherOpen,
    freeText, avoidedProse, energySources, energyDrains, pathFit, pathFitProse, lessons,
    nextChanges, summary, adjustments, onDraftWritten]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const chooseExperiment = (id) => {
    if (id !== expId) {
      setExpId(id);
      // A mission has to belong to the experiment it is filed under, so
      // changing the experiment drops a mission that no longer applies.
      setMissionId('');
      // And the logged activity is a different experiment's activity now.
      setPicks(isEdit ? [] : activityFor(activityData, id, weekStart).map(i => i.label));
    }
    setError('');
    clearTimeout(advanceRef.current);
    advanceRef.current = setTimeout(() => { setDir('fwd'); setIndex(i => Math.min(i + 1, lastIndex)); }, 230);
  };

  const chooseWeek = (value) => {
    setWeekChoice(prev => (prev === value ? '' : value));
    setError('');
  };

  const togglePick = (label) => {
    setPicks(prev => (prev.includes(label) ? prev.filter(v => v !== label) : [...prev, label]));
    setError('');
  };

  const choosePathFit = (value) => {
    setPathFit(prev => (prev === value ? '' : value));
    setError('');
  };

  const insertStem = (stem) => {
    setLessons(prev => {
      const base = prev.replace(/\s+$/, '');
      return base ? `${base}\n${stem} ` : `${stem} `;
    });
    requestAnimationFrame(() => {
      const el = lessonsRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const buildPayload = (userId) => {
    const payload = {
      user_id: userId,
      experiment_id: expId || undefined,
      mission_id: missionId || undefined,
      path_name: selectedExp?.path_name || initialData?.path_name || '',
      // Never recomputed on an edit.
      week_start: weekStart,
      completed_items: completedItems,
      avoided_items: avoidedItems,
      energy_sources: energySources.trim() || undefined,
      energy_drains: energyDrains.trim() || undefined,
      // An edit clears these explicitly instead of omitting them. An omitted key
      // is a partial update, so a student who taps their answer off and saves
      // would keep the old one in the database. A stale path signal is worse
      // than none. Both empty values are accepted by the entity (verified
      // against the dev data environment).
      path_feedback: pathFeedback || (isEdit ? '' : undefined),
      // Same tap, typed. Read by anything comparing weekly signal against the
      // conclusion's own answer; the sentence above stays for the student.
      interest_direction: pathFit || (isEdit ? '' : undefined),
      lessons: lessons.trim() || undefined,
      next_changes: nextChanges.trim() || undefined,
      generated_summary: summary.trim() || undefined,
      path_adjustments: adjustments,
    };
    // Answers this flow does not ask about, written back exactly as found.
    CARRIED_FIELDS.forEach(f => {
      const v = initialData?.[f];
      if (typeof v === 'string' && v.trim()) payload[f] = v;
    });
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    return payload;
  };

  const save = async () => {
    if (submittingRef.current) return;
    if (!expId) { setError('Pick the experiment this is about first.'); return; }
    if (!hasContent) { setError('Answer any one thing and this will save.'); return; }
    // The same rule the button enforces, so nothing is ever enabled and then
    // rejected, or rejected and then saved.
    if (!touched) { setError('Nothing has changed yet. Tap or type one thing and this will save.'); return; }

    // A mission must belong to the experiment it is filed under.
    if (missionId) {
      const mission = missions.find(m => m.id === missionId);
      if (mission && mission.experiment_id !== expId) {
        setError('That mission belongs to a different experiment.');
        return;
      }
    }

    setError('');
    submittingRef.current = true;
    setSaving(true);

    try {
      const user = await base44.auth.me();
      const payload = buildPayload(user.id);
      // Cycle / path relationships, resolved from the experiment this reflection
      // is filed under. Never overwrites an answer the student typed.
      Object.assign(payload, await linksForExperiment(selectedExp, missions.find(m => m.id === missionId)));
      console.log('[WeeklyReflectionPage] Save: week_start=' + payload.week_start + ' experiment_id=' + (payload.experiment_id || 'none'));

      let saved;
      if (isEdit) {
        await base44.entities.WeeklyReflections.update(initialData.id, payload);
        saved = { ...initialData, ...payload };
      } else {
        saved = await base44.entities.WeeklyReflections.create(payload);
        // A submitted reflection is on the server. Nothing is owed to the
        // copy on the device, and leaving it there is what put private text
        // in front of the next person at the keyboard.
        clearReflectionDraft(user.id);
      }
      console.log('[WeeklyReflectionPage] Save: success, record_id=' + saved?.id);
      onSaved(saved);
    } catch (err) {
      console.error('[WeeklyReflectionPage] Save failed:', err?.message || err);
      setError("We couldn't save this. Your answers are still here. Try again.");
      setSaving(false);
      submittingRef.current = false;
    }
  };

  const generate = async () => {
    if (!expId || !hasContent || generating) return;
    setGenerating(true);
    setGenError('');
    try {
      // Named fields, not the whole component state. Stringifying state sent
      // ids, draft flags and step bookkeeping to the model and cost tokens on
      // every one of them.
      //
      // Summarises a reflection the student just wrote, back to them. Short,
      // stays in the app. Cheap tier; see src/lib/llm.js.
      const result = unwrapLLM(await base44.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash',
        prompt: [
          'You are Unscripted. A college student is testing a career path with a real-world experiment.',
          'Using only their answers below, write: 1) a direct summary of what this week actually taught them,',
          '2) path-fit adjustments: what looks like a better or worse fit and why, 3) one change to their workload,',
          '4) a specific suggestion for next week. Be honest and concrete. Never shame them for a slow week.',
          '',
          `Path: ${selectedExp?.path_name || 'not recorded'}`,
          `Experiment: ${selectedExp?.title || 'not recorded'}`,
          `Week starting: ${weekStart}`,
          `Got done: ${completedItems.join('; ') || 'nothing recorded'}`,
          `Avoided or unfinished: ${avoidedItems.join('; ') || 'nothing recorded'}`,
          `Gave energy: ${energySources.trim() || 'not recorded'}`,
          `Drained energy: ${energyDrains.trim() || 'not recorded'}`,
          // The student's own read on path fit, so the model reports it back
          // rather than inferring it from what they happened to write.
          `How the path fits, in their words: ${pathFeedback || 'not recorded'}`,
          `What they learned: ${lessons.trim() || 'not recorded'}`,
          `What they want to change: ${nextChanges.trim() || 'not recorded'}`,
          PLAIN_PROSE_RULES,
        ].join('\n'),
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            path_adjustments: { type: 'array', items: { type: 'string' } },
          },
        },
      }));
      setSummary(typeof result?.summary === 'string' ? result.summary : '');
      setAdjustments(toStringArray(result?.path_adjustments));
    } catch {
      // Without this the promise rejected unhandled, the spinner stopped, and
      // nothing on screen said why. The message is no longer printed: this
      // prompt carries the student's own reflection text, which is the most
      // private writing in the product, so a server error can echo it back.
      reportAiFailure('weekly_reflection', {
        stage: 'invoke_llm',
        codes: ['unexpected_error'],
        model: 'gemini_3_flash',
      });
      setGenError("Couldn't generate insights just now. Your answers are safe. Save them and try again later.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  // Two different guards, because the two shortcuts are stolen from different
  // things:
  //
  //   Enter is the default activation of a focused button or link. Calling
  //   preventDefault() on it cancels the click. A keyboard user pressing Enter
  //   on "Back" would move FORWARD, and Enter on "Done for now" would not save.
  //   So Enter is left alone on anything that activates on Enter, and on the
  //   controls that own it (textarea inserts a newline, select opens).
  //
  //   Number keys are stolen only by text entry. They stay live while a button
  //   has focus, so tapping an option with the mouse and then pressing 2 still
  //   works.
  useEffect(() => {
    const onKey = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      const tag = e.target?.tagName;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
      const activatable = tag === 'BUTTON' || tag === 'A' || e.target?.isContentEditable;

      if (e.key === 'Enter' && !e.shiftKey) {
        if (activatable || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (index < lastIndex && (stepKey !== 'experiment' || expId)) { e.preventDefault(); next(); }
        return;
      }
      if (typing) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      if (stepKey === 'experiment') {
        if (n <= experiments.length) chooseExperiment(experiments[n - 1].id);
      } else if (stepKey === 'week') {
        if (activityMode) {
          if (n <= activity.length) togglePick(activity[n - 1].label);
          else if (n === activity.length + 1) setOtherOpen(o => !o);
        } else if (n <= WEEK_OPTIONS.length) {
          chooseWeek(WEEK_OPTIONS[n - 1].value);
        }
      } else if (stepKey === 'fit') {
        if (n <= PATH_FIT_OPTIONS.length) choosePathFit(PATH_FIT_OPTIONS[n - 1].value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Buttons ──────────────────────────────────────────────────────────────────
  const backButton = (
    <button onClick={back} disabled={saving}
      className="flex items-center gap-1 rounded-[var(--r-control)] border px-4 py-3 text-sm font-semibold disabled:opacity-50"
      style={{ borderColor: 'var(--ink-200)', color: 'var(--text-primary)' }}>
      <ChevronLeft size={15} /> Back
    </button>
  );

  const continueButton = (enabled, label = 'Continue') => (
    <button onClick={next} disabled={!enabled}
      className="flex flex-1 items-center justify-center gap-2 rounded-[var(--r-control)] py-3 text-sm font-semibold text-white disabled:opacity-40"
      style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
      {label} <ChevronRight size={15} />
    </button>
  );

  // The whole point of the rewrite. Without this, four mandatory screens would
  // cost a student more taps than the old one-page form did.
  // basis-full drops this onto its own line below Back/Continue on a phone,
  // where three buttons side by side wraps the label onto two lines.
  const doneForNow = (primary) => (
    <button onClick={save} disabled={!canSave}
      className={`flex items-center justify-center gap-2 rounded-[var(--r-control)] py-3 text-sm font-semibold disabled:opacity-40 ${primary ? 'flex-1 text-white' : 'basis-full px-4 border sm:basis-auto'}`}
      style={primary
        ? { background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }
        : { borderColor: 'var(--ink-200)', color: 'var(--text-primary)', background: 'var(--brand-white)' }}>
      {saving
        ? <><Loader2 size={15} className="animate-spin" />Saving…</>
        : <><Save size={15} />{primary ? (isEdit ? 'Save changes' : 'Save reflection') : 'Done for now'}</>}
    </button>
  );

  // ── Per-step content ─────────────────────────────────────────────────────────
  let question, hint, body, footer;

  if (stepKey === 'experiment') {
    question = 'Which experiment is this about?';
    hint = 'Reflections attach to one experiment.';
    body = (
      <div className="space-y-2">
        {experiments.map((exp, i) => (
          <OptionRow
            key={exp.id}
            index={i}
            option={{ value: exp.id, label: exp.title, desc: exp.path_name || undefined }}
            selected={expId === exp.id}
            onSelect={() => chooseExperiment(exp.id)}
          />
        ))}
      </div>
    );
    footer = <div className="flex items-center gap-3">{continueButton(!!expId)}</div>;
  } else if (stepKey === 'week') {
    question = 'How did this week actually go?';
    hint = activityMode
      ? 'Here is what you logged. Untick anything that is not part of this.'
      : 'Pick whichever is closest. There is no wrong answer here.';
    body = activityMode ? (
      <>
        <div className="space-y-2">
          {activity.map((item, i) => (
            <OptionRow key={item.key} index={i} multi option={item}
              selected={picks.includes(item.label)} onSelect={() => togglePick(item.label)} />
          ))}
          <OptionRow
            index={activity.length}
            multi
            option={{ value: OTHER_KEY, label: 'Something else I did', desc: 'Anything that never made it into the app' }}
            selected={otherOpen}
            onSelect={() => setOtherOpen(o => !o)}
          />
        </div>
        {freeTextOpen && (
          <div className="anim-slide-up mt-2">
            {/* Focused only when the student just opened it. A box that was
                already open when the step mounted must not steal focus before
                the question has been read. */}
            <textarea rows={3} value={freeText} onChange={e => setFreeText(e.target.value)} autoFocus={!seed.otherOpen}
              placeholder="One per line." className={`${inputCls} resize-none`} />
          </div>
        )}
      </>
    ) : (
      <>
        <div className="space-y-2">
          {WEEK_OPTIONS.map((opt, i) => (
            <OptionRow key={opt.value} index={i} option={opt}
              selected={weekChoice === opt.value} onSelect={() => chooseWeek(opt.value)} />
          ))}
        </div>
        {/* freeTextOpen also carries a saved reflection whose completed_items
            match none of the four options: without it the student's own words
            were held in state, saved back, and never shown. */}
        {freeTextOpen && (
          <div className="anim-slide-up mt-2">
            {!chosen && (
              <p className="tp-meta mb-1.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>What you wrote down</p>
            )}
            <textarea rows={3} value={freeText} onChange={e => setFreeText(e.target.value)} autoFocus={!seed.otherOpen}
              placeholder="What did you actually do? One per line." className={`${inputCls} resize-none`} />
          </div>
        )}
      </>
    );
    footer = (
      <div className="flex flex-wrap items-center gap-3">
        {index > 0 && backButton}
        {continueButton(true)}
        {doneForNow(false)}
      </div>
    );
  } else if (stepKey === 'energy') {
    question = 'What moved the needle either way?';
    hint = 'One line each. Skip either one.';
    body = (
      <div className="space-y-4">
        <label className="block">
          <span className="tp-body mb-1.5 block font-semibold" style={{ color: 'var(--text-primary)' }}>What gave you energy?</span>
          <input value={energySources} onChange={e => setEnergySources(e.target.value)} autoFocus
            placeholder="e.g. the call with the analyst" className={bigInputCls} />
        </label>
        <label className="block">
          <span className="tp-body mb-1.5 block font-semibold" style={{ color: 'var(--text-primary)' }}>What drained you?</span>
          <input value={energyDrains} onChange={e => setEnergyDrains(e.target.value)}
            placeholder="e.g. writing up the summary" className={bigInputCls} />
        </label>
        {/* Only rendered for a record that already has this prose. It is not a
            question this flow asks. It exists so an old answer stays visible
            and editable instead of being silently carried or silently lost. */}
        {seed.avoidedProse && (
          <label className="block">
            <span className="tp-body mb-1.5 block font-semibold" style={{ color: 'var(--text-primary)' }}>
              What you avoided or didn&apos;t finish <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>· from your earlier answer</span>
            </span>
            <textarea rows={2} value={avoidedProse} onChange={e => setAvoidedProse(e.target.value)}
              className={`${inputCls} resize-none`} />
          </label>
        )}
      </div>
    );
    footer = (
      <div className="flex flex-wrap items-center gap-3">
        {backButton}
        {continueButton(true)}
        {doneForNow(false)}
      </div>
    );
  } else if (stepKey === 'fit') {
    // The only question that feeds "Adjust". Asked as a comparison against
    // their own expectation rather than a verdict on the path, so a bad week
    // and a bad fit stay distinguishable.
    question = 'Does this path still feel like a fit?';
    hint = selectedExp?.path_name
      ? `Comparing ${selectedExp.path_name} against what you expected before this week.`
      : 'Compared with what you expected before this week.';
    body = (
      <>
        <div className="space-y-2">
          {PATH_FIT_OPTIONS.map((opt, i) => (
            <OptionRow key={opt.value} index={i} option={opt}
              selected={pathFit === opt.value} onSelect={() => choosePathFit(opt.value)} />
          ))}
        </div>
        {/* Prose from the old "Did the path match your expectations?" textarea.
            Shown only when the record has some, so it stays editable instead of
            being overwritten by a canned label. */}
        {seed.pathFitProse && (
          <label className="mt-4 block">
            <span className="tp-body mb-1.5 block font-semibold" style={{ color: 'var(--text-primary)' }}>
              What you said before <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>· kept as you wrote it</span>
            </span>
            <textarea rows={2} value={pathFitProse} onChange={e => setPathFitProse(e.target.value)}
              className={`${inputCls} resize-none`} />
          </label>
        )}
      </>
    );
    footer = (
      <div className="flex flex-wrap items-center gap-3">
        {backButton}
        {continueButton(true)}
        {doneForNow(false)}
      </div>
    );
  } else {
    question = 'What did you actually learn?';
    hint = 'The one part worth writing out. A few sentences beats a list.';
    body = (
      <div className="space-y-4">
        <div>
          <textarea ref={lessonsRef} rows={5} value={lessons} onChange={e => setLessons(e.target.value)} autoFocus
            placeholder="Be specific. Finishing something is not the same as learning something."
            className={`${inputCls} resize-none`} />
          <div className="mt-2 flex flex-wrap gap-2">
            {STEMS.map(stem => (
              <button key={stem} type="button" onClick={() => insertStem(stem)}
                className="ui-press tp-meta rounded-full border px-3.5 py-2 font-semibold"
                style={{ borderColor: 'var(--ink-200)', color: 'var(--brand-navy-700)', background: 'var(--brand-white)' }}>
                {stem} …
              </button>
            ))}
          </div>
        </div>

        {/* The only forward-looking answer in the form. It stays in the open. */}
        <label className="block">
          <span className="tp-body mb-1.5 block font-semibold" style={{ color: 'var(--text-primary)' }}>What should change next week?</span>
          <input value={nextChanges} onChange={e => setNextChanges(e.target.value)}
            placeholder="One thing you'll do differently, drop, or try" className={bigInputCls} />
        </label>

        {expMissions.length > 0 && (
          <label className="block">
            <span className="tp-meta mb-1.5 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Mission this relates to <span className="font-normal">· optional</span>
            </span>
            <select value={missionId} onChange={e => setMissionId(e.target.value)} className={inputCls}>
              <option value="">No specific mission (the whole experiment)</option>
              {expMissions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </label>
        )}

        {genError && (
          <p className="tp-meta flex items-start gap-1.5 font-semibold text-red-600" role="alert">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />{genError}
          </p>
        )}

        {summary && (
          <div className="rounded-[var(--r-surface)] p-5" style={{ background: 'var(--surface-dark-700)', border: '1px solid rgba(31,58,95,0.5)' }}>
            <p className="tp-eyebrow mb-2.5" style={{ color: 'var(--brand-gold-500)' }}>Unscripted&apos;s analysis</p>
            <p className="tp-prose text-[color:var(--ink-300)]">{summary}</p>
            {adjustments.length > 0 && (
              <ul className="mt-4 space-y-2">
                {adjustments.map((a, i) => (
                  <li key={i} className="tp-body flex gap-2 text-[color:var(--ink-300)]">
                    <ArrowRight size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-gold-500)' }} />{a}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
    footer = (
      <>
        <div className="flex items-center gap-3">
          {backButton}
          {doneForNow(true)}
        </div>
        <button onClick={generate} disabled={generating || !expId || !hasContent}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] border py-3 text-sm font-semibold disabled:opacity-50"
          style={{ borderColor: 'var(--brand-navy-700)', color: 'var(--brand-navy-700)', background: 'white' }}>
          {generating
            ? <><Loader2 size={15} className="animate-spin" />Generating…</>
            : <><Sparkles size={15} />Generate insights</>}
        </button>
      </>
    );
  }

  // A disabled Save must never be silent about why, and each condition that can
  // switch canSave off has a line here.
  const blockedReason = canSave || saving || stepKey === 'experiment' ? null
    : !expId ? 'Go back and pick an experiment.'
      : !hasContent ? 'Answer any one thing above. That is enough to save.'
        : isEdit ? 'Nothing changed yet. Edit one answer and this will save.'
          : 'Confirm or change one thing above and this will save.';

  return (
    <div ref={cardRef} className="rounded-[var(--r-surface)] border bg-white px-5 py-6 sm:px-8 sm:py-7" style={{ borderColor: 'var(--border-light)' }}>
      <GuidedStyles />

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="tp-meta truncate rounded-full px-2.5 py-1 font-bold" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>
            Week of {fmtWeek(weekStart)}
          </span>
          <span className="tp-meta whitespace-nowrap font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {index + 1} of {steps.length}
          </span>
        </div>
        <ProgressBar value={(index + 1) / steps.length} />
      </div>

      <div key={index} className={dir === 'fwd' ? 'step-pane-fwd' : 'step-pane-back'}>
        <h2 ref={headingRef} tabIndex={-1} className="font-heading text-[26px] font-bold leading-tight outline-none" style={{ color: 'var(--surface-dark-900)' }}>
          {question}
        </h2>
        {hint && <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)', maxWidth: '48ch' }}>{hint}</p>}

        <div className="mt-5 min-h-[220px]">
          {error && (
            <div className="tp-body mb-4 flex items-start gap-2 rounded-[var(--r-control)] bg-red-50 p-3 text-red-700" role="alert">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />{error}
            </div>
          )}
          {body}
        </div>
      </div>

      <div className="mt-6">
        {footer}
        {blockedReason && (
          <p className="tp-meta mt-2.5 text-center font-semibold" style={{ color: 'var(--text-secondary)' }}>{blockedReason}</p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function WeeklyReflectionPage() {
  const navigate = useNavigate();
  const [userPaths, setUserPaths] = useState([]);
  const [selectedPathId, setSelectedPathId] = useState('all');
  const [reflections, setReflections] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [missions, setMissions] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('form'); // 'form' | 'history'
  const [editingReflection, setEditingReflection] = useState(null); // null = new
  const [draftOffer, setDraftOffer] = useState(null);   // offered, not applied
  const [activeDraft, setActiveDraft] = useState(null); // accepted by the student
  const [successToast, setSuccessToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Who the draft belongs to. Resolved before any draft is read or written, so
  // a draft can never be offered to an account other than the one that wrote it.
  const [userId, setUserId] = useState('');
  const toastTimer = useRef(null);

  const [search, setSearch] = useState('');
  const [filterExp, setFilterExp] = useState('all');

  const thisMonday = getMonday(new Date());

  const load = async () => {
    try {
      const [me, data, exps, mis, ps, proof] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.WeeklyReflections.list('-created_date', 100).catch(() => []),
        base44.entities.Experiments.list('-created_date', 200).catch(() => []),
        base44.entities.Missions.list('-created_date', 200).catch(() => []),
        base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []),
        base44.entities.ProofOfWork.list('-created_date', 200).catch(() => []),
      ]);

      const mine = me?.id || '';
      setUserId(mine);

      const liveReflections = Array.isArray(data) ? data.filter(isActive) : [];
      const liveExperiments = Array.isArray(exps) ? exps.filter(isActive) : [];
      const ownExpIds = new Set(liveExperiments.map(e => e.id));

      setReflections(liveReflections);
      setExperiments(liveExperiments);
      setMissions(Array.isArray(mis) ? mis.filter(isActive) : []);
      setUserPaths(Array.isArray(ps) ? ps : []);
      // ProofOfWork is world-readable (`"read": null` in the schema), so this
      // list arrives with every student's proof in it. Keeping only rows that
      // hang off one of *this* user's experiments is what stops someone else's
      // work appearing on this screen. Do not relax this filter.
      setProofs(Array.isArray(proof) ? proof.filter(p => isActive(p) && ownExpIds.has(p.experiment_id)) : []);

      // The form is the landing view, so whether it opens as a new reflection
      // or as this week's existing one has to be decided HERE, before the
      // student sees anything. Leaving it null until they press a button meant
      // a returning student landed on a blank form and got a second row for the
      // same week.
      const thisWeekRow = liveReflections.find(r => sameWeek(r.week_start, getMonday(new Date()))) || null;
      if (thisWeekRow) setEditingReflection(thisWeekRow);

      // Server wins. A local draft is only ever offered for a week that has no
      // saved row, and never applied until the student asks for it.
      const d = loadDraft(mine);
      if (d?.week_start) {
        if (liveReflections.some(r => sameWeek(r.week_start, d.week_start))) clearReflectionDraft(mine);
        else if (!thisWeekRow || !sameWeek(d.week_start, thisWeekRow.week_start)) setDraftOffer(d);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const experimentsMap = Object.fromEntries(experiments.map(e => [e.id, e]));
  const missionsMap = Object.fromEntries(missions.map(m => [m.id, m]));

  // Matched on a tolerance rather than string equality, so a row written a day
  // either side still counts as this week and is resumed instead of duplicated.
  const currentWeekRow = reflections.find(r => sameWeek(r.week_start, thisMonday)) || null;

  const startReflection = () => {
    // Resume this week's saved row rather than opening a blank form that would
    // file a second reflection under the same week.
    setEditingReflection(currentWeekRow || null);
    if (currentWeekRow) setActiveDraft(null);
    setView('form');
  };

  // Stable identity: this lands in the flow's draft effect dependency list, and
  // a fresh arrow every render would tear down and rebuild the debounce timer
  // on every keystroke.
  const handleDraftWritten = useCallback(() => setDraftOffer(null), []);

  const handleSaved = (saved) => {
    setReflections(prev => {
      const idx = prev.findIndex(r => r.id === saved.id);
      if (idx >= 0) {
        const nextList = [...prev];
        nextList[idx] = saved;
        return nextList;
      }
      return [saved, ...prev];
    });

    clearReflectionDraft(userId);
    setDraftOffer(null);
    setActiveDraft(null);

    setSuccessToast({
      experiment: saved.experiment_id ? experimentsMap[saved.experiment_id] : null,
      mission: saved.mission_id ? missionsMap[saved.mission_id] : null,
    });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSuccessToast(null), 8000);

    setEditingReflection(null);
    setView('history');
  };

  const selectedPath = selectedPathId === 'all' ? null : userPaths.find(p => p.id === selectedPathId);

  const filteredReflections = reflections.filter(r => {
    if (selectedPath) {
      const exp = r.experiment_id ? experimentsMap[r.experiment_id] : null;
      const matchesPath = r.path_name === selectedPath.path_name || exp?.path_name === selectedPath.path_name;
      if (!matchesPath) return false;
    }
    if (filterExp !== 'all' && (r.experiment_id || '') !== filterExp) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const exp = r.experiment_id ? experimentsMap[r.experiment_id] : null;
      const mis = r.mission_id ? missionsMap[r.mission_id] : null;
      const text = [
        r.generated_summary, r.lessons, r.next_changes, r.path_feedback,
        ...toStringArray(r.completed_items), ...toStringArray(r.avoided_items),
        exp?.title, exp?.path_name, mis?.title,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  const handleDeleteReflection = async () => {
    if (!deleteTarget) return;
    const user = await base44.auth.me();
    await base44.entities.WeeklyReflections.update(deleteTarget.id, softDeletePayload(user.id));
    setReflections(prev => prev.filter(r => r.id !== deleteTarget.id));
    // Editing the row that was just deleted would save it straight back.
    setEditingReflection(prev => (prev?.id === deleteTarget.id ? null : prev));
    setDeleteTarget(null);
  };

  const tabCls = (on) => ({
    background: on ? 'var(--brand-navy-900)' : 'var(--ink-100)',
    color: on ? '#fff' : 'var(--ink-700)',
  });

  return (
    <main className="app-page">
      {deleteTarget && (
        <SoftDeleteConfirm
          itemName={`Week of ${fmtWeek(deleteTarget.week_start, { month: 'long', day: 'numeric', year: 'numeric' })}`}
          onConfirm={handleDeleteReflection}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {successToast && (
        <SuccessToast
          experiment={successToast.experiment}
          mission={successToast.mission}
          onOpenExp={() => { setSuccessToast(null); navigate('/experiments'); }}
          onDismiss={() => setSuccessToast(null)}
        />
      )}

      <PageHeader
        title="Learn from what you actually did."
        description="A few taps at the end of the week."
        action={
          <div className="flex gap-2">
            <button onClick={startReflection}
              className="tp-body rounded-[var(--r-control)] px-4 py-2.5 font-semibold transition"
              style={tabCls(view === 'form')}>
              {currentWeekRow ? 'This week' : 'New reflection'}
            </button>
            <button onClick={() => setView('history')}
              className="tp-body rounded-[var(--r-control)] px-4 py-2.5 font-semibold transition"
              style={tabCls(view === 'history')}>
              History {reflections.length > 0 && `(${reflections.length})`}
            </button>
          </div>
        }
      />

      {loading ? (
        <SkCards count={3} h={172} gap={16} r={24} />
      ) : view === 'form' ? (
        experiments.length === 0 ? (
          <div className="rounded-[var(--r-surface)] border border-dashed p-12 text-center" style={{ borderColor: 'var(--border-light)' }}>
            <p className="tp-body text-[color:var(--ink-500)]">There is nothing to reflect on yet. Start an experiment first.</p>
            <button onClick={() => navigate('/experiments')}
              className="tp-body mt-5 rounded-[var(--r-control)] px-5 py-3 font-semibold text-white"
              style={{ background: 'var(--brand-navy-900)' }}>
              Go to Missions
            </button>
          </div>
        ) : (
          <>
            {/* Offered, never applied on its own. */}
            {draftOffer && !activeDraft && !editingReflection && (
              <div className="anim-slide-up mb-4 flex flex-wrap items-center gap-3 rounded-[var(--r-surface)] border px-4 py-3"
                style={{ borderColor: 'var(--border-light)', background: 'var(--background-tertiary)' }}>
                <p className="tp-body flex-1 text-[color:var(--ink-700)]">
                  You started a reflection for the week of <strong>{fmtWeek(draftOffer.week_start)}</strong> and didn&apos;t save it.
                </p>
                <button onClick={() => setActiveDraft(draftOffer)}
                  className="tp-meta rounded-[var(--r-control)] px-3.5 py-2 font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>
                  Pick it up
                </button>
                <button onClick={() => { clearReflectionDraft(userId); setDraftOffer(null); }}
                  className="tp-meta rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-3.5 py-2 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
                  Start fresh
                </button>
              </div>
            )}

            {/* Only shown in the state where it is true: the flow is actually
                bound to this week's saved row and will update it. The earlier
                version of this line rendered when editingReflection was null,
                exactly when the next save would create a SECOND row, and
                disappeared once it became accurate. */}
            {currentWeekRow && editingReflection?.id === currentWeekRow.id && (
              <p className="tp-body mb-4 text-[color:var(--ink-500)]">
Picking up this week&apos;s reflection. Saving updates it.
              </p>
            )}

            <ReflectionFlow
              // Without this key, "New reflection" after an edit reused the
              // mounted component and kept the previous answers in the boxes,
              // then saved them again as a second row.
              key={editingReflection?.id || (activeDraft ? 'draft' : 'new')}
              experiments={experiments}
              missions={missions}
              proofs={proofs}
              initialData={editingReflection}
              draft={editingReflection ? null : activeDraft}
              userId={userId}
              onSaved={handleSaved}
              onDraftWritten={handleDraftWritten}
            />
          </>
        )
      ) : (
        /* ── History ── */
        <div>
          {userPaths.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <PathSwitcher
                paths={userPaths.filter(p => p.status !== 'archived')}
                selectedId={selectedPathId}
                onChange={setSelectedPathId}
                showAll
              />
              {selectedPath && <span className="tp-meta text-[color:var(--ink-400)]">Reflections for <strong className="text-[color:var(--ink-700)]">{selectedPath.path_name}</strong></span>}
            </div>
          )}

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-400)]" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search reflections…"
                className="w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white py-2.5 pl-9 pr-4 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            {experiments.length > 0 && (
              <select value={filterExp} onChange={e => setFilterExp(e.target.value)}
                className="max-w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]">
                <option value="all">All experiments</option>
                {experiments.map(exp => <option key={exp.id} value={exp.id}>{exp.title}</option>)}
              </select>
            )}
            <button onClick={startReflection}
              className="tp-body inline-flex shrink-0 items-center gap-2 rounded-[var(--r-control)] px-4 py-2.5 font-semibold text-white"
              style={{ background: 'var(--brand-navy-900)' }}>
              <Plus size={15} /> Add
            </button>
          </div>

          {filteredReflections.length === 0 ? (
            <div className="tp-body rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] p-12 text-center text-[color:var(--ink-500)]">
              {reflections.length === 0
                ? 'No reflections yet. The first one takes about a minute.'
                : 'No reflections match your search or filter.'}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReflections.map(r => {
                const linkedExp = r.experiment_id ? experimentsMap[r.experiment_id] : null;
                const linkedMission = r.mission_id ? missionsMap[r.mission_id] : null;
                const preview = r.generated_summary || r.lessons || r.next_changes
                  || toStringArray(r.completed_items).join(' · ') || toStringArray(r.avoided_items).join(' · ');
                return (
                  <div key={r.id} className="tp-card-body rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="tp-card text-[color:var(--surface-dark-900)]">
                          Week of {fmtWeek(r.week_start, { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>

                        {linkedExp ? (
                          <p className="tp-meta mt-1 font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
                            {linkedExp.title}{linkedExp.path_name ? ` (${linkedExp.path_name})` : ''}
                          </p>
                        ) : (
                          <p className="tp-meta mt-1 text-[color:var(--ink-400)]">Experiment not linked.</p>
                        )}

                        {linkedMission && <p className="tp-meta mt-1 text-[color:var(--ink-500)]">Mission: {linkedMission.title}</p>}
                        {preview && <p className="tp-prose mt-2.5 line-clamp-2 text-[color:var(--ink-500)]">{preview}</p>}
                      </div>
                      {r.generated_summary && <CheckCircle size={18} className="mt-1 shrink-0" style={{ color: 'var(--success-700)' }} />}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => { setEditingReflection(r); setView('form'); }}
                        className="tp-meta rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-3.5 py-2 font-semibold text-[color:var(--ink-700)] transition hover:bg-[color:var(--ink-50)]">
                        View / Edit
                      </button>
                      {linkedExp && (
                        <button onClick={() => navigate('/experiments')}
                          className="tp-meta flex items-center gap-1.5 rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-3.5 py-2 font-semibold text-[color:var(--ink-700)] transition hover:bg-[color:var(--ink-50)]">
                          <ExternalLink size={13} /> Open Experiment
                        </button>
                      )}
                      <button onClick={() => setDeleteTarget(r)}
                        className="tp-meta flex items-center gap-1.5 rounded-[var(--r-control)] border border-red-100 px-3.5 py-2 font-semibold text-red-400 transition hover:border-red-400 hover:text-red-600">
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}