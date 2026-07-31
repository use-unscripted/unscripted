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
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 700, '--um-size': '13.5px', letterSpacing: '-0.018em',
  },
  /* Heavy and very tight — reads as a monogram. For the acronym schools. */
  mark: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 700, '--um-size': '17.5px', letterSpacing: '-0.05em',
  },
};

/* [name, face, color].

   The color is each school's own — approximated by eye, deliberately NOT
   pulled from their official brand kit. Color on its own isn't protectable
   (nobody owns navy and gold), which is exactly why this is the safe half of
   "make it look like their logo" and re-setting their wordmark is not.

   Where a school has a light/dark pair we take the dark one (Michigan blue
   over maize, USC cardinal over gold). Anything still too light for white gets
   darkened at render — see `ink()`. */
const UNIVERSITIES = [
  // Domestic
  ['Arizona State', 'block', '#8C1D40'],
  ['Boston College', 'serifCap', '#8A100B'],
  ['Brown University', 'serif', '#4E3629'],
  ['Boston University', 'geo', '#CC0000'],
  ['Clemson University', 'block', '#F66733'],
  ['Columbia University', 'serif', '#9BDDFF'],
  ['Cornell University', 'serifIt', '#B31B1B'],
  ['Dartmouth College', 'serifCap', '#00693E'],
  ['Florida State', 'block', '#782F40'],
  ['Georgetown', 'serifCap', '#041E42'],
  ['James Madison', 'blockLt', '#450084'],
  ['Liberty University', 'sans', '#A6192E'],
  ['LeTourneau University', 'blockLt', '#002F6C'],
  ['University of Maryland', 'block', '#E21833'],
  ['University of Michigan', 'mark', '#00274C'],
  ['NC State', 'block', '#CC0000'],
  ['University of Notre Dame', 'serif', '#0C2340'],
  ['NYU', 'mark', '#57068C'],
  ['University of Oklahoma', 'block', '#841617'],
  ['UPenn', 'serifCap', '#011F5B'],
  ['Princeton University', 'serif', '#E77500'],
  ['San Diego State', 'block', '#A6192E'],
  ['Syracuse University', 'serifCap', '#D44500'],
  ['Temple University', 'sans', '#9D2235'],
  ['UT Austin', 'mark', '#BF5700'],
  ['Tulane University', 'serifIt', '#006747'],
  ['UConn', 'mark', '#000E2F'],
  ['UMass Amherst', 'blockLt', '#881C1C'],
  ['UNC Chapel Hill', 'serif', '#4B9CD3'],
  ['USC', 'mark', '#990000'],
  ['University of Tennessee', 'block', '#FF8200'],
  ['Vanderbilt', 'serifIt', '#866D4B'],
  ['Virginia Tech', 'block', '#630031'],
  ['Xavier University', 'serifCap', '#0C2340'],
  ['Yale University', 'serif', '#00356B'],
  ['Ohio State', 'block', '#BB0000'],
  ['UC San Diego', 'geo', '#182B49'],
  ['New Hampshire', 'blockLt', '#003591'],
  // International
  ['University of Cambridge', 'serif', '#A3C1AD'],
  ['University of Oxford', 'serifCap', '#002147'],
  ['University of Toronto', 'sans', '#002A5C'],
  ['McGill University', 'serifIt', '#ED1B2F'],
  ['Dublin City University', 'geo', '#1C3F94'],
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

const DOT = '·';
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
      {UNIVERSITIES.map(([name, face, color], i) => (
        <span key={name} className="flex items-center whitespace-nowrap">
          <span className="px-3 sm:px-5">
            <Wordmark name={name} face={face} color={color} />
          </span>
          <span
            className="text-xs um-dot"
            style={{ color: 'var(--brand-gold-500)', animationDelay: `${(i % 7) * 0.32}s` }}
          >
            {DOT}
          </span>
        </span>
      ))}
    </div>
  );
}

/* Reduced motion: the row never moves, so a clipped marquee would show six
   schools and hide the other thirty-seven with no way to reach them. Wrap
   them instead. */
function StaticWall() {
  return (
    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-3 px-6">
      {UNIVERSITIES.map(([name, face, color]) => (
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
      <p
        className="mb-4 text-center text-[13px]"
        style={{ color: 'var(--text-secondary)' }}
      >
        Students from <CountUp to={55} style={{ fontVariantNumeric: 'tabular-nums' }} />+ universities
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
        @keyframes um-dot-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.28; }
        }
        .um-dot { animation: um-dot-pulse 4.2s ease-in-out infinite; }
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
          .um-dot { animation: none; }
          .um-mark { transition: none; }
        }
      `}</style>
    </section>
  );
}
