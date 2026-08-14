/**
 * The work simulation, start to finish.
 *
 * Setup and four predictions, five steps, two experience samples at the seams,
 * three questions at the end. Every string a student reads is either in the
 * content module or in one of the components under `components/worksim/`, and
 * this file only decides what comes next.
 *
 * Three things here are load bearing and easy to undo by accident:
 *
 * **No clock is drawn.** Step durations are recorded and never shown. The
 * moment a countdown appears on screen this stops being a sample of the work
 * and becomes an exam, and people perform differently in an exam.
 *
 * **Saving happens at seams only.** A step submit and a sample tap. Not on
 * keystrokes. The cost is that a browser crash mid-spec loses that step's
 * typing; the thing bought is that nobody is writing a spec through a network
 * round trip per character.
 *
 * **Leaving leaves a usable row.** Closing the tab mid-spec is the ordinary
 * case here, not the edge case. Two routes cover it: this page marks the run
 * abandoned on its way out, and `closeStaleRuns` catches anything a closed tab
 * dropped the next time the page is opened. Either way the row keeps the step
 * they left at and every sample they had already given, and no Experiments row
 * is ever created for it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Sk } from '@/components/PageSkeleton';
import { NORTHGATE_PM } from '@/lib/work-sims/northgate-pm';
import {
  startRun, saveStep, recordSample, abandonRun, completeRun, saveSimPredictions,
  loadRuns, closeStaleRuns,
} from '@/lib/work-sim';
import SimSetup from '@/components/worksim/SimSetup';
import SimInbox from '@/components/worksim/SimInbox';
import SimBacklog from '@/components/worksim/SimBacklog';
import SimSpec, { seedSpec } from '@/components/worksim/SimSpec';
import SimRevision from '@/components/worksim/SimRevision';
import SimReply from '@/components/worksim/SimReply';
import SimSample from '@/components/worksim/SimSample';
import SimAfter from '@/components/worksim/SimAfter';
import SimReadout from '@/components/worksim/SimReadout';

const SIM = NORTHGATE_PM;

/**
 * Which of the five steps a screen belongs to. The sample screens and the two
 * halves of the revision are not steps of their own: somebody who closes the tab
 * on the second sample left during step 4, and grouping it any other way would
 * make `abandoned_at_step` say something that is not true.
 */
const STEP_OF = {
  step1: 1,
  step2: 2, sample1: 2,
  step3: 3,
  step4a: 4, sample2: 4, step4b: 4,
  step5: 5, after: 5,
};

const now = () => Date.now();
const since = (from) => (from ? (now() - from) / 1000 : undefined);

