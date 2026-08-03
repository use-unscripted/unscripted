/* ──────────────────────────────────────────────────────────────────────────
   Landing sections.

   The Mission Guide checklist is the only animation in this file, and that
   is deliberate. Mission Guides are the stated differentiator, so each step's
   ring and tick *draw* in sequence down a growing gold spine — it reads as a
   checklist being worked through rather than nine rows fading in. The
   animation is arguing the product's case.

   Everything else here is just present. Every heading, paragraph, card and
   panel below used to carry its own scroll-triggered fade-up on a staggered
   delay — ten of them in this file alone. "Every section fades in when it
   enters the viewport" is a named generated-page tell, and it cost more than
   taste: with everything moving, the two moments that mean something (this
   checklist, and the process rail in Hero) had nothing to stand out against.
   One orchestrated entrance in the hero on load; after that content is there
   when you arrive at it. Don't re-add fades here.
   ────────────────────────────────────────────────────────────────────────── */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import PathExplorer from '@/components/landing/PathExplorer';
import { EASE } from '@/components/motion';

const missionSteps = [
  'Identify 10 relevant professionals',
  'Research each person',
  'Draft personalized outreach',
  'Send and track messages',
  'Follow up appropriately',
  'Schedule a call',
  'Prepare tailored questions',
  'Record what you learned',
  'Update your path assessment',
];

/* ── Mission Guide checklist ─────────────────────────────────────────────
   Ring draws, then the tick draws inside it, one step after another.
   ──────────────────────────────────────────────────────────────────────── */
const STEP_GAP = 0.11;   // seconds between consecutive steps
const LEAD_IN = 0.18;    // delay before the first ring starts

function ChecklistStep({ text, index }) {
  const at = LEAD_IN + index * STEP_GAP;

  return (
    <motion.div
      className="relative flex items-start gap-3.5"
      initial={{ opacity: 0, x: -6 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ delay: at, duration: 0.45, ease: EASE }}
    >
      <span className="relative z-10 shrink-0" style={{ marginTop: 1 }}>
        {/* Solid backing so the spine doesn't show through the ring */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ background: 'var(--brand-navy-900)' }}
        />
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="relative block">
          <motion.circle
            cx="12" cy="12" r="10"
            stroke="var(--brand-gold-500)" strokeWidth="1.8" strokeOpacity="0.5"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: at, duration: 0.5, ease: 'easeOut' }}
            style={{ rotate: -90, transformOrigin: '12px 12px' }}
          />
          <motion.path
            d="M7.8 12.4 L10.6 15.2 L16.2 9.4"
            stroke="var(--brand-gold-500)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: at + 0.2, duration: 0.32, ease: 'easeOut' }}
          />
        </svg>
      </span>
      <span className="text-sm leading-6 text-[color:var(--ink-300)]">{text}</span>
    </motion.div>
  );
}

function MissionChecklist() {
  const total = missionSteps.length;
  const spineDuration = LEAD_IN + total * STEP_GAP;

  return (
    <div className="relative space-y-2.5">
      {/* Gold spine grows down behind the rings, pacing the sequence */}
      <motion.div
        aria-hidden="true"
        className="absolute w-px"
        style={{
          left: 8,
          top: 10,
          bottom: 10,
          transformOrigin: 'top center',
          background: 'linear-gradient(180deg, rgba(214,182,106,0.55), rgba(214,182,106,0.10))',
        }}
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ delay: LEAD_IN, duration: spineDuration, ease: 'linear' }}
      />
      {missionSteps.map((s, i) => (
        <ChecklistStep key={s} text={s} index={i} />
      ))}
    </div>
  );
}

