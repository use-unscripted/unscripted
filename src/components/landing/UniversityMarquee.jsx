/* ──────────────────────────────────────────────────────────────────────────
   UniversityMarquee.

   Motion: driven by rAF through a motion value, so it can *ease* to a slower
   speed when the pointer is over it — the row decelerates like a physical
   object instead of stopping dead. Two copies and a measured width mean the
   wrap point is exact at any font size or zoom level.

   Type: every school gets its own wordmark treatment rather than one flat
   gray run. These are typographic — a serif for the old-guard privates, a
   condensed face for the state schools, heavy tight sans for the acronym
   schools — NOT reproductions of any university's actual logo, seal or
   wordmark. Those are trademarks, and showing them on a commercial page
   implies an endorsement none of these schools have given us. Keep it this
   way unless someone has written licences in hand.

   Kept monochrome on purpose: a one-ink wall reads as a logo wall (Ramp,
   Stripe, Linear all do this), school colors read as clip art, and half of
   them fail contrast on white anyway.
   ────────────────────────────────────────────────────────────────────────── */
import { useRef, useState, useLayoutEffect } from 'react';
import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from 'framer-motion';
import { CountUp } from '@/components/motion';

/* Each face is a distinct silhouette at a glance. Sizes are optically matched,
   not numerically — Oswald at 15px reads smaller than Playfair at 15px. Size
   goes through `--um-size` rather than `fontSize` so the mobile media query
   below can scale the whole set at once; an inline fontSize can't be overridden
   from a stylesheet. */
const FACES = {
  /* High-contrast serif, mixed case — the old-guard privates. */
  serif: {
    fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
    fontWeight: 700, '--um-size': '15.5px', letterSpacing: '-0.005em',
  },
  /* Same serif, engraved-plaque caps. */
  serifCap: {
    fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
    fontWeight: 600, '--um-size': '12.5px', letterSpacing: '0.15em', textTransform: 'uppercase',
  },
  /* Serif italic — the literary end of the set. */
  serifIt: {
    fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
    fontWeight: 500, fontStyle: 'italic', '--um-size': '16px', letterSpacing: '0',
  },
  /* Condensed caps — the big athletic state schools. */
  block: {
    fontFamily: "'Oswald', 'Arial Narrow', Impact, sans-serif",
    fontWeight: 600, '--um-size': '15.5px', letterSpacing: '0.05em', textTransform: 'uppercase',
  },
  /* Condensed, lighter and airier. */
  blockLt: {
    fontFamily: "'Oswald', 'Arial Narrow', Impact, sans-serif",
    fontWeight: 400, '--um-size': '15.5px', letterSpacing: '0.11em', textTransform: 'uppercase',
  },
  /* Geometric, widely tracked — the schools that brand themselves modern. */
  geo: {
    fontFamily: "'Josefin Sans', sans-serif",
    fontWeight: 600, '--um-size': '13px', letterSpacing: '0.22em', textTransform: 'uppercase',
  },
  /* Neutral grotesk, tight. */
  sans: {
    fontFamily: "'Switzer', system-ui, sans-serif",
    fontWeight: 700, '--um-size': '13.5px', letterSpacing: '-0.018em',
  },
  /* Heavy and very tight — reads as a monogram. For the acronym schools. */
  mark: {
    fontFamily: "'Switzer', system-ui, sans-serif",
    fontWeight: 700, '--um-size': '17.5px', letterSpacing: '-0.05em',
  },
};

/* [name, face, color].

   ⚠️ EVERY NAME BELOW MUST BE A SCHOOL THAT HAS AT LEAST ONE REAL SIGNED-UP
   STUDENT. This list used to be aspirational — 19 of its 43 entries (Yale,
   Princeton, Oxford, Georgetown, NYU, USC…) had zero users. This is the page a
   university career-services buyer reads before a $10k–$30k contract, and one
   of them seeing their own peer institution listed falsely kills the deal.
   Do not add a school here to make the wall look better.

   Derived 2026-07-31 from the distinct, normalized `college` values across
   StudentProfile (72 rows) and User (82 rows): 57 real institutions after
   trimming, case-folding, collapsing "Fairfield"/"Fairfield University", and
   dropping three non-institutions ("Ewick", "State University", and a high
   school). To refresh it, re-derive from that data — do not hand-add.

   The color is each school's own — approximated by eye, deliberately NOT
   pulled from their official brand kit. Color on its own isn't protectable
   (nobody owns navy and gold), which is exactly why this is the safe half of
   "make it look like their logo" and re-setting their wordmark is not.

   Where a school has a light/dark pair we take the dark one (Michigan blue
   over maize, Tennessee orange over white). Anything still too light for white
   gets darkened at render — see `ink()`. */
