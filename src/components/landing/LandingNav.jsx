/* ──────────────────────────────────────────────────────────────────────────
   LandingNav — condenses on scroll.

   Before: a static nav that scrolls away with the page.
   After:  sticks, shrinks, and picks up a translucent blurred backdrop once
           you leave the hero. Links get a gold underline that wipes in from
           the left rather than a colour swap.
   ────────────────────────────────────────────────────────────────────────── */
import { Link } from 'react-router-dom';
import { motion, useMotionValueEvent, useScroll, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { LogoFull } from '@/components/UnscriptedLogo';
import { EASE } from '@/components/motion';

/* The gold underline used to be driven by the pointer alone, so tabbing
   through the nav got the global focus ring and none of the nav's own signal.
   Keyboard gets the same affordance as the mouse now — same state, two ways
   in. Focus is tracked separately from hover so that moving the mouse away
   from a link you tabbed to doesn't wipe the underline out from under you. */
function NavLink({ children, to, href }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const active = hover || focus;
  const Cmp = to ? Link : 'a';
  const props = to ? { to } : { href };

  return (
    <Cmp
      {...props}
      className="relative text-sm font-semibold"
      style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
    >
      {children}
      <motion.span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -4,
          height: 2,
          borderRadius: 2,
          background: 'var(--brand-gold-500)',
          transformOrigin: active ? 'left center' : 'right center',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: active ? 1 : 0 }}
        transition={{ duration: 0.36, ease: EASE }}
      />
    </Cmp>
  );
}

export default function LandingNav() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const [condensed, setCondensed] = useState(false);

  useMotionValueEvent(scrollY, 'change', (v) => {
    const next = v > 40;
    if (next !== condensed) setCondensed(next);
  });

  return (
    <motion.nav
      className="sticky top-0 z-50 w-full"
      animate={{
        backgroundColor: condensed ? 'rgba(250,250,249,0.82)' : 'rgba(250,250,249,0)',
        borderBottomColor: condensed ? 'var(--border-light)' : 'rgba(220,227,234,0)',
        backdropFilter: condensed ? 'blur(12px)' : 'blur(0px)',
      }}
      transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
      style={{ borderBottomWidth: 1, borderBottomStyle: 'solid', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <motion.div
        className="mx-auto flex max-w-7xl items-center justify-between px-6"
        /* Knowing deviation from "animate transform/opacity only": the height
           change IS the condense effect, and faking it with a transform
           distorts the children. Cost is bounded — this is a one-shot 400ms
           transition that fires only when scroll crosses 40px, not a
           per-frame scroll-linked animation. */
        animate={{ paddingTop: condensed ? 10 : 20, paddingBottom: condensed ? 10 : 20 }}
        transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
      >
        <motion.div
          animate={{ scale: condensed ? 0.78 : 1 }}
          transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
          style={{ transformOrigin: 'left center' }}
        >
          <LogoFull height={52} />
        </motion.div>

        <div className="hidden items-center gap-7 sm:flex">
          <NavLink href="#how-it-works">How it works</NavLink>
          <NavLink to="/login">Log in</NavLink>
        </div>

        <Link
          to="/onboarding"
          className="touch-target inline-flex items-center whitespace-nowrap rounded-[var(--r-control)] px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 6px 20px rgb(31 58 95 / 0.25)' }}
        >
          Start your 30-day test
        </Link>
      </motion.div>
    </motion.nav>
  );
}