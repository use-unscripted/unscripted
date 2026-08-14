/* ──────────────────────────────────────────────────────────────────────────
   WhatDoYouWant — the film moment in the hero.

   A 1.75 second cut of Sean asking Will "What do you want to do?" It sits in
   the fold next to the copy so the page opens on the question the product
   exists to answer, instead of only asserting it in the headline.

   The cut is 3:14.18 to 3:16.18 of the Miramax upload of the scene, which is
   Sean's single unbroken close-up: he cuts in at 3:14.15 and back out to Will
   at 3:16.2, and the line runs 3:14.88 to roughly 3:16.3. Those boundaries
   come from the word-level timings in the caption track, not from the cue
   blocks, which roll two lines at a time and are useless for this. A first
   pass trusted the cue block and landed five seconds late, on Sean listening
   rather than asking. If this ever needs recutting, read the word timings.

   ⚠️ Do NOT put a fade to black on the ends. It was tried and it blinks twice
   a cycle on a loop this short, which is what a viewer notices instead of the
   line. The file instead carries a 0.25s crossfade wrapped around its own
   loop point: the last quarter second is dissolved into the first, so the
   final frame and the opening frame are the same image and the cycle has no
   seam. Measured, the jump at the loop point is 1.5x an ordinary frame to
   frame change, against 6.4x for a straight hard loop. That is why the clip
   is 1.75s from a 2s cut. Re-encoding it without the crossfade brings the pop
   back, so recut from the 2s source and redo the wrap rather than trimming
   this file.

   ⚠️ RIGHTS: the footage is from Good Will Hunting (1997), Miramax. We do not
   hold a licence for it. This was added at Drew's direction on 2026-08-14
   after the copyright position was laid out: unlicensed film footage used in
   commercial marketing is infringing, fair use is unlikely to apply because
   the use is commercial and not transformative, and the practical exposure is
   less "we get sued" than "university counsel finds it during diligence and
   the contract stalls." Anyone who wants that reversed, swap the two files in
   public/media and delete the attribution line. Nothing else needs touching.

   Delivered as h264 rather than an actual GIF. Same silent autoplaying loop
   to a viewer, 63KB instead of the ~740KB a 400px GIF of the same seconds
   costs, and it doesn't lock us to 256 colours. The source is 360p, which is
   the ceiling on what was available, so the frame is deliberately capped
   narrow: past about 420px of display width it goes visibly soft.

   The clip is muted (autoplay requires it) so the line is rendered as real
   text underneath rather than left as mouth movement nobody can read.
   ────────────────────────────────────────────────────────────────────────── */
import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Reveal, EASE_COPY } from '@/components/motion';

const POSTER = '/media/what-do-you-want-poster.jpg';
const CLIP = '/media/what-do-you-want.mp4';

export default function WhatDoYouWant() {
  const reduce = useReducedMotion();
  const videoRef = useRef(null);

  /* Safari ignores the muted attribute when React sets it as a prop on first
     paint, and an unmuted autoplay is blocked outright, so the element ends up
     frozen on the poster. Setting it on the node before play() is the fix. */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduce) return;
    el.muted = true;
    const attempt = el.play();
    /* Autoplay can still be refused (low power mode, data saver). The poster
       stays up in that case, which is a legible still rather than a gap. */
    if (attempt?.catch) attempt.catch(() => {});
  }, [reduce]);

  return (
    <Reveal delay={1050} y={14} duration={0.72} ease={EASE_COPY}>
      <figure className="m-0 w-full max-w-[420px]">
        <div
          className="relative overflow-hidden rounded-[var(--r-surface)]"
          style={{
            border: '1px solid var(--border-light)',
            boxShadow: '0 18px 40px rgb(31 58 95 / 0.16)',
            background: 'var(--brand-navy-900)',
            aspectRatio: '16 / 9',
          }}
        >
          {reduce ? (
            <img
              src={POSTER}
              alt="Sean asks Will what he wants to do, in Good Will Hunting."
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              src={CLIP}
              poster={POSTER}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              aria-label="Sean asks Will what he wants to do, in Good Will Hunting."
            />
          )}
        </div>

        <figcaption className="mt-4">
          <p
            className="font-heading text-xl font-bold leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            “What do you want to do?”
          </p>
          <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Good Will Hunting, 1997
          </p>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            You’re not supposed to know yet. That’s what the 30 days are for.
          </p>
        </figcaption>
      </figure>
    </Reveal>
  );
}
