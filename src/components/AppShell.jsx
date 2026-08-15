import { Outlet, NavLink, useLocation } from 'react-router-dom';
import TabScrollMemory from '@/components/nav/TabScrollMemory';
import { tabOf, lastLocation } from '@/lib/tab-stacks';
import { Compass, FolderOpen, Settings, LogOut } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import RouteTransition from '@/components/RouteTransition';
import { clearStudentDrafts } from '@/lib/student-drafts';
import PilotTracker from '@/components/PilotTracker';
import { CycleRailColumn, CycleRailStrip } from '@/components/nav/CycleRailShell';

function CompassSVG() {
  return (
    <svg width="22" height="22" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 2px', marginTop: '-1px', flexShrink: 0 }}>
      <polygon points="50,2 56,48 44,48" fill="#5BA4CF" />
      <polygon points="50,98 56,52 44,52" fill="#1F6FAB" />
      <polygon points="98,50 52,44 52,56" fill="#C9A84C" />
      <polygon points="2,50 48,44 48,56" fill="#C9A84C" />
      <polygon points="50,44 56,50 50,56 44,50" fill="white" opacity="0.9" />
    </svg>
  );
}

/**
 * Three destinations, one journey. Deep screens (paths, missions, week, guides)
 * are reached from inside My Journey rather than competing with it in the nav.
 */
const NAV = [
  ['/journey',  'My Journey',        'Journey',  Compass],
  ['/evidence', 'Evidence',          'Evidence', FolderOpen],
  ['/settings', 'Profile & Settings', 'Profile',  Settings],
];

export default function AppShell() {
  // Which tab the current screen belongs to. A deep screen (a path, a guide, the
  // week) keeps its tab lit rather than lighting nothing.
  const { pathname } = useLocation();
  const activeTab = tabOf(pathname);

  return (
    // The landing page's paper, not the cooler grey the app used to sit on: the
    // two surfaces were a few points apart in hue, which is the amount that
    // reads as a different site rather than a deliberate change.
    // MotionConfig mirrors the landing page — any transform in this tree is
    // neutered for anyone who has asked their OS for reduced motion.
    <MotionConfig reducedMotion="user">
    <div className="min-h-[100svh] font-body" style={{ background: 'var(--page-surface)' }}>
      <PilotTracker />
      {/* Each tab remembers the screen and the scroll offset it was left at. */}
      <TabScrollMemory />
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col lg:flex py-5 px-4" style={{ background: 'var(--brand-navy-900)' }}>
        <NavLink to="/journey" className="block -mx-5 px-5 py-3 mb-8 text-sm">
          <div className="flex items-center justify-center gap-0 font-heading font-bold text-white uppercase select-none" style={{ fontSize: '14px', letterSpacing: '0.20em' }}>
            <span>UNSCRIP</span>
            <CompassSVG />
            <span>ED</span>
          </div>
        </NavLink>

        <nav className="flex-1 overflow-y-auto">
          {NAV.map(([to, label, , Icon]) => {
            const isActive = activeTab === to;
            return (
              // Returning to a tab resumes it where it was left, not at its root.
              <NavLink key={to} to={isActive ? to : lastLocation(to)}
                className={`nav-link app-navlink tp-control mb-1 flex items-center gap-3 rounded-[var(--r-control)] px-4 py-3 ${isActive ? 'text-white' : 'text-[color:var(--ink-300)] hover:text-white'}`}
                style={isActive
                  ? { background: 'var(--brand-navy-700)', borderLeft: '3px solid var(--brand-gold-500)', paddingLeft: '13px' }
                  : { borderLeft: '3px solid transparent' }
                }>
                <Icon size={17} />
                {label}
              </NavLink>
            );
          })}
        </nav>

        <p className="tp-meta rounded-[var(--r-control)] p-3.5 text-[color:var(--ink-400)] mt-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          Write your unscripted path.
        </p>
        {/* Unsaved reflection drafts go with the session: they are a student's
            own words about how a week went and whether a path is working. On a
            library machine, leaving them is leaving private writing on a
            computer that belongs to nobody. */}
        <button onClick={() => { clearStudentDrafts(); base44.auth.logout('/'); }}
          className="mt-3 flex items-center gap-2 rounded-[var(--r-control)] px-4 py-2.5 text-sm font-medium text-[color:var(--ink-400)] transition hover:bg-white/5 hover:text-white">
          <LogOut size={15} /> Log out
        </button>
      </aside>

      {/* The bottom nav is as tall as its own bar plus whatever the phone
          reserves for the home indicator, so the page has to clear both or the
          last thing on every scrolling screen hides behind it. */}
      {/* Where you are in the cycle, on every screen: a column on a wide
          display, a collapsible strip above the content on a narrow one. */}
      <CycleRailColumn />

      <main className="pb-[calc(6rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:ml-60 lg:pb-0 xl:mr-64">
        <CycleRailStrip />
        {/* Screens arrive the way the landing fold does, once per route. */}
        <RouteTransition>
          <Outlet />
        </RouteTransition>
      </main>

      {/* Mobile bottom nav — same four destinations, touch-sized. The side
          insets only do anything in landscape, where the notch eats into one
          end of a full-bleed bar. */}
      {/* Translucent paper over a blur, the same treatment the landing nav
          condenses into, rather than a flat white bar. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t lg:hidden"
        style={{
          background: 'rgba(250,250,249,0.86)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: 'var(--border-light)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}>
        {NAV.map(([to, , shortLabel, Icon]) => {
          const isActive = activeTab === to;
          return (
            // Tapping a tab resumes its own stack: the screen it was left on,
            // at the offset it was left at. Tapping the tab you are already in
            // returns to its root, the way a native tab bar does.
            <NavLink key={to} to={isActive ? to : lastLocation(to)}
              className={`nav-link tp-meta flex flex-1 flex-col items-center justify-center gap-1 py-2.5 font-semibold ${isActive ? '' : 'text-[color:var(--ink-400)]'}`}
              style={{ minHeight: '56px', ...(isActive ? { color: 'var(--brand-navy-900)' } : {}) }}>
              <Icon size={20} />
              {shortLabel}
            </NavLink>
          );
        })}
      </nav>
    </div>
    </MotionConfig>
  );
}