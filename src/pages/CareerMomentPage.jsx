/**
 * The default Experiment experience: one short Career Moment, in four stages.
 *
 * Hook → decision → instant feedback → two-question reaction. Everything it
 * produces lands in the same places a long experiment's evidence lands, so the
 * Career Evidence Profile, the ability/enjoyment split and the uncertainty map
 * all update from a three minute task.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Sk, SkCards } from '@/components/PageSkeleton';
import MomentHook from '@/components/moments/MomentHook';
import MomentTask from '@/components/moments/MomentTask';
import MomentFeedback from '@/components/moments/MomentFeedback';
import MomentReaction from '@/components/moments/MomentReaction';
import MomentLearned from '@/components/moments/MomentLearned';
import {
  loadMomentTarget, generateCareerMoment, saveCareerMoment, feedbackFor, completeCareerMoment,
  loadMeasurementPlan,
} from '@/lib/career-moment';
import { createTracker, recordMomentSignals } from '@/lib/behavioral-signals';

const STAGES = ['Situation', 'Your call', 'What it showed', 'Reaction'];

export default function CareerMomentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const recId = params.get('recId') || params.get('pathId') || undefined;
  const variable = params.get('variable') || undefined;

  const [row, setRow] = useState(null);
  const [target, setTarget] = useState(null);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState('hook'); // hook | task | feedback | reaction | done
  const [selected, setSelected] = useState('');
  const [rationale, setRationale] = useState('');
  // At most one question before, one or two after. Which ones rotates.
  const [plan, setPlan] = useState({ pre: null, post: [] });
  const [preAnswers, setPreAnswers] = useState({});
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState([]);
  // Passive signals only: stage timings, whether the answer changed, how much
  // was written. Held in a ref so recording never re-renders the Moment.
  const tracker = useRef(createTracker());
  const finishedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { path, focus } = await loadMomentTarget({ recId, variable }).catch(() => ({ path: null }));
      if (!alive) return;
      if (!path) { setError('We could not find a career to test yet. Choose a path first.'); return; }
      setTarget({ path, focus });
      const result = await generateCareerMoment(path, focus).catch(() => null);
      if (!alive) return;
      if (!result?.ok) { setError('We could not build a Career Moment just now. Nothing was saved. Try again in a moment.'); return; }
      const saved = await saveCareerMoment(result.data).catch(() => null);
      if (!alive) return;
      if (!saved) { setError('We could not save this Career Moment. Try again in a moment.'); return; }
      setPlan(await loadMeasurementPlan().catch(() => ({ pre: null, post: [] })));
      if (!alive) return;
      tracker.current = createTracker({ careerMomentId: saved.id, careerName: saved.career_name });
      setRow(saved);
    })();
    return () => { alive = false; };
  }, [recId, variable]);

  // Leaving part-way through is itself a signal, and a supporting one only. It
  // is never read as dislike of the career.
  useEffect(() => () => {
    if (row && !finishedRef.current && tracker.current.began_at) {
      recordMomentSignals({ moment: row, tracker: tracker.current, outcome: 'abandoned', rationale }).catch(() => null);
    }
  }, [row, rationale]);

  const selectOption = (key) => {
    if (selected && selected !== key) {
      tracker.current.changed_answer = true;
      tracker.current.revisions += 1;
    }
    setSelected(key);
  };

  const finish = async () => {
    setSaving(true);
    finishedRef.current = true;
    const result = await completeCareerMoment({
      momentRow: row, selected, rationale, preAnswers, answers, plan, tracker: tracker.current,
    }).catch(() => null);
    setSaving(false);
    if (!result) { setError('Your answers could not be saved. Nothing was lost — try Save again.'); return; }
    setChanges(result.changes || []);
    setStage('done');
  };

  if (error) {
    return (
      <main className="app-page">
        <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
          <AlertCircle className="mx-auto text-red-500" size={36} />
          <p className="tp-section" style={{ color: 'var(--surface-dark-900)' }}>{error}</p>
          <Link to="/journey" className="tp-body font-semibold" style={{ color: 'var(--brand-navy-900)' }}>Back to My Journey</Link>
        </div>
      </main>
    );
  }

  if (!row) {
    return (
      <main className="app-page">
        <div className="mx-auto max-w-2xl">
          <div className="flex h-9 items-center"><Sk h={24} w="60%" r={7} /></div>
          <p className="tp-body mt-4 flex items-center gap-2" style={{ color: 'var(--ink-500)' }}>
            <Loader2 size={15} className="animate-spin" />
            Building a short test{target?.path ? ` for ${target.path.path_name}` : ''}…
          </p>
          <div className="mt-6"><SkCards count={3} h={96} gap={12} r={16} /></div>
        </div>
      </main>
    );
  }

  const stageIndex = { hook: 0, task: 1, feedback: 2, reaction: 3, done: 3 }[stage];

  return (
    <main className="app-page">
      <div className="mx-auto max-w-2xl">
        <Link to="/journey" className="tp-body mb-6 inline-flex items-center gap-1" style={{ color: 'var(--ink-500)' }}>
          <ArrowLeft size={15} /> My Journey
        </Link>

        <div className="mb-6 flex items-center gap-2">
          {STAGES.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className="tp-meta font-semibold"
                style={{ color: i === stageIndex ? 'var(--brand-navy-900)' : 'var(--ink-400)' }}>{label}</span>
              {i < STAGES.length - 1 && <div className="h-px w-4" style={{ background: 'var(--ink-200)' }} />}
            </div>
          ))}
        </div>

        <div className="rounded-[24px] border bg-white p-6 sm:p-8" style={{ borderColor: 'var(--ink-200)' }}>
          {stage === 'hook' && (
            <MomentHook
              moment={row}
              preField={plan.pre}
              preValue={plan.pre ? preAnswers[plan.pre.key] : undefined}
              onPre={(v) => setPreAnswers({ [plan.pre.key]: v })}
              onStart={() => { tracker.current.began_at = Date.now(); setStage('task'); }}
            />
          )}
          {stage === 'task' && (
            <MomentTask
              moment={row}
              selected={selected}
              onSelect={selectOption}
              rationale={rationale}
              onRationale={setRationale}
              onSubmit={() => { tracker.current.decided_at = Date.now(); setStage('feedback'); }}
            />
          )}
          {stage === 'feedback' && (
            <MomentFeedback
              feedback={feedbackFor(row, selected)}
              // Read rather than clicked: the feedback is shown either way, so
              // only dwelling on it counts as engaging with it.
              onNext={() => {
                tracker.current.opened_feedback = Date.now() - (tracker.current.decided_at || 0) > 4000;
                setStage('reaction');
              }}
            />
          )}
          {stage === 'reaction' && (
            <MomentReaction
              fields={plan.post}
              answers={answers}
              onAnswer={(key, value) => setAnswers(a => ({ ...a, [key]: value }))}
              onFinish={finish}
              saving={saving}
            />
          )}
          {stage === 'done' && (
            <MomentLearned moment={row} changes={changes} onAnother={() => navigate(0)} />
          )}
        </div>
      </div>
    </main>
  );
}