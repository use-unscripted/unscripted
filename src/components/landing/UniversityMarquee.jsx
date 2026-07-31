/* ──────────────────────────────────────────────────────────────────────────
   UniversityMarquee.

   Before: a CSS `animation: marquee-scroll 50s linear infinite` on a tripled
   list. It works, but it's rigid — you can't slow it, you can't pause it,
   and the loop point depends on the magic `-33.333%` matching the 3× copy.

   After: driven by rAF through a motion value, so it can *ease* to a slower
   speed when the pointer is over it — the row decelerates like a physical
   object instead of stopping dead. Two copies and a measured width mean the
   wrap point is exact at any font size or zoom level.
   ────────────────────────────────────────────────────────────────────────── */
import { useRef, useState, useLayoutEffect } from 'react';
import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from 'framer-motion';
import { CountUp } from '@/components/motion';

const UNIVERSITIES = [
  // Domestic
  'Arizona State', 'Boston College', 'Brown University', 'Boston University',
  'Clemson University', 'Columbia University', 'Cornell University', 'Dartmouth College',
  'Florida State', 'Georgetown', 'James Madison', 'Liberty University',
  'LeTourneau University', 'University of Maryland', 'University of Michigan', 'NC State',
  'University of Notre Dame', 'NYU', 'University of Oklahoma', 'UPenn',
  'Princeton University', 'San Diego State', 'Syracuse University', 'Temple University',
  'UT Austin', 'Tulane University', 'UConn', 'UMass Amherst',
  'UNC Chapel Hill', 'USC', 'University of Tennessee', 'Vanderbilt',
  'Virginia Tech', 'Xavier University', 'Yale University', 'Ohio State',
  'UC San Diego', 'New Hampshire',
  // International
  'University of Cambridge', 'University of Oxford', 'University of Toronto',
  'McGill University', 'Dublin City University',
];

const DOT = '·';
const BASE_SPEED = 42;      // px/sec at rest
const HOVER_FACTOR = 0.22;  // slow to ~22% while the pointer is over the row
const EASE_RATE = 0.055;    // how quickly speed converges each frame

function Row({ trackRef }) {
  return (
    <div ref={trackRef} className="flex items-center" style={{ width: 'max-content' }}>
      {UNIVERSITIES.map((name, i) => (
        <span key={i} className="flex items-center whitespace-nowrap">
          <span className="px-4 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {name}
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

export default function UniversityMarquee() {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const trackRef = useRef(null);
  const [width, setWidth] = useState(0);
  const speed = useRef(1);
  const hovered = useRef(false);

  /* Measure one copy so the wrap point is exact regardless of font metrics. */
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
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
      className="overflow-hidden py-6 border-y"
      style={{ borderColor: 'var(--border-light)', background: 'var(--background-primary)' }}
      onMouseEnter={() => { hovered.current = true; }}
      onMouseLeave={() => { hovered.current = false; }}
    >
      <p
        className="mb-3 text-center text-[10px] font-bold uppercase tracking-[.18em]"
        style={{ color: 'var(--text-secondary)' }}
      >
        Students from <CountUp to={55} style={{ fontVariantNumeric: 'tabular-nums' }} />+ universities
      </p>

      <div className="relative w-full">
        {/* Edge fades */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24"
          style={{ background: 'linear-gradient(to right, var(--background-primary), transparent)' }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24"
          style={{ background: 'linear-gradient(to left, var(--background-primary), transparent)' }}
        />

        <motion.div className="flex items-center" style={{ x, width: 'max-content', willChange: 'transform' }}>
          <Row trackRef={trackRef} />
          <div aria-hidden="true">
            <Row trackRef={{ current: null }} />
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes um-dot-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.28; }
        }
        .um-dot { animation: um-dot-pulse 4.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .um-dot { animation: none; }
        }
      `}</style>
    </section>
  );
}