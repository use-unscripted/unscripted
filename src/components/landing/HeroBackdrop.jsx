/* ──────────────────────────────────────────────────────────────────────────
   HeroBackdrop — the dot field behind the hero.

   This used to carry two large blurred circles as well, one navy and one
   gold, drifting on 26s and 34s loops that never ended. Both are gone.

   "Ambient blurred coloured circles drifting behind the hero, added for
   depth" is a named generated-page tell, and it doesn't stop being one
   because the circles are in brand colours. The second problem was the
   loops: a page with something permanently in motion never settles, and
   these two also held `will-change: transform` forever, which pins a
   compositor layer for the whole session on a phone that could be doing
   something else with it.

   What's left is the masked dot grid, which was doing the real work — it
   gives the fold texture without moving, and it costs one background-image.
   Don't put the circles back. If the hero needs more presence, it needs
   better content in it, not more atmosphere behind it.
   ────────────────────────────────────────────────────────────────────────── */

export default function HeroBackdrop() {
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
    </div>
  );
}
