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
import { MotionConfig, useScroll, useSpring } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import LandingSections from '@/components/landing/LandingSections';
import { ScrollProgress } from '@/components/motion';
import SiteFooter from '@/components/SiteFooter';
import { CompassIcon } from '@/components/UnscriptedLogo';

export default function Landing() {
  const nav = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

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
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen" style={{ background: '#FAFAF9' }}>
        <ScrollProgress scaleX={progress} />
        <LandingNav />
        <Hero />
        <LandingSections />
        <SiteFooter />
      </div>
    </MotionConfig>
  );
}