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

   ⚠️ This component is deliberately static — no entrance, no hover lift, no
   count-up, no ambient glow. It is standing in for a screenshot of the real
   product, and product screenshots don't animate. The page already carries
   motion in the headline, the process rail and the Mission Guide checklist;
   adding a fourth animated moment here made the set read as decorated rather
   than designed. Don't re-add motion to these cards.
   ────────────────────────────────────────────────────────────────────────── */

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

function ReadinessBar({ score, tone }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        {/* --text-secondary, not --text-muted: muted is 4.02:1 on white and
           fails the 4.5:1 minimum. At 10px it fails by eye too.

           This label stays uppercase where the page's section eyebrows did
           not. Inside a product surface a small caps label is UI convention
           and reads as a field name; above a section heading it reads as
           template furniture. Different job, different call. */}
        <span className="text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--text-secondary)' }}>
          Readiness
        </span>
        {/* tabular-nums: the scores sit in a comparison column across three
           cards, and proportional figures make that column ragged. */}
        <span
          className="font-heading text-sm font-bold"
          style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
        >
          {score}
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>/100</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--background-tertiary)' }}>
        <div
          className="h-full rounded-full"
          style={{ background: tone.bar, width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function PathCard({ path }) {
  const tone = TONE[path.tier];
  const isBest = path.tier === 'best';

  return (
    <div
      className="relative flex h-full flex-col rounded-[var(--r-surface)] bg-white p-5 text-left"
      style={{
        border: `1px solid ${tone.border}`,
        boxShadow: isBest
          ? '0 18px 44px rgba(31,58,95,0.13), 0 2px 8px rgba(31,58,95,0.05)'
          : '0 10px 30px rgba(31,58,95,0.07)',
      }}
    >
      <span
        className="mb-3 w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold"
        style={{ background: tone.chipBg, color: tone.chipFg }}
      >
        {path.label}
      </span>

      {/* Not a heading. These are sample rows inside a product surface, not
         sections of the document, and as an h3 directly under the hero h1
         they were the page's "h1 → h3 skips a level" audit failure. A p with
         the same type carries the same weight visually and doesn't claim a
         place in the outline.

         Fixed two-line box: without it a one-line path name pulls its
         readiness bar up out of line with its neighbours, and a comparison
         view whose rows don't align stops reading as a comparison. */}
      <p
        className="font-heading text-[15px] font-bold leading-6 md:min-h-[3rem]"
        style={{ color: 'var(--text-primary)' }}
      >
        {path.path_name}
      </p>

      <ReadinessBar score={path.readiness_score} tone={tone} />

      <p className="mt-4 text-[13px] leading-5" style={{ color: 'var(--text-secondary)' }}>
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Tradeoff · </span>
        {path.main_tradeoffs}
      </p>
    </div>
  );
}

export default function PathPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      <p className="mb-4 text-center text-[13px]" style={{ color: 'var(--text-secondary)' }}>
        Sample output. This is what three paths look like.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {PATHS.map((p) => (
          <PathCard key={p.path_name} path={p} />
        ))}
      </div>
    </div>
  );
}
