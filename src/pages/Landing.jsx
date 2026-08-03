/* ──────────────────────────────────────────────────────────────────────────
   Landing (after).

   Structurally identical to the current page — same sections, same copy,
   same order. Everything that changed is motion.

   MotionConfig reducedMotion="user" is the safety net: any framer-motion
   transform in the tree is automatically neutered for users who've asked
   their OS for reduced motion, while opacity fades still run. The custom
   primitives in motion.jsx check useReducedMotion() individually on top of
   that.
   ────────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import LandingSections from '@/components/landing/LandingSections';
import SiteFooter from '@/components/SiteFooter';
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
          nav('/journey', { replace: true });
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
      <div className="grid min-h-screen place-items-center" style={{ background: 'var(--page-surface)' }}>
        <div className="flex flex-col items-center gap-4">
          <CompassIcon size={32} className="animate-pulse" />
          <div
            className="h-5 w-5 animate-spin rounded-full border-2"
            style={{ borderColor: 'var(--border-light)', borderTopColor: 'var(--brand-navy-900)' }}
          />
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      {/* The scroll-progress bar that used to sit here was decoration: a
          marketing page isn't a long-form article, and the reader has a
          scrollbar. Removed. */}
      <div className="min-h-screen" style={{ background: 'var(--page-surface)' }}>
        <LandingNav />
        <Hero />
        <LandingSections />
        <SiteFooter />
      </div>
    </MotionConfig>
  );
}