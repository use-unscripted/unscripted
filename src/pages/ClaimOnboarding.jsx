/**
 * ClaimOnboarding: a protected page.
 * Reads the guest draft from localStorage, saves it to the DB, generates
 * tailored paths, then navigates to /journey.
 * Idempotent: checks for existing onboarding data before creating new records.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompassIcon } from '@/components/UnscriptedLogo';
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { loadDraft, clearDraft, isDraftComplete } from '@/lib/guest-draft';
import { generatePathTest } from '@/lib/path-generator';
import { trackFunnel, trackFunnelOnce } from '@/lib/funnel';

const PHASES = [
  'Saving your onboarding answers...',
  'Analyzing your profile and priorities...',
  'Building your tailored path recommendations...',
  'Generating your 30-day experiment plan...',
];

export default function ClaimOnboarding() {
  const nav = useNavigate();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null); // 'import' | 'generate'

  const run = useCallback(async () => {
    setError(null);
    setErrorType(null);
    setPhaseIdx(0);

    let intervalId;
    try {
      intervalId = setInterval(() => setPhaseIdx(i => Math.min(i + 1, PHASES.length - 1)), 3500);

      // Signed in and back to collect what they filled in as a guest. This is
      // the far side of the wall for every sign-up method, including Google,
      // where the provider redirect means no register event ever fires.
      trackFunnelOnce('claim_started', 'claim_started');

      const user = await base44.auth.me();

      // ── Already done: skip straight to dashboard ──
      if (user?.onboarding_completed) {
        nav('/journey', { replace: true });
        return;
      }

      const draft = loadDraft();
      const existingProfiles = await base44.entities.StudentProfile.list('-created_date', 5);

      // ── No usable draft ──
      if (!isDraftComplete(draft)) {
        if (existingProfiles.length > 0) {
          // Answers were already saved on a previous attempt, so finish setup
          // instead of sending the user back through onboarding again.
          await generatePathTest();
          trackFunnel('paths_generated', { from: 'saved_profile' });
          await base44.auth.updateMe({ onboarding_completed: true });
          clearDraft();
          nav('/journey', { replace: true });
          return;
        }
        nav('/onboarding', { replace: true });
        return;
      }

      // ── Check idempotency: has this session been claimed already? ──
      const alreadyClaimed = existingProfiles.some(
        p => p.guest_session_id === draft.guest_session_id
      );

      if (!alreadyClaimed) {
        // ── Save StudentProfile from draft ──
        await base44.entities.StudentProfile.create({
          name: draft.name,
          education_stage: draft.education_stage || 'college',
          college: draft.college || 'Not specified',
          major: draft.major || 'Undecided',
          graduation_year: draft.graduation_year,
          school_year: draft.school_year,
          // The intake no longer asks "paths you are considering" separately:
          // the path they chose to test is the answer to that question.
          career_interests: draft.primary_path,
          pressured_paths: draft.pressured_path,
          secret_paths: draft.curious_path,
          desired_lifestyle: draft.desired_lifestyle,
          // Collected as chips since the vision question shipped, but never
          // written here, so the generator's [themes: …] clause was always
          // empty. It is mapped now.
          vision_themes: draft.vision_themes,
          biggest_blocker: draft.biggest_blocker,
          commitments: draft.fixed_commitments,
          priority_autonomy: draft.priority_autonomy,
          priority_stability: draft.priority_stability,
          priority_impact: draft.priority_impact,
          priority_creativity: draft.priority_creativity,
          priority_ownership: draft.priority_ownership,
          willing_financial_risk: draft.willing_financial_risk,
          willing_long_hours: draft.willing_long_hours,
          available_hours_per_week: draft.available_hours_per_week || 8,
          guest_session_id: draft.guest_session_id,
          personal_notes: draft.personal_notes || '',
          long_term_ambitions: draft.long_term_ambitions || '',
          responsibilities_constraints: draft.responsibilities_constraints || '',
          things_to_avoid: draft.things_to_avoid || '',
          priorities_for_recommendations: draft.priorities_for_recommendations || '',
        });

        // ── Save path selections to user meta ──
        await base44.auth.updateMe({
          education_stage: draft.education_stage || 'college',
          college: draft.college,
          major: draft.major,
          graduation_year: draft.graduation_year,
          school_year: draft.school_year,
          primary_path: draft.primary_path,
          comparison_path: draft.comparison_path || '',
        });
      }

      // ── Generate paths (idempotent: generator checks for existing recs) ──
      await generatePathTest();
      // The end of the funnel, and the only point where the wall's stated
      // cost (a real model call) is actually paid.
      trackFunnel('paths_generated', { from: 'guest_draft' });

      // ── Mark onboarding complete ──
      await base44.auth.updateMe({ onboarding_completed: true });

      // ── Clear draft only after everything succeeds ──
      clearDraft();

      nav('/journey', { replace: true });
    } catch (e) {
      const msg = e?.message || 'Something went wrong. Please try again.';
      // Distinguish import vs generation failures. This picks the recovery UI.
      const stage = phaseIdx >= 2 ? 'generate' : 'import';
      setErrorType(stage);
      // A generation failure now says which step of the pipeline broke; an
      // import failure has no finer grain to report. Codes and stage names are
      // fixed strings, no message text, which can carry server detail.
      const detail = e?.stage || null;
      const codes = Array.isArray(e?.codes) && e.codes.length ? e.codes.join(',') : null;
      console.error(`ClaimOnboarding failed at stage=${detail || stage}${codes ? ` codes=${codes}` : ''}`);
      trackFunnel('claim_failed', { stage, ...(detail ? { detail } : {}), ...(codes ? { codes } : {}) });
      setError(msg);
    } finally {
      clearInterval(intervalId);
    }
  }, [nav, phaseIdx]);

  useEffect(() => { run(); }, []);

  if (error) {
    return (
      <main className="grid min-h-[100svh] place-items-center px-6 text-center text-white" style={{ background: 'var(--surface-dark-700)' }}>
        <div className="max-w-md">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: 'rgba(31,58,95,0.25)', border: '1px solid rgba(31,58,95,0.4)' }}>
            <AlertTriangle size={24} aria-hidden="true" />
          </div>
          <h1 className="tp-page">
            {errorType === 'generate' ? 'Generation failed' : 'Setup failed'}
          </h1>
          <p className="tp-lead mt-3 text-[color:var(--ink-400)]">{error}</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <button onClick={run}
              className="flex items-center gap-2 rounded-[var(--r-control)] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-px"
              style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
              <RefreshCw size={15} /> {errorType === 'generate' ? 'Retry Generation' : 'Retry'}
            </button>
            {errorType === 'import' && (
              <button onClick={() => nav('/onboarding-review')}
                className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink-400)] hover:text-white transition">
                <ArrowLeft size={14} /> Back to onboarding review
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-[100svh] place-items-center px-6 text-center text-white" style={{ background: 'var(--surface-dark-700)' }}>
      <div>
        <div className="mx-auto flex items-center justify-center h-16 w-16 animate-pulse">
          <CompassIcon size={56} />
        </div>
        <h1 className="tp-page mt-8">Building your 30-day path test.</h1>
        <p className="tp-lead mx-auto mt-3 text-[color:var(--ink-400)]">{PHASES[phaseIdx]}</p>
        <div className="mx-auto mt-8 h-1.5 w-64 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full animate-pulse rounded-full"
            style={{ width: `${Math.round((phaseIdx + 1) / PHASES.length * 100)}%`, background: 'var(--brand-navy-900)', transition: 'width 0.5s ease' }} />
        </div>
        <p className="tp-meta mt-6 text-[color:var(--ink-500)]">This usually takes 20-30 seconds.</p>
      </div>
    </main>
  );
}