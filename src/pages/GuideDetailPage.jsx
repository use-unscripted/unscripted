import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import StepArtifact from '@/components/experiments/StepArtifact';
import { trackPilotEvent } from '@/lib/pilot-metrics';
import CampusEventCard from '@/components/experiments/CampusEventCard';
import { Sk, SkCards } from '@/components/PageSkeleton';
import { ArrowLeft, Clock, CheckCircle2, Star, Loader2 } from 'lucide-react';

const STATUS_CFG = {
  active:    { bg: 'var(--success-50)', text: 'var(--success-700)', label: 'Active' },
  draft:     { bg: 'var(--ink-100)', text: 'var(--ink-500)', label: 'Draft' },
  inactive:  { bg: 'var(--ink-100)', text: 'var(--ink-500)', label: 'Inactive' },
  completed: { bg: 'var(--info-50)', text: 'var(--info-700)', label: 'Completed' },
};

function fmtDate(d) {
  if (!d) return 'Not set';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GuideDetailPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const guideId = params.get('id');

  const [guide, setGuide] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settingActive, setSettingActive] = useState(false);

  useEffect(() => {
    if (!guideId) { setError('No guide ID provided.'); setLoading(false); return; }
    base44.entities.MissionGuides.get(guideId)
      .then(g => {
        setGuide(g);
        setLoading(false);
        trackPilotEvent('mission_guide_opened', {
          experiment_id: g.experiment_id, mission_id: g.mission_id, path_id: g.path_id, dedupe_key: g.id,
        });
      })
      .catch(() => { setError('Guide not found.'); setLoading(false); });
  }, [guideId]);

  // Anything onboarding already asked for is filled into the artifacts, so the
  // student only completes what we genuinely don't know. Failing to load it just
  // means the tokens stay visible — never blocks the guide.
  useEffect(() => {
    base44.auth.me()
      // created_by_id, not user_id: StudentProfile has no user_id field, so the
      // old filter matched nothing. This is what substitutes the student's name,
      // college and major into a guide, so every guide rendered with the raw
      // placeholder tokens still showing.
      .then(user => base44.entities.StudentProfile.filter({ created_by_id: user.id }, '-created_date', 1))
      .then(rows => setProfile(rows?.[0] || null))
      .catch(() => setProfile(null));
  }, []);

  const handleSetActive = async () => {
    if (!guide || settingActive) return;
    setSettingActive(true);
    try {
      // Deactivate siblings
      const siblings = await base44.entities.MissionGuides.filter({ experiment_id: guide.experiment_id }, '-version_number', 50).catch(() => []);
      await Promise.all(
        siblings.filter(g => g.is_active && g.id !== guide.id)
          .map(g => base44.entities.MissionGuides.update(g.id, { is_active: false, status: 'inactive' }))
      );
      await base44.entities.MissionGuides.update(guide.id, { is_active: true, status: 'active' });
      setGuide(g => ({ ...g, is_active: true, status: 'active' }));
    } finally {
      setSettingActive(false);
    }
  };

  if (loading) {
    // Back link · badge row · guide title · meta · steps — the real page's
    // shape, so the guide fills the frame rather than replacing a spinner.
    return (
      <main className="app-page">
        <Sk h={15} w={150} r={5} className="mb-6" />
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap gap-2">
            <Sk h={22} w={78} r={999} />
            <Sk h={22} w={64} r={999} />
          </div>
          <div className="flex h-11 items-center"><Sk h={34} w="76%" r={8} /></div>
          <div className="mt-3 flex h-5 flex-wrap items-center gap-4">
            <Sk h={13} w={130} r={4} />
            <Sk h={13} w={70} r={4} />
            <Sk h={13} w={54} r={4} />
          </div>
        </div>
        <Sk h={42} w={196} r={10} className="mb-6" />
        <Sk h={112} r={20} className="mb-6" />
        <SkCards count={4} h={132} r={20} />
      </main>
    );
  }

  if (error || !guide) {
    return (
      <div className="app-page text-center">
        <p className="tp-lead mx-auto mb-5 text-[color:var(--ink-500)]">{error || 'Guide not found.'}</p>
        <button onClick={() => navigate('/experiments')} className="tp-body font-semibold text-[var(--brand-navy-900)] underline">
          Back to Missions
        </button>
      </div>
    );
  }

  const cfg = STATUS_CFG[guide.status] || STATUS_CFG.draft;
  const firstStepTitle = guide.steps?.find(s => s?.title)?.title || '';
  const backToExperiment = guide.experiment_id
    ? `/experiment?experimentId=${guide.experiment_id}`
    : '/experiments';

  return (
    <main className="app-page">
      {/* Back — to the experiment this guide belongs to, which is where the
          student came from and where the rest of their work lives. */}
      <button
        onClick={() => navigate(backToExperiment)}
        className="tp-body flex items-center gap-2 font-semibold text-[color:var(--ink-500)] hover:text-[color:var(--ink-700)] mb-7 transition"
      >
        <ArrowLeft size={16} /> Back to my experiment
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="tp-meta font-bold text-[color:var(--ink-400)]">Version {guide.version_number}</span>
          <span className="tp-meta rounded-full px-2.5 py-1 font-bold" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
          {guide.is_active && (
            <span className="tp-meta flex items-center gap-1 rounded-full px-2.5 py-1 font-bold" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}>
              <CheckCircle2 size={13} /> Active Guide
            </span>
          )}
        </div>
        <h1 className="tp-page text-[color:var(--surface-dark-900)]">{guide.guide_title}</h1>
        <div className="tp-meta flex flex-wrap gap-4 mt-3 text-[color:var(--ink-400)]">
          <span>Generated {fmtDate(guide.created_date)}</span>
          {guide.estimated_time && <span className="flex items-center gap-1"><Clock size={13} /> {guide.estimated_time}</span>}
          <span>{guide.steps?.length || 0} steps</span>
        </div>
      </div>

      {/* Set as Active */}
      {!guide.is_active && (
        <button
          onClick={handleSetActive}
          disabled={settingActive}
          className="tp-body mb-8 flex items-center gap-2 rounded-[10px] border border-[color:var(--ink-200)] px-5 py-3 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition disabled:opacity-60"
        >
          {settingActive ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />}
          Set as Active Guide
        </button>
      )}

      {/* Objective */}
      {guide.objective && (
        <section className="mb-8">
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Objective</p>
          <p className="tp-prose text-[color:var(--ink-700)]">{guide.objective}</p>
        </section>
      )}

      {/* Steps */}
      {guide.steps?.length > 0 && (
        <section className="mb-8">
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-4">Steps</p>
          <ol className="space-y-7">
            {guide.steps.map((s, i) => {
              // Older guides carry estimated_time as free text; newer ones a number.
              const time = s.estimated_minutes ? `${s.estimated_minutes} min` : s.estimated_time;
              const isFirstRep = s.is_first_rep ?? i === 0;
              return (
                <li key={i} className="flex gap-4">
                  <span
                    className="tp-meta shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-white mt-0.5"
                    style={{ background: 'var(--brand-navy-900)' }}
                  >{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    {isFirstRep && (
                      <p className="tp-eyebrow mb-1" style={{ color: '#7A5B12' }}>
                        Start here
                      </p>
                    )}
                    {s.title && <p className="tp-card text-[color:var(--surface-dark-900)]">{s.title}</p>}
                    {s.description && <p className="tp-prose text-[color:var(--ink-500)] mt-1.5">{s.description}</p>}
                    {time && <p className="tp-meta text-[color:var(--ink-400)] mt-2 flex items-center gap-1"><Clock size={13} /> {time}</p>}

                    {s.campus_event && (
                      <div className="mt-3">
                        <CampusEventCard event={s.campus_event} college={profile?.college} />
                      </div>
                    )}

                    <StepArtifact artifact={s.artifact} profile={profile} />

                    {(s.done_when || s.proof_capture) && (
                      <dl className="tp-meta mt-3 space-y-1">
                        {s.done_when && (
                          <div className="flex gap-1.5">
                            <dt className="shrink-0 font-bold text-[color:var(--ink-500)]">Done when</dt>
                            <dd className="text-[color:var(--ink-500)]">{s.done_when}</dd>
                          </div>
                        )}
                        {s.proof_capture && (
                          <div className="flex gap-1.5">
                            <dt className="shrink-0 font-bold text-[color:var(--ink-500)]">Proof</dt>
                            <dd className="text-[color:var(--ink-500)]">{s.proof_capture}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Deliverable */}
      {guide.deliverable && (
        <section className="mb-5 rounded-xl p-5" style={{ background: 'var(--ink-100)', border: '1px solid rgba(31,58,95,0.15)' }}>
          <p className="tp-eyebrow mb-2" style={{ color: 'var(--brand-navy-900)' }}>Deliverable</p>
          <p className="tp-prose text-[color:var(--ink-700)]">{guide.deliverable}</p>
        </section>
      )}

      {/* Proof required */}
      {guide.proof_requirement && (
        <section className="mb-5 rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-5">
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Proof Required</p>
          <p className="tp-prose text-[color:var(--ink-700)]">{guide.proof_requirement}</p>
        </section>
      )}

      {/* Reflection questions */}
      {guide.reflection_questions?.length > 0 && (
        <section className="mb-5">
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-3">Reflection Questions</p>
          <ul className="space-y-2.5">
            {guide.reflection_questions.map((q, i) => (
              <li key={i} className="tp-body flex gap-2 text-[color:var(--ink-700)]">
                <span className="shrink-0 font-bold" style={{ color: 'var(--brand-navy-900)' }}>·</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The page used to end on the last reflection question, which left a
          student who had just read the whole guide with nothing to press. */}
      <section
        className="mt-9 rounded-[20px] bg-white p-5 sm:p-6"
        style={{ border: '1px solid var(--brand-gold-500)', boxShadow: '0 10px 30px rgba(31,58,95,0.08)' }}
      >
        <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-700)' }}>Next step</p>
        <h2 className="tp-hero mt-2 text-[color:var(--surface-dark-900)]">
          {firstStepTitle ? `Do step 1: ${firstStepTitle}` : 'Go and do step 1'}
        </h2>
        <p className="tp-lead mt-2 text-[color:var(--ink-700)]">
          This is the part that happens off the screen. Work through the steps in order, then come
          back and log what happened while you still remember the details.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => navigate('/evidence?tab=proof')}
            className="ui-press tp-body inline-flex items-center justify-center rounded-[10px] px-6 font-bold text-white"
            style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
          >
            Log what I did
          </button>
          <button
            onClick={() => navigate(backToExperiment)}
            className="ui-press tp-body inline-flex items-center justify-center rounded-[10px] border px-6 font-bold"
            style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-700)', minHeight: '48px' }}
          >
            Back to my experiment
          </button>
        </div>
      </section>
    </main>
  );
}