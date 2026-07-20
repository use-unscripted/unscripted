import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Clock, Target, Zap } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';
import { loadDraft, saveDraft } from '@/lib/guest-draft';
import { base44 } from '@/api/base44Client';

export default function OnboardingReview() {
  const nav = useNavigate();
  const [draft, setDraft] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const d = loadDraft();
    if (!d || !d.primary_path) {
      // No usable draft — send back to start
      nav('/onboarding', { replace: true });
      return;
    }
    setDraft(d);

    // If already authenticated and onboarding done, go straight to dashboard
    base44.auth.isAuthenticated().then(async authed => {
      if (authed) {
        const user = await base44.auth.me().catch(() => null);
        if (user?.onboarding_completed) {
          nav('/dashboard', { replace: true });
        } else {
          // Authenticated but not finished — go claim
          nav('/claim-onboarding', { replace: true });
        }
      }
    }).finally(() => setChecking(false));
  }, []);

  if (checking || !draft) return null;

  const tradeoffs = draft.desired_lifestyle
    ? `Lifestyle goal: ${draft.desired_lifestyle.slice(0, 80)}${draft.desired_lifestyle.length > 80 ? '...' : ''}`
    : null;

  const handleCreateAccount = () => {
    // Ensure draft is persisted before navigating away
    saveDraft({ ...draft });
    nav('/register');
  };

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: '#FAFAF9' }}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 flex items-center justify-between">
          <LogoWordmark />
          <Link to="/login" className="text-sm font-semibold text-[#64748B] hover:text-[#050816] transition">Log in</Link>
        </div>

        {/* Completion badge */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: '#F8ECEF', border: '2px solid rgba(139,12,33,0.25)' }}>
            <Target size={28} style={{ color: '#8B0C21' }} />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-[#050816]">
            Your 30-Day Path Test Is Ready
          </h1>
          <p className="mt-3 max-w-lg text-[#64748B] leading-6">
            You've completed the intake. Create a free account to generate your three tailored paths, save your Mission Guides, and track what you learn.
          </p>
        </div>

        {/* Summary card */}
        <div className="mb-6 rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[.14em] mb-5" style={{ color: '#8B0C21' }}>Your intake summary</p>

          <div className="space-y-4">
            {draft.name && (
              <div className="flex gap-3">
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center" style={{ background: '#F8ECEF' }}>
                  <span className="text-[10px] font-bold" style={{ color: '#8B0C21' }}>1</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">About you</p>
                  <p className="text-sm text-[#334155]">{draft.name}{draft.college ? ` · ${draft.college}` : ''}{draft.major ? ` · ${draft.major}` : ''}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center" style={{ background: '#F8ECEF' }}>
                <span className="text-[10px] font-bold" style={{ color: '#8B0C21' }}>2</span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Primary path to test</p>
                <p className="text-sm font-semibold text-[#050816]">{draft.primary_path}</p>
                {draft.comparison_path && (
                  <p className="text-sm text-[#64748B]">Comparing against: {draft.comparison_path}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center" style={{ background: '#F8ECEF' }}>
                <Clock size={11} style={{ color: '#8B0C21' }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Weekly availability</p>
                <p className="text-sm text-[#334155]">{draft.available_hours_per_week || 8} hours per week available for path-testing</p>
              </div>
            </div>

            {tradeoffs && (
              <div className="flex gap-3">
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center" style={{ background: '#F8ECEF' }}>
                  <Zap size={11} style={{ color: '#8B0C21' }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Tradeoff to explore</p>
                  <p className="text-sm text-[#334155]">{tradeoffs}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm text-center">
          <p className="text-sm text-[#64748B] mb-6 leading-6">
            Create a free account to generate your three tailored paths, save your Mission Guides, and track what you learn.
          </p>
          <button onClick={handleCreateAccount}
            className="w-full flex items-center justify-center gap-2 rounded-[10px] py-3.5 text-sm font-semibold text-white transition hover:-translate-y-px"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
            Create My Free Account <ArrowRight size={16} />
          </button>
          <p className="mt-4 text-sm text-[#94A3B8]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold underline" style={{ color: '#8B0C21' }}>Log in</Link>
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <button onClick={() => nav('/paths-intake')}
            className="flex items-center gap-2 text-sm font-semibold text-[#64748B] hover:text-[#050816] transition">
            <ArrowLeft size={14} /> Edit my path selection
          </button>
        </div>
      </div>
    </main>
  );
}