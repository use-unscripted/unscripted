/* ──────────────────────────────────────────────────────────────────────────
   Landing sections.

   The three "after" readings in the work simulation section are the only
   animation in this file, and that is deliberate. They arrive one at a time
   beside a "before" column that is already sitting there, so the movement is
   the argument: the same three paths, and testing is what pulls them apart.
   The animation is arguing the product's case.

   What it replaced was a nine-step Mission Guide checklist that drew itself
   down a gold spine, arguing the case for guides. Guides were replaced by
   in-app work simulations on 2026-08-14, so the section went with them and
   the one animation moved to what the product does now.

   Everything else here is just present. Every heading, paragraph, card and
   panel below used to carry its own scroll-triggered fade-up on a staggered
   delay — ten of them in this file alone. "Every section fades in when it
   enters the viewport" is a named generated-page tell, and it cost more than
   taste: with everything moving, the two moments that mean something (this
   before-and-after, and the process rail in Hero) had nothing to stand out
   against. One orchestrated entrance in the hero on load; after that content
   is there when you arrive at it. Don't re-add fades here.
   ────────────────────────────────────────────────────────────────────────── */
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
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
   Every label here is a string the Career Decision Matrix itself shows: the
   evidence stage where a percentage would otherwise sit ("Not tested",
   "Early signal") and the trend word beside it ("Strengthening", "Stable or
   mixed", "Weakening", "Not enough history yet"). See decision-matrix.js.

   No numbers, on purpose. A percentage on a landing page is a percentage
   somebody will read as a real student's, and we sell to career services.
   The paths and the sentences are invented and the block says so twice.
   ──────────────────────────────────────────────────────────────────────── */
const MATRIX_ROWS = [
  {
    path: 'Product management',
    stage: 'Early signal',
    dir: 'up',
    trend: 'Strengthening',
    line: 'You expected the admin part to bore you. It did, and you still wanted another one.',
  },
  {
    path: 'UX research',
    stage: 'Early signal',
    dir: 'flat',
    trend: 'Stable or mixed',
    line: 'You enjoyed the work and finished it flat. Two readings pointing opposite ways.',
  },
  {
    path: 'Data analysis',
    stage: 'Early signal',
    dir: 'down',
    trend: 'Weakening',
    line: 'You expected to like this one most of the three. You liked it least.',
  },
];

/* Arrow, word and fill, matching the matrix's own TrendBadge so the two
   screens read the same. Colour is never the only signal. */
const TREND_STYLE = {
  up: { Icon: ArrowUpRight, color: 'var(--success-700)', bg: 'var(--success-50)' },
  flat: { Icon: ArrowRight, color: 'var(--ink-600)', bg: 'var(--ink-100)' },
  down: { Icon: ArrowDownRight, color: 'var(--warning-700)', bg: 'var(--warning-50)' },
};

const STEP_GAP = 0.14;   // seconds between consecutive rows
const LEAD_IN = 0.15;    // delay before the first row arrives

function ExampleChip({ onNavy = false }) {
  return (
    <span
      className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
      style={onNavy
        ? { background: 'rgba(214,182,106,0.20)', color: 'var(--brand-gold-500)' }
        : { background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}
    >
      Example
    </span>
  );
}

function TrendChip({ dir, label }) {
  const { Icon, color, bg } = TREND_STYLE[dir];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ color, background: bg }}
    >
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  );
}

/* Path name over its evidence stage, which is how the matrix draws a row when
   it has no percentage to show. */
function RowHead({ name, stage, children }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{stage}</p>
      </div>
      {children}
    </div>
  );
}

function AfterRow({ row, index }) {
  const reduce = useReducedMotion();
  const body = (
    <>
      <RowHead name={row.path} stage={row.stage}>
        <TrendChip dir={row.dir} label={row.trend} />
      </RowHead>
      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{row.line}</p>
    </>
  );
  const className = 'py-4 first:pt-0 last:pb-0';

  if (reduce) return <div className={className}>{body}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: -6 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ delay: LEAD_IN + index * STEP_GAP, duration: 0.45, ease: EASE }}
    >
      {body}
    </motion.div>
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
              A work simulation puts you inside one morning of a real job at a company that does not exist. More work than the team can take on, a salesperson who has already told a customer it’s coming, and an estimate that turns out to be wrong after you’ve planned around it. You decide what gets built, write the spec, and answer the people you said no to.
            </p>
            <p className="mt-5 leading-7" style={{ color: 'var(--text-secondary)' }}>
              You say up front how much you expect to enjoy it and how well you expect to do. At the end you get a read-out: what you predicted, what happened instead, and what the checks found in the work you handed in. It won’t tell you whether you’d be good at the job, or whether you should do it. It tells you how you reacted to the work.
            </p>
            <Link
              /* ?intent=work-simulation — the register screen headlines itself
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

            <ol className="space-y-3.5">
              {SIM_STEPS.map(([title, detail], i) => (
                <li key={title} className="flex items-start gap-3.5">
                  <span
                    className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                    style={{ background: 'rgba(214,182,106,0.18)', color: 'var(--brand-gold-500)' }}
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

        {/* What testing moves. Same three paths, twice. */}
        <div className="mt-20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-heading text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Every test you finish lands on the same screen.
              </h3>
              <p className="mt-3 max-w-2xl leading-7" style={{ color: 'var(--text-secondary)' }}>
                The paths you’re weighing, side by side, with what your own evidence says about each one so far. Testing rarely moves them all the same way.
              </p>
            </div>
            <ExampleChip />
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <div
              className="rounded-[var(--r-surface)] p-6 sm:p-7"
              style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
            >
              <p className="font-heading text-sm font-bold" style={{ color: 'var(--brand-navy-700)' }}>
                Before you test anything
              </p>
              <div className="mt-5 divide-y" style={{ borderColor: 'var(--border-light)' }}>
                {MATRIX_ROWS.map(row => (
                  <div key={row.path} className="py-4 first:pt-0 last:pb-0">
                    <RowHead name={row.path} stage="Not tested">
                      <span
                        className="inline-flex shrink-0 items-center gap-1.5 text-[11px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Minus size={13} aria-hidden="true" />
                        Not enough history yet
                      </span>
                    </RowHead>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-[var(--r-surface)] bg-white p-6 sm:p-7"
              style={{ border: '1px solid var(--border-light)', boxShadow: '0 18px 44px rgba(16,24,40,0.07)' }}
            >
              <p className="font-heading text-sm font-bold" style={{ color: 'var(--brand-navy-700)' }}>
                After you test them
              </p>
              <div className="mt-5 divide-y" style={{ borderColor: 'var(--border-light)' }}>
                {MATRIX_ROWS.map((row, i) => (
                  <AfterRow key={row.path} row={row} index={i} />
                ))}
              </div>
            </div>
          </div>

          <p className="mt-5 max-w-3xl leading-7" style={{ color: 'var(--text-secondary)' }}>
            Nothing here rules a path out. It’s what you know so far, and it changes as you test more.
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
            An example, not a real student. The paths and the readings are made up. The wording beside them is what this screen uses.
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