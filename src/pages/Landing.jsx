import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import LandingSections from '@/components/landing/LandingSections';
import { CompassIcon } from '@/components/UnscriptedLogo';

export default function Landing() {
  const nav = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (authed) => {
      if (!authed) { setAuthChecked(true); return; }
      try {
        const user = await base44.auth.me();
        if (user?.onboarding_completed) {
          nav('/dashboard', { replace: true });
        } else {
          nav('/claim-onboarding', { replace: true });
        }
      } catch {
        setAuthChecked(true);
      }
    });
  }, []);

  if (!authChecked) {
    return (
      <div className="grid min-h-screen place-items-center" style={{ background: '#FAFAF9' }}>
        <div className="flex flex-col items-center gap-4">
          <CompassIcon size={32} className="animate-pulse" />
          <div className="w-5 h-5 rounded-full border-2 border-[#E2E8F0] border-t-[#1F3A5F] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9' }}>
      <LandingNav />
      <Hero />
      <LandingSections />
      <footer className="border-t border-[#E2E8F0] px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-sm text-[#64748B]">
          <CompassIcon size={14} />
          © 2026 Unscripted. Write your unscripted path.
        </div>
      </footer>
    </div>
  );
}