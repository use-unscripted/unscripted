/* ──────────────────────────────────────────────────────────────────────────
   Unscripted motion primitives.

   Built on framer-motion, which is ALREADY in the Base44 app's package.json
   (framer-motion@^11.16.4) — nothing here needs a new dependency.

   Every primitive checks useReducedMotion() and degrades to a static,
   fully-legible state. Motion is decoration; the page reads without it.
   ────────────────────────────────────────────────────────────────────────── */
import { useRef, useState, useEffect } from 'react';
import {
  motion,
  useReducedMotion,
  useInView,
  animate,
} from 'framer-motion';

/* Brand easing — expo ease-out. Matches --ease-out in index.css. */
export const EASE = [0.16, 1, 0.3, 1];
/* The EASE_SPRING overshoot curve that used to be exported here is gone.
   Bounce easing on UI state is a tell, and it had spread to every button and
   card on the site. Genuine physical interactions can use --ease-overshoot
   from index.css. */

/* ── Reveal ────────────────────────────────────────────────────────────────
   Drop-in replacement for the existing ScrollReveal. Same props, but driven
   by framer-motion's viewport detection instead of a hand-rolled observer,
   so it composes with the rest of the system and cleans up after itself.
   ──────────────────────────────────────────────────────────────────────── */
export function Reveal({
  children,
  delay = 0,
  y = 22,
  className = '',
  style,
  as = 'div',
  amount = 0.15,
  duration = 0.75,
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as] ?? motion.div;

  if (reduce) {
    const Plain = as;
    return <Plain className={className} style={style}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration, ease: EASE, delay: delay / 1000 }}
    >
      {children}
    </Tag>
  );
}

/* ── Stagger ───────────────────────────────────────────────────────────────
   Wraps each direct child in its own reveal, offset by `step` ms.
   ──────────────────────────────────────────────────────────────────────── */
export function Stagger({ children, base = 0, step = 80, className = '', y = 20, as = 'div' }) {
  const kids = Array.isArray(children) ? children : [children];
  const Tag = as;
  return (
    <Tag className={className}>
      {kids.filter(Boolean).map((child, i) => (
        <Reveal key={i} delay={base + i * step} y={y} duration={0.6}>
          {child}
        </Reveal>
      ))}
    </Tag>
  );
}

/* ── WordReveal ────────────────────────────────────────────────────────────
   Headline treatment: each word rises out from behind a clip mask.

   This is the single biggest upgrade over a block fade-up — it's what makes
   an expensive site read as expensive. The mask is per-word (not per-letter):
   letter-by-letter reads as gimmicky at this brand's register, and it wrecks
   screen-reader output.

   Accessibility: the real text lives in aria-label, the animated glyphs are
   aria-hidden, so assistive tech reads one clean string.
   ──────────────────────────────────────────────────────────────────────── */
export function WordReveal({
  text,
  className = '',
  style,
  delay = 0,
  stagger = 0.055,
  duration = 0.9,
  as: Tag = 'span',
}) {
  const reduce = useReducedMotion();
  const words = String(text).split(' ');

  if (reduce) {
    return <Tag className={className} style={style}>{text}</Tag>;
  }

  /* Viewport detection MUST sit on the outer, unclipped element, with the
     words driven as variant children.

     Putting whileInView on each word deadlocks: a word parked at y:115% sits
     entirely outside its own overflow:hidden mask, and IntersectionObserver
     clips a target's rect against every ancestor before reporting. It returns
     ratio 0, the trigger never fires, and the word stays hidden — hidden by
     the exact transform the animation exists to remove.
     Variants propagate through context, so the child's own visibility is
     irrelevant. */
  const container = {
    hidden: {},
    show: { transition: { delayChildren: delay, staggerChildren: stagger } },
  };
  const wordVariant = {
    hidden: { y: '115%' },
    show: { y: '0%', transition: { duration, ease: EASE } },
  };

  const MotionTag = motion[Tag] ?? motion.span;

  return (
    <MotionTag
      className={className}
      style={style}
      aria-label={text}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
    >
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          aria-hidden="true"
          style={{
            display: 'inline-block',
            overflow: 'hidden',
            verticalAlign: 'bottom',
            /* Descenders (g, y, p) would clip against the mask edge without
               this padding; the negative margin keeps line-height honest. */
            paddingBottom: '0.14em',
            marginBottom: '-0.14em',
          }}
        >
          <motion.span variants={wordVariant} style={{ display: 'inline-block', willChange: 'transform' }}>
            {word}
          </motion.span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </MotionTag>
  );
}

/* ── UnderlineDraw ─────────────────────────────────────────────────────────
   Gold rule that wipes in under an emphasised phrase.
   ──────────────────────────────────────────────────────────────────────── */
export function UnderlineDraw({ delay = 0.6, height = 4, color = 'var(--brand-gold-500)' }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '0.02em',
        height,
        borderRadius: height,
        background: color,
        transformOrigin: 'left center',
        display: 'block',
      }}
      initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE, delay }}
    />
  );
}

/* Magnetic and Tilt used to live here.

   Magnetic made every CTA lean toward the cursor; Tilt gave each card a
   pointer-tracked 3D rotation with a gold specular highlight. Both were
   applied to every button and every card on the landing page, which is the
   universal-hover-affordance tell — one signal per element, not four. Removed
   rather than toned down; if a genuinely physical interaction ever needs
   overshoot, --ease-overshoot is still in index.css for it.
   ──────────────────────────────────────────────────────────────────────── */

/* ── CountUp ───────────────────────────────────────────────────────────────
   Counts to `to` once the element enters the viewport.
   ──────────────────────────────────────────────────────────────────────── */
export function CountUp({ to, duration = 1.4, className = '', style }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce || !inView) return;
    const controls = animate(0, to, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, duration, reduce]);

  return <span ref={ref} className={className} style={style}>{display}</span>;
}

/* ScrollProgress (a fixed gold progress rule pinned to the top of the page)
   was removed with the landing rebuild — a marketing page is not a long-form
   article, and the reader already has a scrollbar. */