export default function WorkSimulationPage() {
  const [ready, setReady] = useState(false);
  const [priorRuns, setPriorRuns] = useState([]);
  const [stage, setStage] = useState('setup');
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [pre, setPre] = useState({});
  const [problem, setProblem] = useState('');
  const [decisions, setDecisions] = useState({});
  const [notes, setNotes] = useState({});
  const [specV1, setSpecV1] = useState(() => seedSpec(SIM));
  const [specV2, setSpecV2] = useState('');
  const [engineerReply, setEngineerReply] = useState('');
  const [salesReply, setSalesReply] = useState('');
  const [post, setPost] = useState({});
  // The measurement row the read-out puts the four predictions against. It is
  // whatever `completeRun` got back, which is null when that write failed, and
  // the read-out is built to degrade on a missing one rather than to wait for it.
  const [measurement, setMeasurement] = useState(null);

  // Timing, held in refs so recording it never re-renders a text area someone
  // is typing into.
  const stepStart = useRef(null);
  const runRef = useRef(null);
  const stageRef = useRef('setup');
  const finishedRef = useRef(false);

  useEffect(() => { runRef.current = run; }, [run]);
  useEffect(() => { stageRef.current = stage; }, [stage]);

  const selected = useMemo(
    () => SIM.backlog.items.filter(i => decisions[i.id] === 'in').map(i => i.id),
    [decisions],
  );
  const cut = useMemo(
    () => SIM.backlog.items.filter(i => decisions[i.id] === 'cut').map(i => i.id),
    [decisions],
  );
  const cutNotes = useMemo(
    () => cut.map(id => ({ item_id: id, note: (notes[id] || '').trim() })).filter(n => n.note),
    [cut, notes],
  );

  // Close out anything an earlier visit left open before offering a new run.
  // This is the half of abandonment that a closed tab cannot be trusted to do
  // for itself.
  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await loadRuns();
      await closeStaleRuns(rows).catch(() => null);
      if (!alive) return;
      setPriorRuns(rows);
      setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  // Leaving. `pagehide` covers a closed tab or a reload as far as a browser
  // allows; the cleanup covers navigating away inside the app, which is the
  // reliable one. Tab switching is deliberately not treated as leaving: a
  // student reading a message in another tab has not abandoned anything.
  useEffect(() => {
    const leave = () => {
      if (finishedRef.current) return;
      const r = runRef.current;
      if (r?.status === 'in_progress') abandonRun(r, STEP_OF[stageRef.current]);
    };
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('pagehide', leave); leave(); };
  }, []);

  const guard = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      // The stage, never the student's words.
      setError('That did not save. Nothing you wrote was lost, so press the button again.');
    } finally {
      setBusy(false);
    }
  }, []);

  const begin = () => guard(async () => {
    const created = await startRun(SIM, priorRuns);
    await saveSimPredictions(created, pre, SIM).catch(() => null);
    setRun(created);
    stepStart.current = now();
    setStage('step1');
  });

  const advance = (step, patch, next, seconds) => guard(async () => {
    const updated = await saveStep(runRef.current, step, patch, seconds);
    setRun(updated);
    setStage(next);
  });

  const sample = (at_step, next) => (value) => guard(async () => {
    const updated = await recordSample(runRef.current, {
      at_step,
      score: typeof value === 'number' ? value : undefined,
      skipped: value == null,
    });
    setRun(updated);
    setStage(next);
  });

  const finish = () => guard(async () => {
    const result = await completeRun({ run: runRef.current, answers: post, sim: SIM });
    finishedRef.current = true;
    setRun(result.run);
    setMeasurement(result.measurement);
    setStage('done');
  });

  const decide = (itemId, value) => setDecisions(d => ({ ...d, [itemId]: value }));
  const note = (itemId, value) => setNotes(n => ({ ...n, [itemId]: value }));

  if (!ready) {
    return (
      <main className="app-page">
        <div className="mx-auto max-w-2xl space-y-4">
          <Sk h={28} w="55%" r={7} />
          <Sk h={180} r={16} />
        </div>
      </main>
    );
  }

  const step = STEP_OF[stage];
  const stepMeta = SIM.steps.find(s => s.number === step);

  return (
    <main className="app-page">
      <div className="mx-auto max-w-2xl">
        <Link to="/journey" className="tp-meta mb-6 inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={15} /> My Journey
        </Link>

        {stepMeta && (
          <div className="mb-6">
            <p className="tp-eyebrow font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-navy-700)' }}>
              Step {stepMeta.number} of {SIM.steps.length} · {stepMeta.title}
            </p>
            <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{stepMeta.blurb}</p>
          </div>
        )}

        {error && (
          <div
            className="app-inset mb-5 flex items-start gap-2.5 p-4"
            style={{ background: 'var(--background-secondary)' }}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-navy-700)' }} />
            <p className="tp-meta" style={{ color: 'var(--text-primary)' }}>{error}</p>
          </div>
        )}

        {/* The read-out is four panels rather than one step, so it draws at the
            page's own level instead of inside the card the steps share. */}
        {stage === 'done' ? (
          <SimReadout run={run} measurement={measurement} sim={SIM} />
        ) : (
        <div className="app-card p-6 sm:p-8">
          {stage === 'setup' && (
            <SimSetup
              sim={SIM}
              answers={pre}
              onAnswer={(k, v) => setPre(a => ({ ...a, [k]: v }))}
              onStart={begin}
              busy={busy}
            />
          )}

          {stage === 'step1' && (
            <SimInbox
              sim={SIM}
              onNext={() => {
                const seconds = since(stepStart.current);
                stepStart.current = now();
                advance(1, {}, 'step2', seconds);
              }}
            />
          )}

          {stage === 'step2' && (
            <SimBacklog
              sim={SIM}
              problem={problem}
              onProblem={setProblem}
              selected={selected}
              cut={cut}
              notes={notes}
              onDecide={decide}
              onNote={note}
              busy={busy}
              onSubmit={() => {
                const seconds = since(stepStart.current);
                stepStart.current = now();
                advance(2, {
                  problem_statement: problem.trim(),
                  selected_items: selected,
                  cut_notes: cutNotes,
                }, 'sample1', seconds);
              }}
            />
          )}

          {stage === 'sample1' && (
            <SimSample onAnswer={sample(2, 'step3')} onSkip={() => sample(2, 'step3')(null)} />
          )}

          {stage === 'step3' && (
            <SimSpec
              sim={SIM}
              value={specV1}
              onChange={setSpecV1}
              busy={busy}
              onSubmit={() => {
                const seconds = since(stepStart.current);
                stepStart.current = now();
                // Version 2 opens as a copy of version 1, because the step is
                // editing what they wrote, not writing it again.
                setSpecV2(specV1);
                advance(3, { spec_v1: specV1 }, 'step4a', seconds);
              }}
            />
          )}

          {(stage === 'step4a' || stage === 'step4b') && (
            <SimRevision
              sim={SIM}
              phase={stage === 'step4a' ? 'rework' : 'answer'}
              specV1={specV1}
              specV2={specV2}
              onSpecV2={setSpecV2}
              selected={selected}
              cut={cut}
              notes={notes}
              onDecide={decide}
              onNote={note}
              engineerReply={engineerReply}
              onEngineerReply={setEngineerReply}
              busy={busy}
              onSubmitRework={() => advance(4, {
                spec_v2: specV2,
                selected_items_final: selected,
                cut_notes: cutNotes,
              }, 'sample2')}
              onSubmitAnswer={() => {
                const seconds = since(stepStart.current);
                stepStart.current = now();
                advance(4, { engineer_reply: engineerReply.trim() }, 'step5', seconds);
              }}
            />
          )}

          {stage === 'sample2' && (
            <SimSample onAnswer={sample(4, 'step4b')} onSkip={() => sample(4, 'step4b')(null)} />
          )}

          {stage === 'step5' && (
            <SimReply
              sim={SIM}
              value={salesReply}
              onChange={setSalesReply}
              busy={busy}
              onSubmit={() => {
                const seconds = since(stepStart.current);
                stepStart.current = now();
                advance(5, { sales_reply: salesReply.trim() }, 'after', seconds);
              }}
            />
          )}

          {stage === 'after' && (
            <SimAfter
              answers={post}
              onAnswer={(k, v) => setPost(a => ({ ...a, [k]: v }))}
              onFinish={finish}
              busy={busy}
            />
          )}
        </div>
        )}
      </div>
    </main>
  );
}
