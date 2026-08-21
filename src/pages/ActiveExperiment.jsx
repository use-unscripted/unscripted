/**
 * The active experiment workspace: the one container for everything a student
 * does while testing a path: overview, mission guide, missions, the outreach
 * each mission requires, notes, evidence, reflection status and decision status.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getActiveCycle } from '@/lib/career-cycle';
import { Wand2 } from 'lucide-react';
import ExperimentOverview from '@/components/experiment/ExperimentOverview';
import ExperimentNotesPanel from '@/components/experiment/ExperimentNotesPanel';
import ExperimentStatusPanel from '@/components/experiment/ExperimentStatusPanel';
import MissionGuideHistory from '@/components/experiments/MissionGuideHistory';
import MissionGuideGenerator from '@/components/experiments/MissionGuideGenerator';
import JourneyEmptyState from '@/components/journey/JourneyEmptyState';
import MeasurementGate from '@/components/measurement/MeasurementGate';
import WhatYouLearned from '@/components/measurement/WhatYouLearned';
import ReviewedWork from '@/components/measurement/ReviewedWork';
import { loadMeasurements } from '@/lib/experiment-measurement';
import { behavioralSnapshot } from '@/lib/expectation-reality';
import { Sk } from '@/components/PageSkeleton';
import ValidationDisclosure from '@/components/validation/ValidationDisclosure';
import useExperimentValidation from '@/hooks/useExperimentValidation';

const OPEN = ['draft', 'planned', 'in_progress'];
const alive = (rows) => (Array.isArray(rows) ? rows : []).filter(r => r.deletion_status !== 'deleted');

export default function ActiveExperiment() {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [showGuideGen, setShowGuideGen] = useState(false);
  // The measurement half of the loop. Held here because this workspace is where
  // an experiment is actually started and finished.
  const [measurement, setMeasurement] = useState(null);
  const [learned, setLearned] = useState(null);
  // How well validated this experiment is, and how much it would teach THIS
  // student. Read from stored validation records, never generated.
  const validationReading = useExperimentValidation(state?.experiment);

  const load = useCallback(async () => {
    const cycle = await getActiveCycle().catch(() => null);
    const paramId = new URLSearchParams(window.location.search).get('experimentId');
    const experiments = alive(await base44.entities.Experiments.list('-created_date', 100).catch(() => []));

    let experiment = null;
    /* An id in the URL is an instruction, not a hint. The list above is the most
       recent hundred, so an older experiment was not in it and the page silently
       opened a different one instead — which is how "continue this test" landed a
       student on a test for the path they had just left. Fetch it directly. */
    if (paramId) {
      experiment = experiments.find(e => e.id === paramId)
        || await base44.entities.Experiments.get(paramId).catch(() => null);
      if (experiment?.deletion_status === 'deleted') experiment = null;
    }
    if (!experiment && cycle?.experiment_id) experiment = experiments.find(e => e.id === cycle.experiment_id) || null;
    if (!experiment && cycle?.selected_path_name) {
      experiment = experiments.find(e => e.path_name === cycle.selected_path_name && OPEN.includes(e.status)) || null;
    }
    if (!experiment) experiment = experiments.find(e => OPEN.includes(e.status)) || null;

    if (!experiment) return setState({ cycle, experiment: null });

    const [guides, proofs, reflections, paths] = await Promise.all([
      base44.entities.MissionGuides.filter({ experiment_id: experiment.id }, '-version_number', 50).catch(() => []),
      base44.entities.ProofOfWork.filter({ experiment_id: experiment.id }, '-created_date', 100).catch(() => []),
      base44.entities.WeeklyReflections.filter({ experiment_id: experiment.id }, '-created_date', 50).catch(() => []),
      base44.entities.PathRecommendations.list('-created_date', 200).catch(() => []),
    ]);
    const path = (Array.isArray(paths) ? paths : []).find(
      p => p.id === (experiment.path_id || cycle?.selected_path_id) || p.path_name === experiment.path_name
    ) || null;

    const ms = await loadMeasurements().catch(() => ({}));
    setMeasurement(ms[experiment.id] || null);

    setState({
      cycle, experiment, path,
      guides: alive(guides),
      proofs: alive(proofs),
      reflections: alive(reflections),
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  /* The student opened this experiment's own screen. A funnel stage in its own
     right: the experiment record existing never proved anyone looked at it. */
  useEffect(() => {
    const exp = state?.experiment;
    if (!exp?.id) return;
    import('@/lib/analytics/decision-funnel-events')
      .then(m => m.detailViewed({ experimentId: exp.id, pathId: exp.path_id, cycleId: exp.cycle_id }))
      .catch(() => {});
  }, [state?.experiment?.id]);

  if (!state) {
    // Matches the loaded page's padding and its space-y-5 card stack. The old
    // version used py-10 where the real page uses py-8 on mobile, so the whole
    // screen slid up 8px the moment it loaded.
    return (
      <main className="app-page">
        <div className="space-y-5">
          <Sk h={140} r={20} />
          <Sk h={188} r={20} />
          <Sk h={112} r={20} />
        </div>
      </main>
    );
  }

  if (!state.experiment) {
    return (
      <main className="app-page">
        <JourneyEmptyState variant="experiment" />
      </main>
    );
  }

  const { experiment, path, guides, proofs, reflections, cycle } = state;
  // The one to open. A guide saved as a draft is still the only guide a student
  // has, so falling back to the newest keeps the card from disappearing.
  const openGuide = guides.find(g => g.is_active) || guides[0];
  const steps = Array.isArray(openGuide?.steps) ? openGuide.steps : [];
  const firstStepTitle = steps.find(s => s?.title)?.title || '';
  // Counts of what actually happened, recorded beside the ratings and never
  // merged into them.
  const behavioral = behavioralSnapshot({
    exp: experiment,
    guide: openGuide,
    proof: proofs,
    measurement,
  });

  return (
    <main className="app-page">
      {showGuideGen && (
        <MissionGuideGenerator
          experiment={experiment}
          existingGuides={guides}
          // A guide the student just waited forty seconds for should open, not
          // land as a collapsed row in a version list they then have to go
          // find. The one case we don't hijack is a student who already had a
          // guide and deliberately chose to keep that one active.
          onGenerated={async (saved, makeActive) => {
            setShowGuideGen(false);
            if (saved?.id && (makeActive || !guides.length)) {
              navigate(`/guide?id=${saved.id}`);
              return;
            }
            await load();
          }}
          onClose={() => setShowGuideGen(false)}
        />
      )}

      <div className="space-y-5">
        <ExperimentOverview experiment={experiment} path={path} />

        {/* Before the work: what the student expects. After every mission is
            done: what actually happened. Both are what the reflection, the
            evidence profile and the next recommendation read. */}
        {experiment.status === 'completed' || experiment.status === 'skipped' ? (
          <MeasurementGate
            phase="post"
            exp={experiment}
            measurement={measurement}
            behavioral={behavioral}
            autoOpen
            onSaved={(row) => { setMeasurement(row); setLearned(row); }}
          />
        ) : (
          <MeasurementGate
            phase="pre"
            exp={experiment}
            measurement={measurement}
            autoOpen
            onSaved={setMeasurement}
          />
        )}

        {learned && <WhatYouLearned m={learned} behavioral={behavioral} />}
        {/* The review of the deliverable, kept beside the student's own rating. */}
        <ReviewedWork m={measurement} />

        {/* With no guide, this is the only thing on the page worth doing, so it
            is sized like it. The old version put it behind a 13px text link
            beside a heading, which is why 253 of 266 experiments never got one. */}
        {!guides.length ? (
          <section
            className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6"
            style={{ border: '1px solid var(--brand-gold-500)', boxShadow: '0 10px 30px rgba(31,58,95,0.08)' }}
          >
            <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-700)' }}>Next step</p>
            <h2 className="tp-hero mt-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Wand2 size={22} style={{ color: 'var(--brand-navy-700)' }} /> Build out your experiment
            </h2>
            <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
Turn the goal into actual steps: what to do first, and what to keep as proof.
            </p>
            <button
              onClick={() => setShowGuideGen(true)}
              className="ui-press tp-body mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] px-6 font-bold text-white sm:w-auto"
              style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
            >
              <Wand2 size={16} /> Build my experiment
            </button>
            <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
Takes about forty seconds.
            </p>
          </section>
        ) : (
          <section className="rounded-[var(--r-surface)] bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
            <h3 className="tp-section mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              <Wand2 size={14} style={{ color: 'var(--brand-navy-700)' }} /> My Experiment
              {openGuide && (
                <span className="tp-meta rounded-full px-2 py-0.5 font-bold" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}>
                  v{openGuide.version_number}
                </span>
              )}
            </h3>

            {/* The guide itself, one click away and showing its first move, so
                the section reads as something to open rather than a file list. */}
            {openGuide && (
              <div className="rounded-[var(--r-control)] p-4" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}>
                <p className="tp-card" style={{ color: 'var(--text-primary)' }}>{openGuide.guide_title}</p>
                <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {steps.length} steps{openGuide.estimated_time ? ` · ${openGuide.estimated_time}` : ''}
                </p>
                {firstStepTitle && (
                  <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-bold" style={{ color: 'var(--brand-gold-700)' }}>Start here: </span>
                    {firstStepTitle}
                  </p>
                )}
                <Link
                  to={`/guide?id=${openGuide.id}`}
                  className="ui-press tp-body mt-3 inline-flex w-full items-center justify-center rounded-[var(--r-control)] px-5 font-bold text-white sm:w-auto"
                  style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
                >
                  Open my experiment
                </Link>
              </div>
            )}

            {guides.length > 1 ? (
              <div className="mt-4">
                <p className="tp-eyebrow mb-2" style={{ color: 'var(--text-muted)' }}>All versions</p>
                <MissionGuideHistory
                  guides={guides}
                  onSetActive={load}
                  onDeleted={load}
                  onDuplicated={load}
                  onRenamed={load}
                  onGenerateAnother={() => setShowGuideGen(true)}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowGuideGen(true)}
                className="tp-meta mt-3 w-full rounded-[var(--r-control)] border border-dashed py-2.5 font-semibold transition"
                style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
              >
                Generate another experiment
              </button>
            )}
          </section>
        )}

        <ExperimentNotesPanel experiment={experiment} />

        <ExperimentStatusPanel proofs={proofs} reflections={reflections} cycle={cycle} />

        {/* Strength and review history: available, but never the first thing. */}
        <ValidationDisclosure reading={validationReading} pathName={path?.path_name} />

        <p className="touch-reach-line tp-meta justify-center pt-1 text-center" style={{ color: 'var(--text-muted)' }}>
          <Link to="/journey" className="touch-reach font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Back to My Journey</Link>
          {' · '}
          <Link to="/experiments" className="touch-reach font-semibold" style={{ color: 'var(--brand-navy-700)' }}>All experiments</Link>
        </p>
      </div>
    </main>
  );
}