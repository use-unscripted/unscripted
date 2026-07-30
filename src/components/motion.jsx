/* ──────────────────────────────────────────────────────────────────────────
   Unscripted motion primitives.

   Built on framer-motion, which is ALREADY in the Base44 app's package.json
   (framer-motion@^11.16.4) — nothing here needs a new dependency.

   Every primitive checks useReducedMotion() and degrades to a static,
   fully-legible state. Motion is decoration; the page reads without it.
   ────────────────────────────────────────────────────────────────────────── */
import { useRef, useState, useEffect, useCallback } from 'react';
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
  useInView,
  animate,
} from 'framer-motion';

/* Brand easing — expo ease-out. Matches --ease-out in index.css. */
export const EASE = [0.16, 1, 0.3, 1];
export const EASE_SPRING = [0.34, 1.56, 0.64, 1];

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

/* ── Magnetic ──────────────────────────────────────────────────────────────
   The button leans toward the cursor as it approaches, then springs back.

   Kept deliberately small (max ~9px of travel). Big magnetic offsets feel
   like a toy; small ones just make the button feel alive and physical.
   ──────────────────────────────────────────────────────────────────────── */
export function Magnetic({ children, strength = 0.28, max = 9, className = '', style }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springCfg = { stiffness: 240, damping: 16, mass: 0.35 };
  const sx = useSpring(x, springCfg);
  const sy = useSpring(y, springCfg);

  const clamp = (v) => Math.max(-max, Math.min(max, v));

  const onMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    x.set(clamp(dx * strength));
    y.set(clamp(dy * strength));
  }, [strength, max]);

  const reset = useCallback(() => { x.set(0); y.set(0); }, []);

  if (reduce) {
    return <span className={className} style={{ display: 'inline-block', ...style }}>{children}</span>;
  }

  return (
    <motion.span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={className}
      style={{ display: 'inline-block', x: sx, y: sy, ...style }}
    >
      {children}
    </motion.span>
  );
}

/* ── Tilt ──────────────────────────────────────────────────────────────────
   Pointer-tracked 3D tilt with a gold specular highlight that follows the
   cursor. Max rotation is 5deg — past ~7deg it stops reading as "premium
   material" and starts reading as "CSS demo".
   ──────────────────────────────────────────────────────────────────────── */
export function Tilt({ children, className = '', style, maxDeg = 5, glow = true }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const opacity = useMotionValue(0);

  const cfg = { stiffness: 220, damping: 20, mass: 0.4 };
  const srx = useSpring(rx, cfg);
  const sry = useSpring(ry, cfg);
  const sop = useSpring(opacity, { stiffness: 160, damping: 24 });

  const glowBg = useTransform(
    [gx, gy],
    ([px, py]) =>
      `radial-gradient(340px circle at ${px}% ${py}%, rgba(214,182,106,0.16), transparent 62%)`
  );

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * maxDeg * 2);
    rx.set(-(py - 0.5) * maxDeg * 2);
    gx.set(px * 100);
    gy.set(py * 100);
  };

  const onEnter = () => opacity.set(1);
  const onLeave = () => { rx.set(0); ry.set(0); opacity.set(0); };

  if (reduce) {
    return <div className={className} style={style}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={className}
      style={{
        ...style,
        position: 'relative',
        rotateX: srx,
        rotateY: sry,
        transformPerspective: 900,
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }}
    >
      {children}
      {glow && (
        <motion.span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            background: glowBg,
            opacity: sop,
            pointerEvents: 'none',
          }}
        />
      )}
    </motion.div>
  );
}

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
    const mv = { v: 0 };
    const controls = animate(0, to, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, duration, reduce]);

  return <span ref={ref} className={className} style={style}>{display}</span>;
}

/* ── ScrollProgress ────────────────────────────────────────────────────────
   Hairline gold progress rule pinned to the top of the page.
   ──────────────────────────────────────────────────────────────────────── */
export function ScrollProgress({ scaleX }) {
  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 60,
        transformOrigin: 'left center',
        scaleX,
        background: 'linear-gradient(90deg, var(--brand-navy-700), var(--brand-gold-500))',
      }}
    />
  );
}