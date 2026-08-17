/* ──────────────────────────────────────────────────────────────────────────
   Landing sections.

   One animation in this file, and it is one word wide. In the before-and-after
   pair, the tested path's evidence stage reads "Not tested", holds, and is
   replaced by "Early signal". That is what one finished simulation does to
   that row, so the movement is the argument rather than decoration around it.

   What it replaced was a nine-step Mission Guide checklist that drew itself
   down a gold spine, arguing the case for guides. Guides were replaced by
   in-app work simulations on 2026-08-14, so the section went with them and
   the one animation moved to what the product does now.

   Everything else here is just present. Every heading, paragraph, card and
   panel below used to carry its own scroll-triggered fade-up on a staggered
   delay, ten of them in this file alone. "Every section fades in when it
   enters the viewport" is a named generated-page tell, and it cost more than
   taste: with everything moving, the two moments that mean something (this
   before-and-after, and the process rail in Hero) had nothing to stand out
   against. One orchestrated entrance in the hero on load; after that content
   is there when you arrive at it. Don't re-add fades here.
   ────────────────────────────────────────────────────────────────────────── */
import { Link } from 'react-router-dom';
import { ArrowRight, Minus } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import PathExplorer from '@/components/landing/PathExplorer';
import { EASE } from '@/components/motion';

/* The five steps of the work simulation that is actually in the product, in
   its own order and its own numbers. Source of truth is
   src/lib/work-sims/northgate-pm.js: the counts below (six things overnight,
   seven requests, nineteen points against six of capacity, five spec headings,
   an eighty word reply) all come from there. If a second simulation ever
   becomes the one shown here, both files change. */
const SIM_STEPS = [
  ['The read-in', 'Six things landed overnight. Nothing to answer yet.'],
  ['Cut the list', 'Seven things people want, nineteen points of work, six points of capacity.'],
  ['Write the spec', 'Five headings, 150 to 250 words. Nobody tells you whether it is right.'],
  ['The revision', 'The estimate was wrong, so the plan no longer fits. Your first version stays on screen while you redo it.'],
  ['The reply', 'Eighty words to the salesperson who already told the customer it was coming.'],
];

/* ── The example matrix ──────────────────────────────────────────────────
   Two cards, the same three paths, one word different between them. That word
   is the whole claim of this block, so here is the chain it rests on. It was
   traced through the source on 2026-08-17; re-trace it before changing any
   string below.

   Finishing the work simulation writes one completed Experiments row, one
   ExperimentMeasurement carrying a post_completed_at, and one ProofOfWork row
   for the spec (work-sim.js, completeRun). For that path the matrix then
   counts one measured experiment and one evidence item. One item is under
   THRESHOLDS.developing_evidence_items, so maturityFor lands on early_signal
   and the row reads "Early signal". The other two paths have no records at
   all, so they stay "Not tested". See MATURITY in decision-matrix.js.

   Nothing in that flow writes a HypothesisUpdate row. Only the reflection
   decision screen does, via recordHypothesisUpdate. So the trend has fewer
   than two points and every row here reads "Not enough history", which is why
   no row carries a direction word.

   That absence is load bearing. "Early signal" beside "Strengthening" is a
   screen the product cannot draw: a direction word needs a reflection, and
   the same reflection saves a WeeklyReflections row against the experiment,
   which is the second evidence item, which moves the path to "Developing
   evidence" in the same action. An earlier version of this block pictured
   that pairing on all three rows, and a buyer could have falsified it.

   One string does not come from decision-matrix.js: trendFrom returns the
   label "Not enough history yet", and TrendBadge.jsx never reads it, printing
   "Not enough history" instead. What a student sees is the badge, so the
   badge is what is copied here. Don't "fix" it to match the library.

   What is drawn here is the row header and the trend, which is the part of
   that screen with no numbers in it. The real table also carries five metric
   columns, and after one measured experiment some of those do print a figure
   (Experienced Fit, for one). They are left off rather than invented: a
   percentage on a landing page is a percentage somebody will read as a real
   student's, and we sell to career services. Showing a subset is fine.
   Showing a made-up number is not.

   The stage word appears twice on the real screen, under the path name and
   again in the confidence cell whenever there is no percentage to put there
   (MetricValue). Both say the same string, so drawing it once is not a
   misrepresentation of either.

   The three career names are invented and the block says so.
   ──────────────────────────────────────────────────────────────────────── */

/* Exported so LandingSections.test.jsx can pin them to the strings they claim
   to copy. Rename a maturity label or the badge's wording and that test fails
   here rather than the page lying quietly. */
export const STAGE_UNTESTED = 'Not tested';
export const STAGE_TESTED = 'Early signal';
export const TREND_NONE = 'Not enough history';

/* `tested` is the path the simulation ran against. Exactly one, because
   exactly one simulation exists. */
