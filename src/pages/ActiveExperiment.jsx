/**
 * The active experiment workspace: the one container for everything a student
 * does while testing a path: overview, mission guide, missions, the outreach
 * each mission requires, notes, evidence, reflection status and decision status.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getActiveCycle } from '@/lib/career-cycle';
import { CheckCircle2, Plus, Wand2 } from 'lucide-react';
import ExperimentOverview from '@/components/experiment/ExperimentOverview';
import MissionItem from '@/components/experiment/MissionItem';
import CompleteMissionModal from '@/components/experiment/CompleteMissionModal';
import ExperimentNotesPanel from '@/components/experiment/ExperimentNotesPanel';
import ExperimentStatusPanel from '@/components/experiment/ExperimentStatusPanel';
import MissionGuideHistory from '@/components/experiments/MissionGuideHistory';
import MissionGuideGenerator from '@/components/experiments/MissionGuideGenerator';
import AddMissionModal from '@/components/experiments/AddMissionModal';
import JourneyEmptyState from '@/components/journey/JourneyEmptyState';
import MeasurementGate from '@/components/measurement/MeasurementGate';
import WhatYouLearned from '@/components/measurement/WhatYouLearned';
import ReviewedWork from '@/components/measurement/ReviewedWork';
import { loadMeasurements } from '@/lib/experiment-measurement';
import { Sk } from '@/components/PageSkeleton';

const OPEN = ['draft', 'planned', 'in_progress'];
const alive = (rows) => (Array.isArray(rows) ? rows : []).filter(r => r.deletion_status !== 'deleted');

export default function ActiveExperiment() {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [justDone, setJustDone] = useState(null);
  const [showGuideGen, setShowGuideGen] = useState(false);
  const [showAddMission, setShowAddMission] = useState(false);
  // The measurement half of the loop. Held here because this workspace is where
  // an experiment is actually started and finished.
  const [measurement, setMeasurement] = useState(null);
  const [learned, setLearned] = useState(null);

  const load = useCallback(async () => {
    const cycle = await getActiveCycle().catch(() => null);
    const paramId = new URLSearchParams(window.location.search).get('experimentId');
    const experiments = alive(await base44.entities.Experiments.list('-created_date', 100).catch(() => []));

    let experiment = null;
    if (paramId) experiment = experiments.find(e => e.id === paramId) || null;
    if (!experiment && cycle?.experiment_id) experiment = experiments.find(e => e.id === cycle.experiment_id) || null;
    if (!experiment && cycle?.selected_path_name) {
      experiment = experiments.find(e => e.path_name === cycle.selected_path_name && OPEN.includes(e.status)) || null;
    }
    if (!experiment) experiment = experiments.find(e => OPEN.includes(e.status)) || null;

    if (!experiment) return setState({ cycle, experiment: null });

    const [missions, guides, proofs, reflections, contacts, paths] = await Promise.all([
      base44.entities.Missions.filter({ experiment_id: experiment.id }, 'created_date', 100).catch(() => []),
      base44.entities.MissionGuides.filter({ experiment_id: experiment.id }, '-version_number', 50).catch(() => []),
      base44.entities.ProofOfWork.filter({ experiment_id: experiment.id }, '-created_date', 100).catch(() => []),
      base44.entities.WeeklyReflections.filter({ experiment_id: experiment.id }, '-created_date', 50).catch(() => []),
      base44.entities.OutreachContacts.filter({ experiment_id: experiment.id }, '-created_date', 100).catch(() => []),
      base44.entities.PathRecommendations.list('-created_date', 200).catch(() => []),
    ]);
    const path = (Array.isArray(paths) ? paths : []).find(
      p => p.id === (experiment.path_id || cycle?.selected_path_id) || p.path_name === experiment.path_name
    ) || null;

    const ms = await loadMeasurements().catch(() => ({}));
    setMeasurement(ms[experiment.id] || null);

    setState({
      cycle, experiment, path,
      missions: alive(missions),
      guides: alive(guides),
      proofs: alive(proofs),
      reflections: alive(reflections),
      contacts: alive(contacts),
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const onCompleted = async (result) => {
    setCompleting(null);
    setJustDone(result);
    await load();
  };

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

  const { experiment, path, missions, guides, proofs, reflections, contacts, cycle } = state;
  const nextMission = missions.find(m => !['completed', 'skipped'].includes(m.status));
  // The one to open. A guide saved as a draft is still the only guide a student
  // has, so falling back to the newest keeps the card from disappearing.
  const openGuide = guides.find(g => g.is_active) || guides[0];
  const firstStepTitle = openGuide?.steps?.find(s => s?.title)?.title || '';

  return (
    <main className="app-page">
      {completing && (
        <CompleteMissionModal
          mission={completing}
          experiment={experiment}
          path={path}
          onClose={() => setCompleting(null)}
          onCompleted={onCompleted}
        />
      )}
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
      {showAddMission && (
        <AddMissionModal
          experiment={experiment}
          onClose={() => setShowAddMission(false)}
          onSaved={async () => { setShowAddMission(false); await load(); }}
        />
      )}

      <div className="space-y-5">
        {justDone && (
          <section className="rounded-[16px] p-5" role="status" style={{ background: 'var(--success-50)', border: '1px solid #BBF7D0' }}>
            <p className="tp-body flex items-center gap-2 font-bold" style={{ color: '#14532D' }}>
              <CheckCircle2 size={16} /> Evidence attached to this mission{justDone.reused ? ' (already recorded)' : ''}.
            </p>
            <p className="tp-body mt-1" style={{ color: '#166534' }}>
              {justDone.experimentCompleted
                ? 'Every mission is done. Next: reflect on what this told you.'
                : nextMission
                  ? `Next: ${nextMission.title}`
                  : 'Next: reflect on what this experiment told you.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {(justDone.experimentCompleted || !nextMission) && (
                <Link to="/evidence?tab=reflect"
                  className="ui-press tp-body inline-flex items-center rounded-[10px] px-5 font-bold text-white"
                  style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}>
                  Reflect on this experiment
                </Link>
              )}
              <button onClick={() => setJustDone(null)} className="tp-body font-semibold" style={{ color: '#166534' }}>
                Stay here
              </button>
            </div>
          </section>
        )}

        <ExperimentOverview experiment={experiment} path={path} missions={missions} />

        {/* Before the work: what the student expects. After every mission is
            done: what actually happened. Both are what the reflection, the
            evidence profile and the next recommendation read. */}
        {experiment.status === 'completed' || experiment.status === 'skipped' ? (
          <MeasurementGate
            phase="post"
            exp={experiment}
            measurement={measurement}
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

        {learned && <WhatYouLearned m={learned} />}
        {/* The review of the deliverable, kept beside the student's own rating. */}
        <ReviewedWork m={measurement} />

        {/* With no guide, this is the only thing on the page worth doing, so it
            is sized like it. The old version put it behind a 13px text link
            beside a heading, which is why 253 of 266 experiments never got one. */}
        {!guides.length ? (
          <section
            className="rounded-[20px] bg-white p-5 sm:p-6"
            style={{ border: '1px solid var(--brand-gold-500)', boxShadow: '0 10px 30px rgba(31,58,95,0.08)' }}
          >
            <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-700)' }}>Next step</p>
            <h2 className="tp-hero mt-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Wand2 size={22} style={{ color: 'var(--brand-navy-700)' }} /> Build out your experiment
            </h2>
            <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
              Right now this experiment is a title and a goal. Building it out turns it into the actual
              moves: who to contact first, the email to send them, and what to keep as proof you
              did it.
            </p>
            <button
              onClick={() => setShowGuideGen(true)}
              className="ui-press tp-body mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-6 font-bold text-white sm:w-auto"
              style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
            >
              <Wand2 size={16} /> Build my experiment
            </button>
            <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
              Takes about forty seconds. If the first one isn't right, generate another.
            </p>
          </section>
        ) : (
          <section className="rounded-[16px] bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
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
              <div className="rounded-[14px] p-4" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}>
                <p className="tp-card" style={{ color: 'var(--text-primary)' }}>{openGuide.guide_title}</p>
                <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {openGuide.steps?.length || 0} steps{openGuide.estimated_time ? ` · ${openGuide.estimated_time}` : ''}
                </p>
                {firstStepTitle && (
                  <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-bold" style={{ color: 'var(--brand-gold-700)' }}>Start here: </span>
                    {firstStepTitle}
                  </p>
                )}
                <Link
                  to={`/guide?id=${openGuide.id}`}
                  className="ui-press tp-body mt-3 inline-flex w-full items-center justify-center rounded-[10px] px-5 font-bold text-white sm:w-auto"
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
                className="tp-meta mt-3 w-full rounded-xl border border-dashed py-2.5 font-semibold transition"
                style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
              >
                Generate another experiment
              </button>
            )}
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="tp-section" style={{ color: 'var(--text-primary)' }}>
              Missions {missions.length ? `(${missions.length})` : ''}
            </h3>
            <button onClick={() => setShowAddMission(true)}
              className="touch-reach tp-meta inline-flex items-center gap-1.5 font-bold" style={{ color: 'var(--brand-navy-700)' }}>
              <Plus size={13} /> Add mission
            </button>
          </div>
          {missions.length === 0 ? (
            <div className="rounded-[14px] bg-white p-6 text-center" style={{ border: '1px dashed var(--border-light)' }}>
              <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>No missions yet</p>
              <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
                {guides.length
                  ? 'Your experiment has the steps. Add a mission here for anything you want to track separately.'
                  : 'Start by building your experiment above, or add the first mission yourself.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {missions.map(m => (
                <MissionItem
                  key={m.id}
                  mission={m}
                  experiment={experiment}
                  path={path}
                  contacts={contacts.filter(c => c.mission_id === m.id)}
                  proofs={proofs.filter(p => p.mission_id === m.id)}
                  onChanged={load}
                  onComplete={setCompleting}
                />
              ))}
            </div>
          )}
        </section>

        <ExperimentNotesPanel experiment={experiment} />

        <ExperimentStatusPanel proofs={proofs} reflections={reflections} cycle={cycle} />

        <p className="touch-reach-line tp-meta justify-center pt-1 text-center" style={{ color: 'var(--text-muted)' }}>
          <Link to="/journey" className="touch-reach font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Back to My Journey</Link>
          {' · '}
          <Link to="/experiments" className="touch-reach font-semibold" style={{ color: 'var(--brand-navy-700)' }}>All experiments</Link>
        </p>
      </div>
    </main>
  );
}