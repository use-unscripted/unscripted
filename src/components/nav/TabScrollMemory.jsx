import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { rememberLocation, rememberPath, savedScroll } from '@/lib/tab-stacks';

/**
 * Saves where the student is inside each tab, and puts them back there when they
 * return to it. Renders nothing.
 *
 * The restore has to be patient: a screen mounts short and grows as its data
 * lands, so a single scrollTo would be clamped to the height of a page that has
 * not filled in yet. It retries until the offset is reachable, gives up after a
 * couple of seconds, and stops the moment the student scrolls themselves.
 *
 * Nothing is recorded while a restore is running, or the clamped position would
 * overwrite the offset being restored to.
 */
const RETRY_MS = 120;
// Long enough for a screen whose panels each fetch their own data to finish
// growing. It stops early the moment the offset is reached.
const GIVE_UP_MS = 5000;

export default function TabScrollMemory() {
  const { pathname, search } = useLocation();
  const fullPath = pathname + search;
  const restoring = useRef(false);

  // Arriving is enough to make this the tab's current screen, so a screen opened
  // and left without a single scroll is still where the tab resumes.
  useEffect(() => { rememberPath(fullPath, pathname); }, [fullPath, pathname]);

  // Remember this route's offset as the student scrolls, and once more as they
  // leave. The first half-second is ignored on purpose: the router scrolls a new
  // route to the top, and recording that would erase the offset being restored.
  useEffect(() => {
    const settled = { yes: false };
    const latest = { y: null };
    const settleTimer = window.setTimeout(() => { settled.yes = true; }, 500);

    const onScroll = () => {
      if (restoring.current || !settled.yes) return;
      latest.y = window.scrollY;
      rememberLocation(fullPath, pathname, latest.y);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener('scroll', onScroll);
      // The last offset the student actually scrolled to, never whatever the
      // page happens to sit at while it is being torn down.
      if (!restoring.current && latest.y != null) rememberLocation(fullPath, pathname, latest.y);
    };
  }, [fullPath, pathname]);

  // Come back to a tab, land where you left it.
  useEffect(() => {
    const target = savedScroll(fullPath);
    if (target <= 0) return;

    restoring.current = true;
    const started = Date.now();
    let timer = 0;

    const stop = () => {
      restoring.current = false;
      window.clearTimeout(timer);
      window.removeEventListener('wheel', onUserScroll);
      window.removeEventListener('touchstart', onUserScroll);
      window.removeEventListener('keydown', onUserScroll);
    };
    // A student who starts scrolling owns the page from then on.
    const onUserScroll = () => stop();

    const tick = () => {
      if (!restoring.current) return;
      window.scrollTo({ top: target, behavior: 'instant' });
      const reached = Math.abs(window.scrollY - target) <= 2;
      if (reached || Date.now() - started > GIVE_UP_MS) { stop(); return; }
      timer = window.setTimeout(tick, RETRY_MS);
    };

    window.addEventListener('wheel', onUserScroll, { passive: true });
    window.addEventListener('touchstart', onUserScroll, { passive: true });
    window.addEventListener('keydown', onUserScroll);
    timer = window.setTimeout(tick, 60);

    return stop;
  }, [fullPath]);

  return null;
}