/* ──────────────────────────────────────────────────────────────────────────
   HeroBackdrop — ambient depth behind the hero.

   Deliberately CSS-only. The Base44 app ships `three` and the job posting
   asks for shader work, but a WebGL hero on a student product means ~600kb
   of three.js plus a live render loop on phones. Two drifting radial
   gradients over a masked dot grid get 90% of the atmosphere for ~0kb, and
   the compositor handles it on the GPU without a JS frame loop.

   Opacities are low on purpose. This is a calm navy/gold brand; the backdrop
   should be felt, not seen.
   ────────────────────────────────────────────────────────────────────────── */
import { useReducedMotion } from 'framer-motion';

export default function HeroBackdrop() {
  const reduce = useReducedMotion();

  const dotMask =
    'radial-gradient(ellipse 72% 58% at 50% 34%, #000 18%, transparent 76%)';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Fine dot grid, masked to a soft ellipse behind the headline */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(31,58,95,0.11) 1px, transparent 0)',
          backgroundSize: '26px 26px',
          maskImage: dotMask,
          WebkitMaskImage: dotMask,
        }}
      />

      {/* Drifting navy wash */}
      <div
        className={reduce ? '' : 'ub-drift-a'}
        style={{
          position: 'absolute',
          top: '-18%',
          left: '8%',
          width: '46vw',
          height: '46vw',
          maxWidth: 760,
          maxHeight: 760,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(39,76,119,0.16) 0%, rgba(39,76,119,0.05) 45%, transparent 70%)',
          filter: 'blur(18px)',
        }}
      />

      {/* Drifting gold wash — the accent, kept faint */}
      <div
        className={reduce ? '' : 'ub-drift-b'}
        style={{
          position: 'absolute',
          top: '4%',
          right: '4%',
          width: '38vw',
          height: '38vw',
          maxWidth: 620,
          maxHeight: 620,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(214,182,106,0.20) 0%, rgba(214,182,106,0.06) 45%, transparent 70%)',
          filter: 'blur(22px)',
        }}
      />

      <style>{`
        @keyframes ub-drift-a {
          0%   { transform: translate3d(0, 0, 0) scale(1); }
          50%  { transform: translate3d(4%, 3%, 0) scale(1.08); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes ub-drift-b {
          0%   { transform: translate3d(0, 0, 0) scale(1.04); }
          50%  { transform: translate3d(-5%, 4%, 0) scale(1); }
          100% { transform: translate3d(0, 0, 0) scale(1.04); }
        }
        /* Long durations + offset phases so the two never visibly sync up */
        .ub-drift-a { animation: ub-drift-a 26s ease-in-out infinite; will-change: transform; }
        .ub-drift-b { animation: ub-drift-b 34s ease-in-out infinite; will-change: transform; }

        @media (prefers-reduced-motion: reduce) {
          .ub-drift-a, .ub-drift-b { animation: none !important; }
        }
      `}</style>
    </div>
  );
}