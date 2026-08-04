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
import { Reveal, WordReveal, UnderlineDraw, EASE, EASE_COPY } from '@/components/motion';

/* Numbering earns its place here: the rail below fills in order and the four
   steps are a real sequence, so 01–04 is carrying information rather than
   decorating. Don't copy the treatment to a section that's just a list.

   Copy rule for this block: name the thing the student physically does. The
   earlier draft ran on abstractions — "structured real-world missions",
   "fit signals", "lifestyle implications" — which is how the page ended up
   reading as machine-written. */
const steps = [
  { n: '01', title: 'Compare three paths', body: "Three careers that match your answers, each with what it costs you and what it gets you." },
  { n: '02', title: 'Run the missions', body: 'Email someone who does the job. Get them on a call. Come back with notes.' },
  { n: '03', title: 'Fit it around class', body: 'Missions get scheduled around your classes, your job and your shifts.' },
  { n: '04', title: 'Decide on evidence', body: "Each week you write down what happened, and your ranking moves on that instead of a quiz." },
];

/* Each step owns a quarter of the rail's scroll range. */
const bandFor = (i) => [i * 0.25, i * 0.25 + 0.16];

function RailNode({ index, progress }) {
  const [a, b] = bandFor(index);
  const scale = useTransform(progress, [a, b], [0.55, 1]);
  /* Literal hex, not var(--brand-gold-500) — framer-motion interpolates
     colour values, and it can't parse a CSS custom property. */
  const bg = useTransform(progress, [a, b], ['var(--ink-200)', 'var(--brand-gold-500)']);
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

/* Steps are unboxed on purpose. Four equal-width, equal-height bordered cards
   in a row is the feature-grid shape every generated landing page ships; the
   borders were also doing nothing the rail doesn't already do. Without the
   boxes the copy lengths differ naturally, the numbers can carry real display
   weight, and the row reads as a sequence rather than a set of tiles.

   Steps 2 and 4 used to sit lower, on the argument that the offset stopped
   the row scanning as a flat grid. Drew called it 2026-08-03: the stagger
   read as misalignment, not rhythm. Tops are level now — the row is kept off
   feature-grid shape by being unboxed and by the rail beneath it, which is
   what was doing that work anyway. */
const STEP_OFFSET = ['', '', '', ''];

function StepCard({ step, index, progress }) {
  const [a, b] = bandFor(index);
  const numberColor = useTransform(progress, [a, b], ['rgba(31,58,95,0.18)', 'rgba(31,58,95,0.9)']);
  const lift = useTransform(progress, [a, b], [10, 0]);
  /* Floor at 0.78, not 0.45. A step the rail hasn't reached yet should read
     as "not yet", not as disabled — and if someone lands with the section
     already in view, or never scrolls it fully, the copy still has to be
     comfortably legible. The number and node carry the state change; the body
     text barely moves. */
  const opacity = useTransform(progress, [a - 0.06, b], [0.78, 1]);

  return (
    <motion.div
      className={`h-full pr-4 ${STEP_OFFSET[index] || ''}`}
      style={{ y: lift, opacity }}
    >
      <motion.span
        className="font-heading block text-4xl font-bold tabular-nums"
        style={{ color: numberColor, letterSpacing: '-0.02em' }}
      >
        {step.n}
      </motion.span>
      <h3 className="font-heading mt-3 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
        {step.title}
      </h3>
      <p className="mt-2 max-w-[34ch] text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        {step.body}
      </p>
    </motion.div>
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
      /* Deliberately the most generous block on the page — this is where the
         product is actually explained, and section padding that's identical
         top to bottom is what makes a page read as templated. */
      className="mx-auto max-w-7xl px-6 pt-24 pb-32"
      style={{ scrollMarginTop: 88 }}
    >
      {/* This section is the target of the nav's "How it works" link and it
         had no heading at all — which is why the audit read the four step
         cards as h3s hanging directly off the hero h1. Same words as the nav
         link on purpose: a destination should be called what the thing that
         sent you here called it. */}
      <h2
        className="font-heading mb-8 text-3xl font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        How it works
      </h2>

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
  const bg = useTransform(progress, [a, b], ['var(--ink-200)', 'var(--brand-gold-500)']);

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
      <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-14 lg:pt-20">
        <HeroBackdrop />

        {/* Left-biased, not centred. Centred headline over centred body over a
            centred button pair, section after section, is the single most
            recognisable generated-page shape — and it was what this page did
            top to bottom. The copy column is capped for measure but sits at
            the container's left edge, so the fold has a direction. */}
        <div className="relative max-w-[54rem]" style={{ zIndex: 1 }}>
          {/* The pill that used to sit here — tiny letterspaced caps, gold dot
             pulsing on a 2.6s loop, reading "Write your own path" — said
             nothing the headline doesn't say two lines later, and that exact
             component is the single most recognisable tell of a generated
             landing page. Removed rather than restyled. The headline is the
             first thing on the page now. */}
          <h1
            className="font-heading font-bold leading-[1.02] tracking-[-0.025em]"
            /* Sized down from 3/4rem: Cabinet Grotesk has a far larger x-height
               than the Josefin Sans this was tuned against, so it renders
               visibly bigger at the same font-size. */
            style={{ color: 'var(--text-primary)', fontSize: 'clamp(2.5rem, 5vw + 0.5rem, 3.75rem)' }}
          >
            <WordReveal text="Don’t guess your next path." delay={0.05} duration={0.85} />{' '}
            <span className="relative inline-block">
              {/* 0.325, not 0.34. The headline is one seven-word sentence
                  that happens to be split across two WordReveals so the
                  second half can carry an underline. The word cadence has to
                  run straight through the seam: 0.05 + (5 x 0.055) = 0.325 is
                  exactly where the sixth word falls. */}
              <WordReveal text="Test it." delay={0.325} duration={0.85} />
              {/* Was 0.72, which put the rule mid-wipe underneath a word that
                  was itself still rising, at the same time as the paragraph
                  and buttons were arriving. Now it starts as “it.” lands and
                  finishes before anything below it moves, so it reads as the
                  headline's full stop rather than one more thing happening at
                  once. */}
              <UnderlineDraw delay={0.58} duration={0.62} height={5} />
            </span>
          </h1>

          {/* Timing below the headline.

              The old numbers had the paragraph at 620ms and both CTAs at
              740ms, while the last headline word was still settling and the
              gold rule was still drawing. Measured on the page: four separate
              gestures in flight at t=775ms, in two different motion languages
              (mask rise vs. fade). Worse, the paragraph finished arriving
              *before* the headline's underline did, so the fold resolved out
              of reading order.

              Now it's four beats: headline, rule, paragraph, actions. Each
              starts as the one before it lands, so neighbours dovetail
              instead of stacking. Busiest moment is three, and those three
              are the copy beats cascading in one shared language, which reads
              as a stagger rather than a pile-up.

              EASE_COPY on everything that fades. Details on the curve are in
              motion.jsx; short version, the brand expo curve snaps a fade to
              nearly-there in 200ms and then hangs, which is exactly the
              “pops in, then does nothing” feeling. */}
          <Reveal delay={700} y={14} duration={0.72} ease={EASE_COPY}>
            <p className="mt-6 max-w-[52ch] text-lg leading-8 font-body" style={{ color: 'var(--text-secondary)' }}>
              Pick a career you’re weighing up. You get 30 days of real assignments: who to email, what to say, what to bring back. By the end you’ll know whether it fits, because you’ll have tried it.
            </p>
          </Reveal>

          <Reveal delay={820} y={14} duration={0.72} ease={EASE_COPY}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/onboarding"
                className="group flex items-center gap-2 whitespace-nowrap rounded-[var(--r-control)] px-7 py-3.5 text-sm font-semibold text-white"
                style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgb(31 58 95 / 0.25)' }}
              >
                Start your 30-day test
                <motion.span
                  className="inline-flex"
                  initial={false}
                  whileHover={{ x: 3 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <ArrowRight size={17} aria-hidden="true" />
                </motion.span>
              </Link>

              <a
                href="#how-it-works"
                className="block whitespace-nowrap rounded-[var(--r-control)] px-7 py-3.5 text-sm font-semibold"
                style={{
                  background: 'var(--background-primary)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                }}
              >
                See how it works
              </a>
            </div>
          </Reveal>

          {/* Split out of the button block. It used to share one Reveal with
              the two CTAs, so the buttons and the log-in line landed as a
              single slab. It's the quietest text in the fold and it can come
              in behind them. */}
          <Reveal delay={920} y={10} duration={0.62} ease={EASE_COPY}>
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