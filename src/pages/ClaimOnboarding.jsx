/**
 * ClaimOnboarding — protected page.
 * Reads the guest draft from localStorage, saves it to the DB, generates
 * tailored paths, then navigates to /dashboard.
 * Idempotent: checks for existing onboarding data before creating new records.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompassIcon } from '@/components/UnscriptedLogo';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { loadDraft, clearDraft, isDraftComplete } from '@/lib/guest-draft';
import { generatePathTest } from '@/lib/path-generator';

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

      const user = await base44.auth.me();

      // ── Already done: skip straight to dashboard ──
      if (user?.onboarding_completed) {
        nav('/dashboard', { replace: true });
        return;
      }

      const draft = loadDraft();

      // ── No usable draft: send to onboarding ──
      if (!isDraftComplete(draft)) {
        nav('/onboarding', { replace: true });
        return;
      }

      // ── Check idempotency: has this session been claimed already? ──
      const existingProfiles = await base44.entities.StudentProfile.list('-created_date', 5);
      const alreadyClaimed = existingProfiles.some(
        p => p.guest_session_id === draft.guest_session_id
      );

      if (!alreadyClaimed) {
        // ── Save StudentProfile from draft ──
        await base44.entities.StudentProfile.create({
          name: draft.name,
          college: draft.college,
          major: draft.major,
          graduation_year: draft.graduation_year,
          school_year: draft.school_year,
          career_interests: draft.paths_considering,
          pressured_paths: draft.pressured_path,
          secret_paths: draft.curious_path,
          desired_lifestyle: draft.desired_lifestyle,
          biggest_blocker: draft.biggest_blocker,
          commitments: draft.fixed_commitments,
          financial_priorities: draft.financial_priorities,
          priority_autonomy: draft.priority_autonomy,
          priority_stability: draft.priority_stability,
          priority_impact: draft.priority_impact,
          priority_creativity: draft.priority_creativity,
          priority_ownership: draft.priority_ownership,
          willing_financial_risk: draft.willing_financial_risk,
          willing_long_hours: draft.willing_long_hours,
          willing_to_relocate: draft.willing_to_relocate,
          class_schedule: draft.class_schedule,
          high_energy_times: draft.high_energy_times,
          low_energy_times: draft.low_energy_times,
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
          college: draft.college,
          major: draft.major,
          graduation_year: draft.graduation_year,
          school_year: draft.school_year,
          primary_path: draft.primary_path,
          comparison_path: draft.comparison_path || '',
        });
      }

      // ── Generate paths (idempotent — generator checks for existing recs) ──
      await generatePathTest();

      // ── Mark onboarding complete ──
      await base44.auth.updateMe({ onboarding_completed: true });

      // ── Clear draft only after everything succeeds ──
      clearDraft();

      nav('/dashboard', { replace: true });
    } catch (e) {
      console.error('ClaimOnboarding failed:', e);
      const msg = e?.message || 'Something went wrong. Please try again.';
      // Distinguish import vs generation failures
      if (phaseIdx >= 2) {
        setErrorType('generate');
      } else {
        setErrorType('import');
      }
      setError(msg);
    } finally {
      clearInterval(intervalId);
    }
  }, [nav, phaseIdx]);

  useEffect(() => { run(); }, []);

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center text-white" style={{ background: '#081225' }}>
        <div className="max-w-md">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: 'rgba(31,58,95,0.25)', border: '1px solid rgba(31,58,95,0.4)' }}>
            <span className="text-2xl">⚠</span>
          </div>
          <h1 className="font-heading text-2xl font-bold">
            {errorType === 'generate' ? 'Generation failed' : 'Setup failed'}
          </h1>
          <p className="mt-3 text-sm text-slate-400 leading-6">{error}</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <button onClick={run}
              className="flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-px"
              style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
              <RefreshCw size={15} /> {errorType === 'generate' ? 'Retry Generation' : 'Retry'}
            </button>
            {errorType === 'import' && (
              <button onClick={() => nav('/onboarding-review')}
                className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition">
                <ArrowLeft size={14} /> Back to onboarding review
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 text-center text-white" style={{ background: '#081225' }}>
      <div>
        <div className="mx-auto flex items-center justify-center h-16 w-16 animate-pulse">
          <CompassIcon size={56} />
        </div>
        <h1 className="font-heading mt-8 text-3xl font-bold">Building your 30-day path test.</h1>
        <p className="mt-3 text-slate-400">{PHASES[phaseIdx]}</p>
        <div className="mx-auto mt-8 h-1.5 w-64 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full animate-pulse rounded-full"
            style={{ width: `${Math.round((phaseIdx + 1) / PHASES.length * 100)}%`, background: 'var(--brand-navy-900)', transition: 'width 0.5s ease' }} />
        </div>
        <p className="mt-6 text-xs text-slate-500">This usually takes 20–30 seconds.</p>
      </div>
    </main>
  );
}