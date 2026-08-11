/**
 * The default Experiment experience: one short Career Moment, in four stages.
 *
 * Hook → decision → instant feedback → two-question reaction. Everything it
 * produces lands in the same places a long experiment's evidence lands, so the
 * Career Evidence Profile, the ability/enjoyment split and the uncertainty map
 * all update from a three minute task.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Sk, SkCards } from '@/components/PageSkeleton';
import MomentHook from '@/components/moments/MomentHook';
import MomentTask from '@/components/moments/MomentTask';
import MomentFeedback from '@/components/moments/MomentFeedback';
import MomentReaction from '@/components/moments/MomentReaction';
import {
  loadMomentTarget, generateCareerMoment, saveCareerMoment, feedbackFor, completeCareerMoment,
} from '@/lib/career-moment';

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
  const [reaction, setReaction] = useState(null);
  const [again, setAgain] = useState('');
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState([]);

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
      setRow(saved);
    })();
    return () => { alive = false; };
  }, [recId, variable]);

  const finish = async () => {
    setSaving(true);
    const result = await completeCareerMoment({ momentRow: row, selected, rationale, reaction, again })
      .catch(() => null);
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
          {stage === 'hook' && <MomentHook moment={row} onStart={() => setStage('task')} />}
          {stage === 'task' && (
            <MomentTask
              moment={row}
              selected={selected}
              onSelect={setSelected}
              rationale={rationale}
              onRationale={setRationale}
              onSubmit={() => setStage('feedback')}
            />
          )}
          {stage === 'feedback' && (
            <MomentFeedback feedback={feedbackFor(row, selected)} onNext={() => setStage('reaction')} />
          )}
          {stage === 'reaction' && (
            <MomentReaction
              reaction={reaction}
              onReaction={setReaction}
              again={again}
              onAgain={setAgain}
              onFinish={finish}
              saving={saving}
            />
          )}
          {stage === 'done' && (
            <div className="space-y-5 text-center">
              <CheckCircle2 className="mx-auto text-green-600" size={36} />
              <h2 className="tp-page" style={{ color: 'var(--surface-dark-900)' }}>Evidence saved</h2>
              <p className="tp-body" style={{ color: 'var(--ink-700)' }}>
                That counted. {row.career_name} has been updated with what this told us.
              </p>
              {changes.length > 0 && (
                <div className="rounded-[16px] border p-4 text-left" style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}>
                  <p className="tp-eyebrow" style={{ color: 'var(--ink-500)' }}>What moved</p>
                  <ul className="mt-2 space-y-1">
                    {changes.slice(0, 3).map((c, i) => (
                      <li key={i} className="tp-body" style={{ color: 'var(--ink-700)' }}>
                        {c.path.path_name}: fit {c.after.career_fit_score}% · confidence {c.after.fit_confidence_score}%
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => navigate(0)}
                  className="tp-body ui-press rounded-[12px] py-3 font-semibold text-white"
                  style={{ background: 'var(--brand-navy-900)' }}>
                  Try another moment
                </button>
                <Link to="/career-profile"
                  className="tp-body rounded-[12px] border py-3 text-center font-semibold"
                  style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-700)' }}>
                  See my evidence
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}