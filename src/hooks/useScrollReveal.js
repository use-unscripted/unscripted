import { useEffect, useRef, useState } from 'react';

/*
 * How far a block has to climb into the viewport before it reveals, as a
 * share of the viewport. Kept as a percentage on purpose: a percentage is
 * always smaller than the viewport it is measured against, which is what
 * makes the guarantee below hold on a 568px phone as well as a desktop.
 */
const ENTER_MARGIN = '0px 0px -12% 0px';

/*
 * The safety net threshold, as a share of the ELEMENT. Only ever used for
 * blocks short enough to fit on screen, so 0.9 is always reachable for them.
 * Deliberately not 1: browsers round intersection ratios against device pixel
 * ratios and an exact 1.0 can be missed.
 */
const FILLED = 0.9;

/**
 * Fires once when the element enters the viewport.
 * Returns [ref, isVisible].
 *
 * Two observers, and the reveal fires on whichever trips first. That looks
 * like belt and braces, and it is, for a reason worth writing down.
 *
 * An IntersectionObserver threshold is a fraction of THE ELEMENT'S OWN box,
 * not a fraction of the viewport. So the old single observer at threshold
 * 0.12 asked for 12% of the element to be on screen at once, which an element
 * taller than about 8x the viewport can never satisfy at all, and which a
 * merely tall one cannot satisfy on arrival.
 *
 * That is what emptied the campus events panel on a phone. The section is
 * 3348px tall and starts 234px down a 660px visible viewport, so 402px had to
 * be showing and only 386px ever was until the student scrolled. A student
 * tapped Campus, got the title, the Month and List toggle, and then a screen
 * of nothing, with no cue that scrolling into the blank space would bring the
 * whole list back. Measured at 320x568 it is worse: 423px needed, 294px shown.
 * Desktop never saw it because a taller viewport clears the bar on arrival.
 *
 * So the primary trigger is height independent: any part of the element,
 * once the element has risen ENTER_MARGIN into the viewport. That covers
 * every element taller than the viewport, because such an element always ends
 * up covering the whole screen at some scroll position.
 *
 * That leaves one gap: a SHORT element sitting at the very bottom of the
 * document, which may never climb past the bottom margin because there is
 * nothing below it to scroll. The second observer covers exactly that case by
 * watching for the element being almost entirely on screen, which any element
 * shorter than the viewport can always reach. Between the two, no element of
 * any height on any viewport can end up permanently invisible.
 *
 * `threshold` is still honoured for callers that want a percentage of the
 * element, but it now only ever pulls a reveal EARLIER. Nothing a caller
 * passes can hold a reveal back, so nothing a caller passes can strand one.
 */
export function useScrollReveal(options = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced-motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const hint = typeof options.threshold === 'number' ? Math.min(options.threshold, FILLED) : FILLED;

    const entered = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) reveal(); },
      { threshold: 0, rootMargin: options.rootMargin ?? ENTER_MARGIN }
    );
    const filled = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) reveal(); },
      { threshold: hint }
    );

    function reveal() {
      setVisible(true);
      entered.disconnect();
      filled.disconnect();
    }

    entered.observe(el);
    filled.observe(el);
    return () => { entered.disconnect(); filled.disconnect(); };
  }, []);

  return [ref, visible];
}

/**
 * Parallax offset: returns a number in px based on scroll position.
 * Call inside a component; clamps to avoid jarring overscroll.
 */
export function useParallax(strength = 0.12) {
  const ref = useRef(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - window.innerHeight / 2;
      setOffset(center * strength);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [strength]);

  return [ref, offset];
}