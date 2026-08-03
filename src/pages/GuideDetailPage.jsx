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
  if (!d) return '—';
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
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <Sk h={14} w={150} r={5} className="mb-6" />
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap gap-2">
            <Sk h={22} w={78} r={999} />
            <Sk h={22} w={64} r={999} />
          </div>
          <div className="flex h-9 items-center"><Sk h={30} w="76%" r={8} /></div>
          <div className="mt-2 flex h-4 flex-wrap items-center gap-4">
            <Sk h={11} w={130} r={4} />
            <Sk h={11} w={70} r={4} />
            <Sk h={11} w={54} r={4} />
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
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-[color:var(--ink-500)] mb-4">{error || 'Guide not found.'}</p>
        <button onClick={() => navigate('/experiments')} className="text-sm font-semibold text-[var(--brand-navy-900)] underline">
          Back to Missions
        </button>
      </div>
    );
  }

  const cfg = STATUS_CFG[guide.status] || STATUS_CFG.draft;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      {/* Back */}
      <button
        onClick={() => navigate('/experiments')}
        className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink-500)] hover:text-[color:var(--ink-700)] mb-6 transition"
      >
        <ArrowLeft size={15} /> Back to Missions
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-bold text-[color:var(--ink-400)]">Version {guide.version_number}</span>
          <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
          {guide.is_active && (
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}>
              <CheckCircle2 size={11} /> Active Guide
            </span>
          )}
        </div>
        <h1 className="font-heading text-3xl font-bold text-[color:var(--surface-dark-900)]">{guide.guide_title}</h1>
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-[color:var(--ink-400)]">
          <span>Generated {fmtDate(guide.created_date)}</span>
          {guide.estimated_time && <span className="flex items-center gap-1"><Clock size={11} /> {guide.estimated_time}</span>}
          <span>{guide.steps?.length || 0} steps</span>
        </div>
      </div>

      {/* Set as Active */}
      {!guide.is_active && (
        <button
          onClick={handleSetActive}
          disabled={settingActive}
          className="mb-6 flex items-center gap-2 rounded-[10px] border border-[color:var(--ink-200)] px-4 py-2.5 text-sm font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition disabled:opacity-60"
        >
          {settingActive ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
          Set as Active Guide
        </button>
      )}

      {/* Objective */}
      {guide.objective && (
        <section className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-2">Objective</p>
          <p className="text-sm text-[color:var(--ink-700)] leading-relaxed">{guide.objective}</p>
        </section>
      )}

      {/* Steps */}
      {guide.steps?.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-3">Steps</p>
          <ol className="space-y-5">
            {guide.steps.map((s, i) => {
              // Older guides carry estimated_time as free text; newer ones a number.
              const time = s.estimated_minutes ? `${s.estimated_minutes} min` : s.estimated_time;
              const isFirstRep = s.is_first_rep ?? i === 0;
              return (
                <li key={i} className="flex gap-4">
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white mt-0.5"
                    style={{ background: 'var(--brand-navy-900)' }}
                  >{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    {isFirstRep && (
                      <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: '#7A5B12' }}>
                        Start here
                      </p>
                    )}
                    {s.title && <p className="font-semibold text-[color:var(--surface-dark-900)] text-sm">{s.title}</p>}
                    {s.description && <p className="text-sm text-[color:var(--ink-500)] mt-0.5 leading-relaxed">{s.description}</p>}
                    {time && <p className="text-xs text-[color:var(--ink-400)] mt-1 flex items-center gap-1"><Clock size={10} /> {time}</p>}

                    {s.campus_event && (
                      <div className="mt-3">
                        <CampusEventCard event={s.campus_event} college={profile?.college} />
                      </div>
                    )}

                    <StepArtifact artifact={s.artifact} profile={profile} />

                    {(s.done_when || s.proof_capture) && (
                      <dl className="mt-2 space-y-1 text-xs">
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
        <section className="mb-4 rounded-xl p-4" style={{ background: 'var(--ink-100)', border: '1px solid rgba(31,58,95,0.15)' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--brand-navy-900)' }}>Deliverable</p>
          <p className="text-sm text-[color:var(--ink-700)]">{guide.deliverable}</p>
        </section>
      )}

      {/* Proof required */}
      {guide.proof_requirement && (
        <section className="mb-4 rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-1">Proof Required</p>
          <p className="text-sm text-[color:var(--ink-700)]">{guide.proof_requirement}</p>
        </section>
      )}

      {/* Reflection questions */}
      {guide.reflection_questions?.length > 0 && (
        <section className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-2">Reflection Questions</p>
          <ul className="space-y-2">
            {guide.reflection_questions.map((q, i) => (
              <li key={i} className="flex gap-2 text-sm text-[color:var(--ink-700)]">
                <span className="shrink-0 font-bold" style={{ color: 'var(--brand-navy-900)' }}>·</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}