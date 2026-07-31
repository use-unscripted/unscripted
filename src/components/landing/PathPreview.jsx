/* ──────────────────────────────────────────────────────────────────────────
   PathPreview — the hero's product artifact.

   The single biggest weakness of the page was that the hero had nothing to
   look at: centred text on an empty background. No easing curve fixes an
   empty stage. This puts the thing the product actually hands you — three
   ranked paths with honest tradeoffs — directly under the headline.

   Grounded in the real data model, not invented:
     LABELS            src/pages/PathResults.jsx:7
     path_name         PathRecommendations
     readiness_score   rendered by ReadinessBar in PathResults
     main_tradeoffs    PathRecommendations

   The three paths below are illustrative sample output and are labelled as
   such on the page. They are not claims about real students.
   ────────────────────────────────────────────────────────────────────────── */
import { motion, useReducedMotion } from 'framer-motion';
import { CountUp, EASE } from '@/components/motion';

/* These are three paths for ONE student, not three unrelated jobs — that's
   how the generator works, and it's what makes the tradeoffs comparable.
   Deliberately not all tech: the audience is Northeast campuses, and the
   page's own list already spans grad school, mission-driven work and
   personal brand. */
const PATHS = [
  {
    label: 'Best apparent fit',
    tier: 'best',
    path_name: 'Brand marketing at a mid-size consumer company',
    readiness_score: 74,
    main_tradeoffs: 'Real training and a clear ladder. You are three layers from any decision that matters.',
  },
  {
    label: 'Strong alternative',
    tier: 'alt',
    path_name: 'Communications for a regional hospital system',
    readiness_score: 69,
    main_tradeoffs: 'Less prestige with your peers, far more ownership in year one.',
  },
  {
    label: 'Contrarian option',
    tier: 'contrarian',
    path_name: 'Freelance content for two startups before you graduate',
    readiness_score: 43,
    main_tradeoffs: 'No title and no safety net. You would know inside 90 days whether you can sell.',
  },
];

const TONE = {
  best: { chipBg: 'rgba(214,182,106,0.18)', chipFg: 'var(--brand-gold-700)', bar: '#D6B66A', border: 'rgba(214,182,106,0.55)' },
  alt: { chipBg: 'rgba(39,76,119,0.10)', chipFg: '#274C77', bar: '#274C77', border: 'var(--border-light)' },
  contrarian: { chipBg: 'rgba(30,41,59,0.07)', chipFg: '#526274', bar: '#94A3B8', border: 'var(--border-light)' },
};

function ReadinessBar({ score, tone, delay }) {
  const reduce = useReducedMotion();
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        {/* --text-secondary, not --text-muted: muted is 4.02:1 on white and
           fails the 4.5:1 minimum. At 10px it fails by eye too. */}
        <span className="text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--text-secondary)' }}>
          Readiness
        </span>
        {/* tabular-nums matters twice here: the scores sit in a comparison
           column across three cards, and CountUp animates through every
           digit on the way up — proportional figures make them jitter. */}
        <span
          className="font-heading text-sm font-bold"
          style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
        >
          <CountUp to={score} duration={0.85} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>/100</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--background-tertiary)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: tone.bar, transformOrigin: 'left center' }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: score / 100 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: reduce ? 0 : 0.8, ease: EASE, delay: reduce ? 0 : delay }}
        />
      </div>
    </div>
  );
}

function PathCard({ path, index }) {
  const tone = TONE[path.tier];
  const isBest = path.tier === 'best';
  /* Tight stagger. These three are meant to be read together as one set —
     a long gap between them makes it feel like three separate arrivals
     rather than a result appearing. */
  const delay = 0.84 + index * 0.07;

  /* Entrance and hover live on two separate elements on purpose. On one
     element they share a `y`, and a gesture that ends falls back to the
     entrance transition — stagger delay included. That made a card hang at
     its hover height for the full delay (0.84–0.98s) after the cursor left,
     so the middle card — the one you cross every time you move between the
     other two — was almost always still lifted when you got to it and never
     appeared to move at all. Outer element owns the arrival, inner owns the
     hover, and neither can borrow the other's timing. */
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 42, rotateX: 11 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      <motion.div
        className="relative flex h-full flex-col rounded-[18px] bg-white p-5 text-left"
        style={{
          border: `1px solid ${tone.border}`,
          boxShadow: isBest
            ? '0 18px 44px rgba(31,58,95,0.13), 0 2px 8px rgba(31,58,95,0.05)'
            : '0 10px 30px rgba(31,58,95,0.07)',
        }}
        whileHover={{ y: -5 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        {/* Slow ambient glow, best-fit card only — one quiet point of life */}
        {isBest && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[18px]"
            style={{ boxShadow: '0 0 0 1px rgba(214,182,106,0.55)' }}
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <span
          className="mb-3 w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em]"
          style={{ background: tone.chipBg, color: tone.chipFg }}
        >
          {path.label}
        </span>

        {/* Fixed two-line box. Without it a one-line path name pulls its
           readiness bar up out of line with its neighbours — and a comparison
           view whose rows don't align stops reading as a comparison. */}
        <h3
          className="font-heading text-[15px] font-bold leading-6 md:min-h-[3rem]"
          style={{ color: 'var(--text-primary)' }}
        >
          {path.path_name}
        </h3>

        <ReadinessBar score={path.readiness_score} tone={tone} delay={delay + 0.16} />

        <p className="mt-4 text-[13px] leading-5" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Tradeoff · </span>
          {path.main_tradeoffs}
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function PathPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      <motion.p
        className="mb-4 text-center text-[10px] font-bold uppercase tracking-[.18em]"
        style={{ color: 'var(--text-secondary)' }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.72 }}
      >
        Sample output · three paths
      </motion.p>

      {/* Shared perspective so the three cards settle as one plane */}
      <div className="grid gap-4 md:grid-cols-3" style={{ perspective: 1400 }}>
        {PATHS.map((p, i) => (
          <PathCard key={p.path_name} path={p} index={i} />
        ))}
      </div>
    </div>
  );
}