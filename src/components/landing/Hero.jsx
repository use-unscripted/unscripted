/* ──────────────────────────────────────────────────────────────────────────
   Hero + the 4-step process rail.

   Two substantive changes over the original:

   1. The headline reveals word-by-word out of a clip mask instead of fading
      up as one block, with a gold rule drawing under "Test it."

   2. The 4-step process is no longer four cards that fade in on a timer.
      A rail runs across them and *fills as you scroll*, lighting each step's
      node and number as it passes. The product's whole pitch is a sequence
      — compare, test, execute, reflect — so the motion should read as a
      sequence advancing, not four things arriving at once.
   ────────────────────────────────────────────────────────────────────────── */
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion, useScroll, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import UniversityMarquee from '@/components/landing/UniversityMarquee';
import HeroBackdrop from '@/components/landing/HeroBackdrop';
import PathPreview from '@/components/landing/PathPreview';
import { Reveal, WordReveal, UnderlineDraw, Magnetic, Tilt, EASE } from '@/components/motion';

const steps = [
  { n: '01', title: 'Compare realistic paths', body: 'See honest tradeoffs, lifestyle implications, and fit signals for 3 paths matched to your profile.' },
  { n: '02', title: 'Run guided experiments', body: 'Complete structured real-world missions — interviews, simulations, and proof-of-work outputs.' },
  { n: '03', title: 'Execute around your schedule', body: 'Your experiments are scheduled around your actual classes, work, and commitments.' },
  { n: '04', title: 'Reflect and adjust', body: 'Weekly reflections update your path assessment based on what you actually experienced.' },
];

/* Each step owns a quarter of the rail's scroll range. */
const bandFor = (i) => [i * 0.25, i * 0.25 + 0.16];

function RailNode({ index, progress }) {
  const [a, b] = bandFor(index);
  const scale = useTransform(progress, [a, b], [0.55, 1]);
  /* Literal hex, not var(--brand-gold-500) — framer-motion interpolates
     colour values, and it can't parse a CSS custom property. */
  const bg = useTransform(progress, [a, b], ['#DCE3EA', '#D6B66A']);
  const ring = useTransform(progress, [a, b], [0, 1]);
  const ringScale = useTransform(ring, [0, 1], [0.6, 1]);

  return (
    <div className="flex justify-center">
      <div className="relative" style={{ marginTop: -5 }}>
        <motion.span
          style={{
            display: 'block',
            width: 11,
            height: 11,
            borderRadius: 999,
            background: bg,
            scale,
          }}
        />
        <motion.span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: -5,
            borderRadius: 999,
            border: '1px solid var(--brand-gold-500)',
            opacity: ring,
            scale: ringScale,
          }}
        />
      </div>
    </div>
  );
}

function StepCard({ step, index, progress }) {
  const [a, b] = bandFor(index);
  const numberColor = useTransform(progress, [a, b], ['rgba(31,58,95,0.15)', 'rgba(31,58,95,0.85)']);
  const borderColor = useTransform(progress, [a, b], ['#DCE3EA', 'rgba(214,182,106,0.55)']);
  const lift = useTransform(progress, [a, b], [10, 0]);
  /* Floor at 0.78, not 0.45. A step the rail hasn't reached yet should read
     as "not yet", not as disabled — and if someone lands with the section
     already in view, or never scrolls it fully, the copy still has to be
     comfortably legible. The number, border and node carry the state change;
     the body text barely moves. */
  const opacity = useTransform(progress, [a - 0.06, b], [0.78, 1]);

  return (
    <Tilt className="h-full rounded-[18px]">
      <motion.div
        className="h-full rounded-[18px] bg-white p-6"
        style={{ borderWidth: 1, borderStyle: 'solid', borderColor, y: lift, opacity }}
      >
        <motion.span className="font-heading text-3xl font-bold block" style={{ color: numberColor }}>
          {step.n}
        </motion.span>
        <h3 className="font-heading mt-3 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {step.title}
        </h3>
        <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
          {step.body}
        </p>
      </motion.div>
    </Tilt>
  );
}