const SCHOOLS = [
  // Domestic
  ['Arizona State', 'block', '#8C1D40'],
  ['Babson College', 'geo', '#00694E'],
  ['Barnard College', 'serifCap', '#6CACE4'],
  ['Boston University', 'geo', '#CC0000'],
  ['Brown University', 'serif', '#4E3629'],
  ['Clemson University', 'block', '#F66733'],
  ['Colby College', 'serif', '#002878'],
  ['Colgate University', 'serif', '#7A1E2E'],
  ['Columbia University', 'serif', '#9BDDFF'],
  ['Cornell University', 'serifIt', '#B31B1B'],
  ['County College of Morris', 'blockLt', '#003F6C'],
  ['Duke University', 'serif', '#001A57'],
  ['Emory University', 'serif', '#012169'],
  ['Fairfield University', 'serif', '#C41230'],
  ['Florida State', 'block', '#782F40'],
  ['Iowa State', 'block', '#9B1B30'],
  ['Ithaca College', 'blockLt', '#00447C'],
  ['James Madison University', 'blockLt', '#450084'],
  ['Lawrence Technological University', 'geo', '#003F87'],
  ['UMass Amherst', 'mark', '#881C1C'],
  ['University of Miami', 'blockLt', '#005030'],
  ['University of Michigan', 'mark', '#00274C'],
  ['University of Mississippi', 'serifCap', '#14213D'],
  ['NC State', 'block', '#CC0000'],
  ['University of New Hampshire', 'blockLt', '#003591'],
  ['Northeastern University', 'blockLt', '#C0202E'],
  ['University of Notre Dame', 'serif', '#0C2340'],
  ['Ohio State', 'block', '#BB0000'],
  ['University of Oklahoma', 'block', '#841617'],
  ['Purdue University', 'block', '#8E6F3E'],
  ['Sacred Heart University', 'serifIt', '#B01C3A'],
  ['San Diego State', 'block', '#A6192E'],
  ['Southern Maine Community College', 'blockLt', '#00427E'],
  ['University of South Florida', 'block', '#00543C'],
  ['Swarthmore College', 'serif', '#862633'],
  ['Syracuse University', 'serifCap', '#D44500'],
  ['University of Tampa', 'serifIt', '#8B1A2B'],
  ['University of Tennessee', 'block', '#FF8200'],
  ['UT Austin', 'mark', '#BF5700'],
  ['University of Toledo', 'block', '#15397F'],
  ['Touro University', 'geo', '#1B3A6B'],
  ['Tulane University', 'serifIt', '#006747'],
  ['Union College', 'serifCap', '#6E2639'],
  ['UNC Chapel Hill', 'serif', '#4B9CD3'],
  ['UC Santa Barbara', 'mark', '#003660'],
  ['University of Virginia', 'serif', '#232D4B'],
  ['Valparaiso University', 'serifIt', '#59331D'],
  ['Virginia Tech', 'block', '#630031'],
  ['WPI', 'mark', '#9E1B32'],
  ['Xavier University', 'serifCap', '#0C2340'],
  // International
  ['Dalhousie University', 'sans', '#9C7C00'],
  ['Dublin City University', 'geo', '#1C3F94'],
  ['University of Edinburgh', 'sans', '#003865'],
  ['University of Klagenfurt', 'geo', '#00548F'],
  ['McMaster University', 'sans', '#7A003C'],
  ['Trinity College Dublin', 'serifCap', '#0A2240'],
  ['Western University', 'sans', '#4F2683'],
];

/* Flip to false for the one-ink version. */
const TINTED = true;

/* School colors were picked for a football helmet, not for 13px text on white.
   Carolina blue is 1.9:1 and Tennessee orange 2.3:1 — invisible as words. Walk
   the color toward black until it clears the 4.5:1 text minimum, which keeps
   the hue (it still reads as Carolina blue) and makes it legible. */
const contrast = (r, g, b) => {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (L + 0.05);
};

const inkCache = new Map();
function ink(hex) {
  if (inkCache.has(hex)) return inkCache.get(hex);
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  /* Multiplicative, so hue and relative channel balance survive the darkening. */
  for (let i = 0; i < 40 && contrast(r, g, b) < 4.5; i++) {
    r *= 0.94; g *= 0.94; b *= 0.94;
  }
  const out = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  inkCache.set(hex, out);
  return out;
}

const BASE_SPEED = 42;      // px/sec at rest
const HOVER_FACTOR = 0.22;  // slow to ~22% while the pointer is over the row
const EASE_RATE = 0.055;    // how quickly speed converges each frame

function Wordmark({ name, face, color }) {
  return (
    <span
      className="um-mark"
      style={{ ...FACES[face], color: TINTED ? ink(color) : 'var(--text-secondary)' }}
    >
      {name}
    </span>
  );
}

function Row({ trackRef }) {
  return (
    <div ref={trackRef} className="flex items-center" style={{ width: 'max-content' }}>
      {SCHOOLS.map(([name, face, color], i) => (
        <span key={name} className="flex items-center whitespace-nowrap">
          <span className="px-3 sm:px-5">
            <Wordmark name={name} face={face} color={color} />
          </span>
          {/* Decoration, not content — see `.um-sep`. */}
          <span aria-hidden="true" className="um-dot um-sep" />
        </span>
      ))}
    </div>
  );
}

