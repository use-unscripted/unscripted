/**
 * How a screen inside the app arrives.
 *
 * The landing page's fold comes in as a short fade with a few pixels of travel,
 * on the copy curve rather than the expo one, and nothing else moves. Inside the
 * app, screens simply snapped into place, which is most of why the two halves of
 * the site felt like different products.
 *
 * One gesture per navigation, keyed on the route so it fires when the screen
 * changes and never mid-screen while data lands. Deliberately quieter and faster
 * than the landing hero: this is a working surface people move around in all day,
 * not a page they read once.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { EASE_COPY } from '@/components/motion';

export default function RouteTransition({ children }) {
  const reduce = useReducedMotion();
  const { pathname } = useLocation();

  if (reduce) return children;

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: EASE_COPY }}
    >
      {children}
    </motion.div>
  );
}