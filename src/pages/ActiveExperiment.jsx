/**
 * The active experiment workspace — the one container for everything a student
 * does while testing a path: overview, mission guide, missions, the outreach
 * each mission requires, notes, evidence, reflection status and decision status.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { Sk } from '@/components/PageSkeleton';

const OPEN = ['draft', 'planned', 'in_progress'];
const alive = (rows) => (Array.isArray(rows) ? rows : []).filter(r => r.deletion_status !== 'deleted');

export default function ActiveExperiment() {
  const [state, setState] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [justDone, setJustDone] = useState(null);
  const [showGuideGen, setShowGuideGen] = useState(false);
  const [showAddMission, setShowAddMission] = useState(false);

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
      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
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
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <JourneyEmptyState variant="experiment" />
      </main>
    );
  }

  const { experiment, path, missions, guides, proofs, reflections, contacts, cycle } = state;
  const nextMission = missions.find(m => !['completed', 'skipped'].includes(m.status));
  const activeGuide = guides.find(g => g.is_active);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
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
          onGenerated={async () => { setShowGuideGen(false); await load(); }}
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
            <p className="flex items-center gap-2 text-sm font-bold" style={{ color: '#14532D' }}>
              <CheckCircle2 size={16} /> Evidence attached to this mission{justDone.reused ? ' (already recorded)' : ''}.
            </p>
            <p className="mt-1 text-sm" style={{ color: '#166534' }}>
              {justDone.experimentCompleted
                ? 'Every mission is done. Next: reflect on what this told you.'
                : nextMission
                  ? `Next: ${nextMission.title}`
                  : 'Next: reflect on what this experiment told you.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {(justDone.experimentCompleted || !nextMission) && (
                <Link to="/evidence?tab=reflect"
                  className="ui-press inline-flex items-center rounded-[10px] px-5 text-sm font-bold text-white"
                  style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}>
                  Reflect on this experiment
                </Link>
              )}
              <button onClick={() => setJustDone(null)} className="text-sm font-semibold" style={{ color: '#166534' }}>
                Stay here
              </button>
            </div>
          </section>
        )}

        <ExperimentOverview experiment={experiment} path={path} missions={missions} />

        <section className="rounded-[16px] bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading flex items-center gap-1.5 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              <Wand2 size={14} style={{ color: 'var(--brand-navy-700)' }} /> Mission Guide
              {activeGuide && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}>
                  v{activeGuide.version_number}
                </span>
              )}
            </h3>
            <button onClick={() => setShowGuideGen(true)} className="text-xs font-bold" style={{ color: 'var(--brand-navy-700)' }}>
              {guides.length ? 'Generate another' : 'Generate a guide'}
            </button>
          </div>
          {guides.length ? (
            <MissionGuideHistory
              guides={guides}
              onSetActive={load}
              onDeleted={load}
              onDuplicated={load}
              onRenamed={load}
              onGenerateAnother={() => setShowGuideGen(true)}
            />
          ) : (
            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
              No guide yet. Generate one for step-by-step instructions.
            </p>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-heading text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Missions {missions.length ? `(${missions.length})` : ''}
            </h3>
            <button onClick={() => setShowAddMission(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--brand-navy-700)' }}>
              <Plus size={13} /> Add mission
            </button>
          </div>
          {missions.length === 0 ? (
            <div className="rounded-[14px] bg-white p-6 text-center" style={{ border: '1px dashed var(--border-light)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No missions yet</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Generate a mission guide, or add the first mission yourself.
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

        <p className="pt-1 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          <Link to="/journey" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Back to My Journey</Link>
          {' · '}
          <Link to="/experiments" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>All experiments</Link>
        </p>
      </div>
    </main>
  );
}