/* Reduced motion: the row never moves, so a clipped marquee would show six
   schools and hide every other one with no way to reach them. Wrap them
   instead. */
function StaticWall() {
  return (
    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-3 px-6">
      {SCHOOLS.map(([name, face, color]) => (
        <Wordmark key={name} name={name} face={face} color={color} />
      ))}
    </div>
  );
}

export default function UniversityMarquee() {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const trackRef = useRef(null);
  const [width, setWidth] = useState(0);
  const speed = useRef(1);
  const hovered = useRef(false);

  /* Measure one copy so the wrap point is exact regardless of font metrics.
     Fonts land after first paint, so remeasure when they do — otherwise the
     width is taken from the fallback stack and the loop stutters. */
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, []);

  useAnimationFrame((_, delta) => {
    if (reduce || !width) return;
    /* Clamp: a backgrounded tab hands back a multi-second delta on return,
       which would teleport the row. */
    const dt = Math.min(delta, 50) / 1000;

    const target = hovered.current ? HOVER_FACTOR : 1;
    speed.current += (target - speed.current) * EASE_RATE;

    let next = x.get() - dt * BASE_SPEED * speed.current;
    if (next <= -width) next += width;
    x.set(next);
  });

  return (
    <section
      className={`um-wall ${TINTED ? 'um-tint' : 'um-mono'} overflow-hidden py-6 border-y`}
      style={{ borderColor: 'var(--border-light)', background: 'var(--background-primary)' }}
      onMouseEnter={() => { hovered.current = true; }}
      onMouseLeave={() => { hovered.current = false; }}
    >
      {/* "schools", not "universities" — of the 57 real institutions, eight are
          colleges (two of those community colleges) and one is an institute,
          so "universities" was flatly wrong for a sixth of the list. 55 is the
          four-year count and a deliberate floor under the real 57; don't raise
          it without re-deriving from the data. */}
      <p
        className="mb-4 text-center text-[13px]"
        style={{ color: 'var(--text-secondary)' }}
      >
        Students from <CountUp to={55} style={{ fontVariantNumeric: 'tabular-nums' }} />+ schools
      </p>

      {reduce ? (
        <StaticWall />
      ) : (
        <div className="relative w-full">
          {/* Edge fades */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 sm:w-24"
            style={{ background: 'linear-gradient(to right, var(--background-primary), transparent)' }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 sm:w-24"
            style={{ background: 'linear-gradient(to left, var(--background-primary), transparent)' }}
          />

          <motion.div className="flex items-center" style={{ x, width: 'max-content', willChange: 'transform' }}>
            <Row trackRef={trackRef} />
            <div aria-hidden="true">
              <Row trackRef={{ current: null }} />
            </div>
          </motion.div>
        </div>
      )}

      <style>{`
        /* The separator dots used to pulse on a 4.2s infinite loop. The strip
           they sit in is already scrolling — a second, slower loop inside a
           moving element is motion nobody can read. */
        /* The separator between wordmarks is pure decoration, and it is
           deliberately built so that it reads that way to a machine too.

           It carries no information: the names are already separated by the
           padding and by radically different typefaces and colors, and it
           *pulses*, which is something information never does.

           It used to be a "·" glyph in gold-500, which measures 1.95:1 on
           white and so scored as a text-contrast failure. Darkening it cannot
           fix that: at the 0.28 trough of the pulse, even PURE BLACK only
           reaches 1.99:1 — the pulse would have to bottom out at 0.417 opacity
           before any color could clear 3:1, and that is the wall's motion,
           which is not this file's to renegotiate for a scanner's benefit.

           So it is drawn as a CSS dot instead of a text node, which is what it
           always was visually, and marked aria-hidden so a screen reader stops
           announcing a middle dot after all 57 schools. Pure decoration is
           exempt from both 1.4.3 and 1.4.11. If you ever give it meaning, it
           stops being exempt — give it contrast instead. */
        .um-sep {
          display: inline-block;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: var(--brand-gold-500);
          vertical-align: middle;
          flex: none;
        }
        .um-mark {
          display: inline-block;
          line-height: 1.35;
          font-size: calc(var(--um-size) * var(--um-scale, 1));
          transition: color 220ms ease;
        }
        /* Only in the one-ink version — tinted names already carry their own
           identity, and forcing them all navy on hover would erase it. */
        .um-wall.um-mono .um-mark:hover { color: var(--brand-navy-900); }
        /* A phone shows four or five of these at most — shrink the set so it's
           four or five whole names rather than two clipped ones. */
        @media (max-width: 640px) {
          .um-mark { --um-scale: 0.82; }
        }
        @media (prefers-reduced-motion: reduce) {
          .um-mark { transition: none; }
        }
      `}</style>
    </section>
  );
}
