import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import LandingSections from '@/components/landing/LandingSections';

export default function Landing() {
  const nav = useNavigate();
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'guest' | 'no-onboarding' | 'done'

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (authed) => {
      if (!authed) { setAuthState('guest'); return; }
      try {
        const user = await base44.auth.me();
        setAuthState(user?.onboarding_completed ? 'done' : 'no-onboarding');
      } catch {
        setAuthState('guest');
      }
    });
  }, []);

  // Logged-in users visiting "/" get forwarded immediately
  useEffect(() => {
    if (authState === 'done') nav('/dashboard', { replace: true });
    if (authState === 'no-onboarding') nav('/onboarding', { replace: true });
  }, [authState]);

  if (authState === 'loading' || authState === 'done' || authState === 'no-onboarding') {
    return (
      <div className="grid min-h-screen place-items-center" style={{ background: '#F8FAFC' }}>
        <div className="w-7 h-7 rounded-full border-2 border-[#E2E8F0] border-t-[#2563EB] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <LandingNav />
      <Hero />
      <LandingSections />
      <footer className="border-t border-[#E2E8F0] px-6 py-8 text-center text-sm text-[#64748B]">
        © 2026 AmbitionOS · Build a life on your terms.
      </footer>
    </div>
  );
}