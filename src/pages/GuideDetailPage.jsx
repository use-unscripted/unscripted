/**
 * Opening an experiment: an overview, then one step at a time, then a short
 * completion screen that hands the student to reflection.
 *
 * Nothing here is a second system. The steps are the existing Mission Guide's
 * own steps, the outreach is the existing OutreachContacts records, the evidence
 * is ProofOfWork on the same cycle → path → experiment → mission chain, and the
 * progress lives on the guide record so a refresh, a logout or another phone
 * lands on the same step.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, Star } from 'lucide-react';
import { Sk, SkCards } from '@/components/PageSkeleton';
import PageHeader from '@/components/PageHeader';
import { trackPilotEvent } from '@/lib/pilot-metrics';
import GuidedOverview from '@/components/guided/GuidedOverview';
import GuidedProgress from '@/components/guided/GuidedProgress';
import GuidedStepPanel from '@/components/guided/GuidedStepPanel';
import GuidedNav from '@/components/guided/GuidedNav';
import GuidedCompletion from '@/components/guided/GuidedCompletion';
import LanguageFamiliarityPrompt from '@/components/language/LanguageFamiliarityPrompt';
import useLanguageLevel from '@/hooks/useLanguageLevel';
import {
  readProgress, openStep, completeStep, saveStepNote,
  stepBlockers, stepEvidenceKey, minutesSpent,
} from '@/lib/guide-progress';

const alive = (rows) => (Array.isArray(rows) ? rows : []).filter(r => r?.deletion_status !== 'deleted');

export default function GuideDetailPage() {
  const navigate = useNavigate();
  const guideId = new URLSearchParams(window.location.search).get('id');

  const [guide, setGuide] = useState(null);
  const [ctx, setCtx] = useState({ experiment: null, mission: null, path: null, proofs: [] });
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settingActive, setSettingActive] = useState(false);

  const [view, setView] = useState('overview');   // overview | step | done
  const [stepNumber, setStepNumber] = useState(1);
  const [note, setNote] = useState('');
  const [showBlockers, setShowBlockers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [askDismissed, setAskDismissed] = useState(false);
  const noteTimer = useRef(null);

  /* Display language for this path. Held here so the overview and the step share
     one value, and stored per path, never per site. */
  const language = useLanguageLevel({
    pathId: guide?.path_id || ctx.experiment?.path_id || ctx.path?.id || null,
    path: ctx.path,
    experiment: ctx.experiment,
  });

  // ── Load ──
  const loadContext = useCallback(async (g) => {
    const [experiment, missions, proofs, paths] = await Promise.all([
      g.experiment_id ? base44.entities.Experiments.get(g.experiment_id).catch(() => null) : null,
      g.experiment_id ? base44.entities.Missions.filter({ experiment_id: g.experiment_id }, 'created_date', 100).catch(() => []) : [],
      g.experiment_id ? base44.entities.ProofOfWork.filter({ experiment_id: g.experiment_id }, '-created_date', 100).catch(() => []) : [],
      base44.entities.PathRecommendations.list('-created_date', 200).catch(() => []),
    ]);
    const missionList = alive(missions);
    const mission = missionList.find(m => m.id === g.mission_id)
      || missionList.find(m => !['completed', 'skipped'].includes(m.status))
      || missionList[0]
      || null;
    const path = (Array.isArray(paths) ? paths : []).find(
      p => p.id === (experiment?.path_id || g.path_id) || p.path_name === experiment?.path_name
    ) || null;
    setCtx({ experiment, mission, path, proofs: alive(proofs) });
  }, []);

  useEffect(() => {
    if (!guideId) { setError('No experiment was specified.'); setLoading(false); return; }
    base44.entities.MissionGuides.get(guideId)
      .then(async (g) => {
        setGuide(g);
        const p = readProgress(g);
        setStepNumber(p.resumeStep);
        setLoading(false);
        await loadContext(g);
        trackPilotEvent('mission_guide_opened', {
          experiment_id: g.experiment_id, mission_id: g.mission_id, path_id: g.path_id, dedupe_key: g.id,
        });
      })
      .catch(() => { setError('Experiment not found.'); setLoading(false); });
  }, [guideId, loadContext]);

  useEffect(() => {
    base44.auth.me()
      .then(user => base44.entities.StudentProfile.filter({ created_by_id: user.id }, '-created_date', 1))
      .then(rows => setProfile(rows?.[0] || null))
      .catch(() => setProfile(null));
  }, []);

  // ── Loading / not found ──
  if (loading) {
    return (
      <main className="app-page">
        <Sk h={15} w={150} r={5} className="mb-6" />
        <Sk h={210} r={20} className="mb-5" />
        <SkCards count={2} h={132} r={20} />
      </main>
    );
  }

  if (error || !guide) {
    return (
      <div className="app-page text-center">
        <p className="tp-lead mx-auto mb-5 text-[color:var(--ink-500)]">{error || 'Experiment not found.'}</p>
        <button onClick={() => navigate('/experiments')} className="touch-reach tp-body font-semibold text-[var(--brand-navy-900)] underline">
          Back to My Experiments
        </button>
      </div>
    );
  }

  const progress = readProgress(guide);
  const { experiment, mission, path, proofs } = ctx;
  const backToExperiment = experiment?.id ? `/experiment?experimentId=${experiment.id}` : '/experiments';

  // A guide with no steps keeps its old reading view rather than an empty wizard.
  if (progress.total === 0) {
    return (
      <main className="app-page">
        <PageHeader showBack backLabel="Back to my experiment" title={guide.guide_title} />
        <p className="tp-prose" style={{ color: 'var(--text-secondary)' }}>
          {guide.objective || 'This experiment has no steps recorded yet.'}
        </p>
        <Link to={backToExperiment} className="tp-body mt-6 inline-flex font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
          Back to my experiment
        </Link>
      </main>
    );
  }

  const step = progress.steps[stepNumber - 1] || progress.steps[0];
  const isDone = progress.completed.includes(stepNumber);
  const evidence = proofs.find(p => p.submission_key === stepEvidenceKey(guide.id, stepNumber)) || null;
  const blockers = stepBlockers(step, { note, evidence });

  // ── Actions ──
  const goToStep = async (n) => {
    const target = Math.min(Math.max(n, 1), progress.total);
    setStepNumber(target);
    setShowBlockers(false);
    const row = (guide.step_progress || []).find(r => r?.step_number === target);
    setNote(row?.note || '');
    setView('step');
    setGuide(await openStep(guide, target).catch(() => guide));
  };

  const onNote = (value) => {
    setNote(value);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      const saved = await saveStepNote(guide, stepNumber, value).catch(() => null);
      if (saved) setGuide(saved);
    }, 900);
  };

  const onNext = async () => {
    if (busy) return;
    if (!isDone && blockers.length) { setShowBlockers(true); return; }
    setBusy(true);
    try {
      let next = guide;
      if (!isDone) next = await completeStep(guide, stepNumber);
      setGuide(next);
      const after = readProgress(next);
      if (stepNumber >= progress.total) {
        if (after.allDone) { setView('done'); return; }
        // Something earlier is still open, so send them there rather than to a
        // completion screen the experiment has not earned.
        await goToStep(after.resumeStep);
        return;
      }
      await goToStep(stepNumber + 1);
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    if (stepNumber === 1) { setView('overview'); return; }
    goToStep(stepNumber - 1);
  };

  return (
    <main className="app-page">
      <div className="space-y-5">
        {view === 'overview' && (
          <>
            {language.askFamiliarity && !askDismissed && (
              <LanguageFamiliarityPrompt
                careerName={language.careerName}
                onChoose={(lvl) => { language.setLevel(lvl, 'asked'); setAskDismissed(true); }}
                onSkip={() => setAskDismissed(true)}
              />
            )}
            <GuidedOverview
              guide={guide}
              experiment={experiment}
              path={path}
              progress={progress}
              onBegin={() => goToStep(progress.resumeStep)}
              level={language.level}
              onLevelChange={language.setLevel}
            />
            {progress.allDone && (
              <button
                type="button"
                onClick={() => setView('done')}
                className="tp-body w-full rounded-[var(--r-control)] border px-5 font-semibold"
                style={{ borderColor: 'var(--border-light)', color: 'var(--brand-navy-700)', minHeight: '48px' }}
              >
                See what you finished
              </button>
            )}
            {!guide.is_active && (
              <button
                onClick={async () => {
                  if (settingActive) return;
                  setSettingActive(true);
                  try {
                    const siblings = await base44.entities.MissionGuides
                      .filter({ experiment_id: guide.experiment_id }, '-version_number', 50).catch(() => []);
                    await Promise.all(
                      siblings.filter(g => g.is_active && g.id !== guide.id)
                        .map(g => base44.entities.MissionGuides.update(g.id, { is_active: false, status: 'inactive' }))
                    );
                    await base44.entities.MissionGuides.update(guide.id, { is_active: true, status: 'active' });
                    setGuide(g => ({ ...g, is_active: true, status: 'active' }));
                  } finally {
                    setSettingActive(false);
                  }
                }}
                disabled={settingActive}
                className="tp-body inline-flex items-center gap-2 rounded-[var(--r-control)] border px-5 font-semibold disabled:opacity-60"
                style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}
              >
                {settingActive ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />}
                Set as my active experiment
              </button>
            )}
            <p className="tp-meta text-center" style={{ color: 'var(--text-muted)' }}>
              <Link to={backToExperiment} className="touch-reach font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
                Back to my experiment
              </Link>
            </p>
          </>
        )}

        {view === 'step' && step && (
          <>
            <GuidedProgress
              steps={progress.steps}
              stepNumber={stepNumber}
              completed={progress.completed}
              maxReachable={progress.maxReachable}
              onJump={goToStep}
            />
            <GuidedStepPanel
              step={step}
              stepNumber={stepNumber}
              isDone={isDone}
              guide={guide}
              experiment={experiment}
              mission={mission}
              path={path}
              profile={profile}
              evidence={evidence}
              note={note}
              onNote={onNote}
              isLastStep={stepNumber >= progress.total}
              onEvidenceSaved={async () => { await loadContext(guide); setShowBlockers(false); }}
              level={language.level}
              onLevelChange={language.setLevel}
              careerName={language.careerName}
            />
            <GuidedNav
              stepNumber={stepNumber}
              total={progress.total}
              isDone={isDone}
              blockers={blockers}
              showBlockers={showBlockers}
              onBack={onBack}
              onExit={() => navigate(backToExperiment)}
              onNext={onNext}
              busy={busy}
            />
          </>
        )}

        {view === 'done' && (
          <>
            <GuidedCompletion
              guide={guide}
              experiment={experiment}
              stepsDone={progress.completed.length}
              total={progress.total}
              evidenceCount={proofs.length}
              minutes={minutesSpent(guide)}
            />
            <p className="touch-reach-line tp-meta justify-center text-center" style={{ color: 'var(--text-muted)' }}>
              <button onClick={() => setView('overview')} className="touch-reach font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
                Review the steps
              </button>
              {' · '}
              <Link to={backToExperiment} className="touch-reach font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
                Back to my experiment
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}