function ProcessRail() {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  /* Rail fills from when the section is 80% down the viewport until its
     bottom reaches 60% — i.e. across one comfortable scroll gesture. */
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.82', 'end 0.62'],
  });

  /* Spring the raw progress so the fill trails the scroll slightly instead
     of snapping 1:1 with the wheel. */
  const progress = useSpring(scrollYProgress, {
    stiffness: 95,
    damping: 26,
    restDelta: 0.0005,
  });

  /* Reduced motion: everything reads as already complete. */
  const staticOne = useMotionOne();
  const p = reduce ? staticOne : progress;

  return (
    /* scroll-margin-top is load-bearing now: the nav became sticky in this
       pass, so without it the "See How It Works" jump lands this section
       underneath the header. */
    <section
      id="how-it-works"
      ref={ref}
      className="mx-auto max-w-7xl px-6 pt-16 pb-24"
      style={{ scrollMarginTop: 88 }}
    >
      {/* Horizontal rail — wide screens */}
      <div className="relative mb-9 hidden lg:block">
        <div className="h-px w-full" style={{ background: 'var(--border-light)' }} />
        <motion.div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            scaleX: p,
            transformOrigin: 'left center',
            background: 'linear-gradient(90deg, var(--brand-navy-700), var(--brand-gold-500))',
          }}
        />
        <div className="absolute inset-x-0 top-0 grid grid-cols-4">
          {steps.map((s, i) => (
            <RailNode key={s.n} index={i} progress={p} />
          ))}
        </div>
      </div>

      {/* Below lg the cards stack, so the rail rotates to a vertical spine
         rather than disappearing. This is the best moment on the page and
         most of these students are on a phone — it has to survive there. */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute w-px lg:hidden"
          style={{ left: 5, top: 8, bottom: 8, background: 'var(--border-light)' }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute w-px lg:hidden"
          style={{
            left: 5,
            top: 8,
            height: 'calc(100% - 16px)',
            scaleY: p,
            transformOrigin: 'top center',
            background: 'linear-gradient(180deg, var(--brand-navy-700), var(--brand-gold-500))',
          }}
        />

        <div className="grid gap-4 pl-8 lg:grid-cols-4 lg:pl-0">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              <StackNode index={i} progress={p} />
              <StepCard step={s} index={i} progress={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Node sitting on the vertical spine, one per stacked card. */
function StackNode({ index, progress }) {
  const [a, b] = bandFor(index);
  const scale = useTransform(progress, [a, b], [0.55, 1]);
  const bg = useTransform(progress, [a, b], ['#DCE3EA', '#D6B66A']);

  return (
    <motion.span
      aria-hidden="true"
      className="absolute z-10 block rounded-full lg:hidden"
      style={{ left: -32, top: 22, width: 11, height: 11, background: bg, scale }}
    />
  );
}

/* A MotionValue permanently parked at 1, for the reduced-motion branch. */
function useMotionOne() {
  const { scrollYProgress } = useScroll();
  return useTransform(scrollYProgress, () => 1);
}

export default function Hero() {
  return (
    <>
      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-16 lg:pt-24">
        <HeroBackdrop />

        <div className="relative mx-auto max-w-3xl text-center" style={{ zIndex: 1 }}>
          <Reveal delay={0} y={14}>
            <div
              className="mb-6 inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[.12em]"
              style={{
                background: 'var(--background-tertiary)',
                border: '1px solid var(--border-light)',
                color: 'var(--brand-navy-700)',
              }}
            >
              <motion.span
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--brand-gold-500)',
                  display: 'block',
                }}
                animate={{ opacity: [1, 0.35, 1], scale: [1, 0.85, 1] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              Write your own path
            </div>
          </Reveal>

          <h1
            className="font-heading text-[3rem] font-extrabold leading-[1.04] tracking-[-0.02em] sm:text-[4rem]"
            style={{ color: 'var(--text-primary)' }}
          >
            <WordReveal text="Don't guess your next path." delay={0.05} />{' '}
            <span className="relative inline-block">
              <WordReveal text="Test it." delay={0.34} />
              <UnderlineDraw delay={0.72} height={5} />
            </span>
          </h1>

          <Reveal delay={620} y={16}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 font-body" style={{ color: 'var(--text-secondary)' }}>
              Unscripted helps high school and college students compare realistic career and life paths, complete guided real-world experiments, and learn what actually fits — before making a major commitment.
            </p>
          </Reveal>

          <Reveal delay={740} y={16}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Magnetic>
                <Link
                  to="/onboarding"
                  className="group flex items-center gap-2 rounded-[10px] px-7 py-3.5 text-sm font-semibold text-white"
                  style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}
                >
                  Start My 30-Day Path Test
                  <motion.span
                    className="inline-flex"
                    initial={false}
                    whileHover={{ x: 3 }}
                    transition={{ duration: 0.3, ease: EASE }}
                  >
                    <ArrowRight size={17} aria-hidden="true" />
                  </motion.span>
                </Link>
              </Magnetic>

              <Magnetic strength={0.2} max={6}>
                <a
                  href="#how-it-works"
                  className="block rounded-[10px] px-7 py-3.5 text-sm font-semibold"
                  style={{ background: 'white', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                >
                  See How It Works
                </a>
              </Magnetic>
            </div>
            <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Already have an account?{' '}
              <Link to="/login" className="font-semibold underline" style={{ color: 'var(--brand-navy-700)' }}>
                Log in
              </Link>
            </p>
          </Reveal>
        </div>

        {/* The product artifact — sits outside the max-w-3xl copy column so
           the three cards get room to breathe. */}
        <div className="relative" style={{ zIndex: 1 }}>
          <PathPreview />
        </div>
      </section>

      <UniversityMarquee />

      <ProcessRail />
    </>
  );
}