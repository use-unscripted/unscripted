/**
 * One navigation stack per bottom tab.
 *
 * Native apps keep a tab where you left it: go three screens deep in one tab,
 * switch to another, come back, and you are still three screens deep and at the
 * same scroll offset. This module is that memory. It stores, per tab, the last
 * route visited inside it and the scroll offset of every route it has seen.
 *
 * Session storage, not local: a new session starts each tab at its root, which
 * is what a fresh app launch does.
 */
const KEY = 'unscripted:tab-stacks';

// Which routes belong to which tab. Deep screens are reached from inside a tab,
// so they belong to that tab's stack rather than to a tab of their own.
export const TAB_ROUTES = {
  '/journey': ['/journey', '/moment', '/experiment', '/experiments', '/paths', '/reflect', '/guide', '/roadmap', '/explore', '/choose', '/test', '/prove', '/decide', '/saved', '/goals-tracker'],
  '/conviction-lab': ['/conviction-lab', '/all-paths'],
  '/matrix': ['/matrix'],
  '/evidence': ['/evidence', '/career-profile', '/recently-deleted'],
  '/settings': ['/settings', '/blueprints', '/resources', '/creators'],
};

export const TAB_ROOTS = Object.keys(TAB_ROUTES);

/** The tab a route belongs to, or null for anything outside the shell. */
export function tabOf(pathname) {
  const path = (pathname || '').replace(/\/+$/, '') || '/';
  let best = null;
  for (const [root, routes] of Object.entries(TAB_ROUTES)) {
    for (const route of routes) {
      if (path === route || path.startsWith(`${route}/`)) {
        // Longest match wins, so /experiments never resolves through /experiment.
        if (!best || route.length > best.length) best = root;
      }
    }
  }
  return best;
}

function readAll() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}

function writeAll(next) {
  try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
}

/** Records the route (with its query string) and scroll offset for its tab. */
export function rememberLocation(fullPath, pathname, scrollY) {
  const tab = tabOf(pathname);
  if (!tab) return;
  const all = readAll();
  const entry = all[tab] || { path: fullPath, scroll: {} };
  entry.path = fullPath;
  entry.scroll = { ...entry.scroll, [fullPath]: Math.max(0, Math.round(scrollY || 0)) };
  writeAll({ ...all, [tab]: entry });
}

/**
 * Records only which screen a tab is on, leaving its saved scroll offsets
 * alone. Called on arrival, so a tab entered and left without scrolling still
 * resumes on the right screen.
 */
export function rememberPath(fullPath, pathname) {
  const tab = tabOf(pathname);
  if (!tab) return;
  const all = readAll();
  const entry = all[tab] || { path: fullPath, scroll: {} };
  writeAll({ ...all, [tab]: { ...entry, path: fullPath } });
}

/** Where this tab was last left, or its root the first time it is opened. */
export function lastLocation(tabRoot) {
  return readAll()[tabRoot]?.path || tabRoot;
}

/** The scroll offset saved for a route, or 0. */
export function savedScroll(fullPath) {
  const tab = tabOf(fullPath.split('?')[0]);
  if (!tab) return 0;
  return readAll()[tab]?.scroll?.[fullPath] || 0;
}