const MATRIX_ROWS = [
  { path: 'Product management', tested: true },
  { path: 'UX research', tested: false },
  { path: 'Data analysis', tested: false },
];

/* Long enough that the word it started on registers, short enough that the
   card is not still contradicting the paragraph under it while that paragraph
   is being read. At 0.75 the row read "Not tested" for the first second while
   the caption said the path reads "Early signal" now. */
const HOLD = 0.3;    // seconds "Not tested" holds before the test lands
const SWAP = 0.35;   // how long the word takes to change

function ExampleChip({ onNavy = false }) {
  return (
    <span
      className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
      style={onNavy
        /* Solid gold with navy on it, 5.88:1 measured in the browser. The
           tinted fill this replaced measured 4.06:1, and a disclaimer that
           fails AA is the one label on the card that has to be readable. */
        ? { background: 'var(--brand-gold-500)', color: 'var(--brand-navy-900)' }
        : { background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}
    >
      Example
    </span>
  );
}

/* The one animation. The word the tested path started on leaves, and the word
   one simulation earns it takes its place. Reduced motion gets the end state
   with no interval, and the leaving word is hidden from assistive tech so the
   row only ever announces where it ended up. */
function MovedStage() {
  const reduce = useReducedMotion();
  if (reduce) return STAGE_TESTED;

  return (
    <span className="relative inline-block whitespace-nowrap">
      <motion.span
        aria-hidden="true"
        className="absolute inset-0"
        initial={{ opacity: 1 }}
        whileInView={{ opacity: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ delay: HOLD, duration: SWAP, ease: EASE }}
      >
        {STAGE_UNTESTED}
      </motion.span>
      <motion.span
        className="inline-block"
        initial={{ opacity: 0, y: 3 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ delay: HOLD + 0.12, duration: SWAP, ease: EASE }}
      >
        {STAGE_TESTED}
      </motion.span>
    </span>
  );
}

/* One row as the matrix draws its header: the path name with the evidence
   stage under it, and the trend on the right. With no direction the trend is
   plain muted text and no pill, which is exactly what TrendBadge falls back
   to. */
function MatrixRow({ name, stage }) {
  return (
    <li className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{stage}</p>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-1.5 text-[11px]"
        style={{ color: 'var(--text-muted)' }}
      >
        <Minus size={13} aria-hidden="true" />
        {TREND_NONE}
      </span>
    </li>
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
            Careers worth testing, not careers you’re told to pick.
          </h2>
          <p className="mt-3 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            Your interests are a starting point. Your experiences become the evidence, and the loop is the same whichever career you start with.
          </p>
          <p className="mt-5 text-sm font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
            Choose one to see its first experiments and what you’d walk away with.
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
              Career quizzes tell you what might fit. Unscripted helps you test whether it actually does.
            </h2>
            <p className="mt-6 leading-7 text-[color:var(--ink-300)]">
              Most people choose on prestige, or on what a parent said, or on a guess made at eighteen. The bill for guessing wrong arrives long after the decision, and no questionnaire can settle it.
            </p>
            <p className="mt-5 leading-7 text-[color:var(--ink-300)]">
              Not knowing yet is useful. It tells us what to test next.
            </p>
          </div>

          <div
            className="rounded-[var(--r-surface)] p-8"
            style={{ background: 'var(--brand-navy-700)', border: '1px solid rgba(214,182,106,0.25)' }}
          >
            <h3 className="font-heading mb-4 text-2xl font-bold text-white">
              Being good at the work and enjoying the work are not the same thing.
            </h3>
            <p className="leading-7 text-[color:var(--ink-300)]">
              Unscripted looks beyond whether you can do the work. It helps you learn whether you actually want to keep doing it, and it becomes more confident about what fits you as you test more kinds of work.
            </p>
          </div>
        </div>
      </section>

      {/* The work simulation, and what testing moves */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Do thirty minutes of the job before you commit to it.
            </h2>
            <p className="mt-5 leading-7" style={{ color: 'var(--text-secondary)' }}>
              A work simulation puts you inside one morning of a real job at a company that does not exist. There is more work than the team can take on, and a salesperson who has already told a customer it’s coming. You decide what gets built and write the spec for it. Then an estimate turns out to be wrong, and you make the call again. After that you answer the people you said no to.
            </p>
            <p className="mt-5 leading-7" style={{ color: 'var(--text-secondary)' }}>
              You say up front how much you expect to enjoy it and how well you expect to do. At the end you get a read-out: what you predicted, what happened instead, and what the checks found in the work you handed in. It won’t tell you whether you’d be good at the job, or whether you should do it. It tells you how you reacted to the work.
            </p>
            <Link
              /* ?intent=work-simulation. The register screen headlines itself
                 for whatever sent you there. Without it this CTA lands on
                 "Save Your Path Test", which is a path test the visitor never
                 took. The old ?intent=mission-guide still resolves, to the same
                 screen this one gets. */
              to="/register?intent=work-simulation"
              className="mt-8 inline-flex items-center gap-2 whitespace-nowrap rounded-[var(--r-control)] px-6 py-3.5 text-sm font-semibold text-white"
              style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgb(31 58 95 / 0.25)' }}
            >
              Try a work simulation <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>

          <div
            className="rounded-[var(--r-surface)] p-7"
            style={{ background: 'var(--brand-navy-900)', border: '1px solid rgba(214,182,106,0.30)' }}
          >
            <div className="mb-2 flex items-center gap-2">
              <ExampleChip onNavy />
            </div>
            <h3 className="font-heading mb-1 text-lg font-bold text-white">
              Thirty minutes as a product manager
            </h3>
            {/* ink-300 on the navy card; ink-400 was 4.48:1 */}
            <p className="mb-6 text-xs leading-5 text-[color:var(--ink-300)]">
              Northgate is not a real company. It sells scheduling software to plumbers and electricians, and you run the Jobs area. It’s Tuesday, 9:12 in the morning, and six things arrived overnight.
            </p>

            {/* role="list" is not redundant. The list style is none here, and
                WebKit drops list semantics from a styled-off list unless the
                role is stated, which would take the ordinal away from a
                screen reader on the one list whose order is the point. */}
            <ol role="list" className="space-y-3.5">
              {SIM_STEPS.map(([title, detail], i) => (
                <li key={title} className="flex items-start gap-3.5">
                  {/* The list announces the ordinal, so the drawn number is
                      decoration and saying it twice is noise. Solid gold with
                      navy on it, the pairing .journey-now-cta already uses,
                      5.88:1 measured in the browser. The tinted fill this
                      replaced put gold text on a gold wash over navy and
                      measured 4.24:1, and at 11px bold nothing below 4.5
                      counts as large text. */}
                  <span
                    aria-hidden="true"
                    className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                    style={{ background: 'var(--brand-gold-500)', color: 'var(--brand-navy-900)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm leading-6 text-[color:var(--ink-300)]">
                    <span className="font-semibold text-white">{title}. </span>{detail}
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-6 text-xs text-[color:var(--ink-300)]">
              Five steps. Nothing is timed on screen.
            </p>
          </div>
        </div>

        {/* What testing moves. Same three paths, twice, one word apart.
            The "Example" chip sits in each card header rather than beside the
            heading: on desktop the old one landed behind the sticky header at
            the scroll position where the rows read, so the disclosure was
            weakest exactly where the reader takes the rows in. */}
        <div className="mt-20">
          <h3 className="font-heading text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Every test you finish lands on the same screen.
          </h3>
          <p className="mt-3 max-w-2xl leading-7" style={{ color: 'var(--text-secondary)' }}>
            The paths you’re weighing, side by side, with what your own evidence says about each one so far.
          </p>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <div
              className="rounded-[var(--r-surface)] p-6 sm:p-7"
              style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-heading text-sm font-bold" style={{ color: 'var(--brand-navy-700)' }}>
                  Before you test anything
                </h4>
                <ExampleChip />
              </div>
              <ul role="list" className="mt-5 divide-y" style={{ borderColor: 'var(--border-light)' }}>
                {MATRIX_ROWS.map(row => (
                  <MatrixRow key={row.path} name={row.path} stage={STAGE_UNTESTED} />
                ))}
              </ul>
            </div>

            <div
              className="rounded-[var(--r-surface)] bg-white p-6 sm:p-7"
              style={{ border: '1px solid var(--border-light)', boxShadow: '0 18px 44px rgba(16,24,40,0.07)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-heading text-sm font-bold" style={{ color: 'var(--brand-navy-700)' }}>
                  After one simulation
                </h4>
                <ExampleChip />
              </div>
              <ul role="list" className="mt-5 divide-y" style={{ borderColor: 'var(--border-light)' }}>
                {MATRIX_ROWS.map(row => (
                  <MatrixRow
                    key={row.path}
                    name={row.path}
                    stage={row.tested ? <MovedStage /> : STAGE_UNTESTED}
                  />
                ))}
              </ul>
            </div>
          </div>

          {/* Below the cards, so it reads as the conclusion rather than a
              caption. It also carries the point in words, which is the only
              form of it that survives the phone, where the two cards stack
              and cannot be seen together. */}
          <p className="mt-6 max-w-3xl leading-7" style={{ color: 'var(--text-secondary)' }}>
            One finished simulation moves one row. That path reads “Early signal” now, on one piece of evidence. The other two still say “Not tested”, and nothing here rules them out.
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
            An example, not a real student. We made up the three career names. “Not tested”, “Early signal” and “Not enough history” are the screen’s own words.
          </p>
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
                  You need a way to test what comes next, and evidence to decide on when you do.
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
                  Start exploring <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}