export default function LandingSections() {
  return (
    <>
      {/* What are you trying to test? */}
      <section
        className="px-6 pt-20 pb-24"
        style={{ background: 'var(--background-secondary)', borderTop: '1px solid var(--border-light)' }}
      >
        <div className="mx-auto max-w-7xl">
          {/* Every section on this page used to open with the same device: a
             tiny bold letterspaced uppercase label, then the heading. Four of
             them in a row stops being an accent and becomes the template.
             The headings carry their own sections now. */}
          <h2 className="font-heading text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Pick something you’re actually weighing up.
          </h2>
          <p className="mt-3 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            The process is the same whichever one you choose: compare the options, run the missions, come back with proof.
          </p>
          <p className="mt-5 text-sm font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
            Choose one to see its first missions and what you’d walk away with.
          </p>

          {/* PathExplorer replaced the static pills in the Base44 builder on
             2026-07-30. It has its own tab/accordion transitions and handles
             reduced motion; it does not also need an entrance. */}
          <div className="mt-8">
            <PathExplorer />
          </div>
        </div>
      </section>

      {/* Problem / Unscripted method */}
      <section className="relative overflow-hidden px-6 py-32" style={{ background: 'var(--brand-navy-900)' }}>
        {/* Faint gold horizon so the dark block isn't flat */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(214,182,106,0.5), transparent)' }}
        />

        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-4xl font-bold leading-tight tracking-tight text-white lg:text-5xl">
              College teaches you subjects. It never teaches you how to test a career before you pick one.
            </h2>
            <p className="mt-6 leading-7 text-[color:var(--ink-300)]">
              Most people choose on prestige, or on what a parent said, or on a guess made at eighteen. The bill for guessing wrong is four years and a lot of money, and it arrives long after the decision.
            </p>
          </div>

          <div
            className="rounded-[var(--r-surface)] p-8"
            style={{ background: 'var(--brand-navy-700)', border: '1px solid rgba(214,182,106,0.25)' }}
          >
            <h3 className="font-heading mb-4 text-2xl font-bold text-white">
              Compare. Test. Execute. Reflect. Adjust.
            </h3>
            <p className="leading-7 text-[color:var(--ink-300)]">
              You compare three paths, run real missions against the one you pick, work them around the schedule you already have, and move your ranking as the evidence comes in.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Guide Preview */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Every mission comes with the actual words.
            </h2>
            <p className="mt-5 leading-7" style={{ color: 'var(--text-secondary)' }}>
              Not a list of things to go do. The email you send, the questions to ask once they’re on the call, the mistakes most people make the first time, and what to write down afterwards.
            </p>
            <Link
              /* ?intent=mission-guide — the register screen headlines
                 itself for whatever sent you there. Without it this CTA
                 lands on "Save Your Path Test", which is a path test the
                 visitor never took. */
              to="/register?intent=mission-guide"
              className="mt-8 inline-flex items-center gap-2 whitespace-nowrap rounded-[var(--r-control)] px-6 py-3.5 text-sm font-semibold text-white"
              style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgb(31 58 95 / 0.25)' }}
            >
              See a full mission guide <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>

          <div
            className="rounded-[var(--r-surface)] p-7"
            style={{ background: 'var(--brand-navy-900)', border: '1px solid rgba(214,182,106,0.30)' }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: 'rgba(214,182,106,0.20)', color: 'var(--brand-gold-500)' }}
              >
                Mission Guide
              </span>
            </div>
            <h3 className="font-heading mb-1 text-lg font-bold text-white">
              Interview someone doing the job you’re considering
            </h3>
            {/* ink-300 on the navy card; ink-400 was 4.48:1 */}
            <p className="mb-6 text-xs text-[color:var(--ink-300)]">
              4-6 hours. You end up with a written summary and an updated ranking.
            </p>
            <MissionChecklist />
          </div>
        </div>
      </section>

      {/* Bottom CTA.

          Was a centred gradient panel with a word-by-word headline reveal and
          a gold sheen sweeping across it — the third centred block on a page
          that was already centred throughout, plus two animations doing the
          job of none. Now it closes the page the way the page opened: left,
          on a flat navy field, with the action sitting beside the statement
          rather than under it. */}
      <section className="overflow-hidden px-6 pb-28">
        <div className="mx-auto max-w-7xl">
          <div
            className="rounded-[var(--r-surface)] px-8 py-20 text-white sm:px-14"
            style={{ background: 'var(--brand-navy-900)' }}
          >
            <div className="grid items-end gap-10 lg:grid-cols-[1.35fr_auto]">
              <h2 className="font-heading max-w-[20ch] text-4xl font-bold leading-[1.08] tracking-[-0.02em] sm:text-5xl">
                You don’t need to choose your entire life today.
              </h2>

              <div className="lg:pb-2">
                <p className="mb-6 max-w-[34ch] leading-7 text-[color:var(--ink-300)]">
                  You need a better way to test what comes next.
                </p>
                <Link
                  to="/onboarding"
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-[var(--r-control)] px-7 py-4 text-sm font-semibold"
                  style={{
                    background: 'var(--brand-white)',
                    color: 'var(--brand-navy-900)',
                    boxShadow: '0 4px 16px rgb(31 58 95 / 0.18)',
                  }}
                >
                  Start your 30-day test <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}