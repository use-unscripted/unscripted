import { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Compass, CalendarDays, FolderOpen, FileText, Settings, LogOut, BarChart3, Inbox } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { listFeedSubmissions } from '@/lib/campus-events';
import { clearCampusStore } from '@/lib/campus-store';
import PilotTracker from '@/components/PilotTracker';
import { loadPilotAccess } from '@/lib/pilot-access';

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
 * Five destinations, one journey. Deep screens (paths, missions, week, guides)
 * are reached from inside My Journey rather than competing with it in the nav.
 *
 * The campus calendar is the exception, and it earns the slot: it is the only
 * screen in the product with dates on it that the student did not choose, and
 * it was reachable only from a link inside the dashboard, so a student who
 * scrolled past that link had no way back to it at all.
 */
const NAV = [
  ['/journey',  'My Journey',        'Journey',  Compass],
  ['/campus',   'On campus',         'Campus',   CalendarDays],
  ['/evidence', 'Evidence',          'Evidence', FolderOpen],
  ['/resume',   'Resume',            'Resume',   FileText],
  ['/settings', 'Profile & Settings', 'Profile',  Settings],
];

export default function AppShell() {
  // Pilot reporting is an admin destination, so the link only exists for admins.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { loadPilotAccess().then(a => setIsAdmin(!!a.isAdmin)).catch(() => setIsAdmin(false)); }, []);

  // Calendar links students have sent us that nobody has looked at yet.
  //
  // The count is the point. A student can paste a working link, get their own
  // events, and have the row sit unreviewed forever — their school never gets
  // switched on and nobody finds out. A queue nobody remembers to open is the
  // same as no queue, so the number goes where the team already looks. Silent
  // for everyone else, and silent when there is nothing waiting.
  const [pendingFeeds, setPendingFeeds] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    listFeedSubmissions()
      .then(rows => {
        if (cancelled) return;
        setPendingFeeds(rows.filter(r => r.resolution === 'resolved' && r.review_status === 'pending').length);
      })
      .catch(() => {}); // A nav badge is never worth an error on someone's screen.
    return () => { cancelled = true; };
  }, [isAdmin]);

  return (
    <div className="min-h-screen font-body" style={{ background: 'var(--background-secondary)' }}>
      <PilotTracker />
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
          {NAV.map(([to, label, , Icon]) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `nav-link mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${isActive ? 'text-white' : 'text-[color:var(--ink-300)] hover:text-white'}`
              }
              style={({ isActive }) => isActive
                ? { background: 'var(--brand-navy-700)', borderLeft: '3px solid var(--brand-gold-500)', paddingLeft: '13px' }
                : { borderLeft: '3px solid transparent' }
              }>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/pilot"
              className={({ isActive }) =>
                `nav-link mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${isActive ? 'text-white' : 'text-[color:var(--ink-300)] hover:text-white'}`
              }
              style={({ isActive }) => isActive
                ? { background: 'var(--brand-navy-700)', borderLeft: '3px solid var(--brand-gold-500)', paddingLeft: '13px' }
                : { borderLeft: '3px solid transparent' }
              }>
              <BarChart3 size={17} />
              Pilot report
            </NavLink>
          )}
          {isAdmin && pendingFeeds > 0 && (
            <NavLink to="/admin/campus-feeds"
              className={({ isActive }) =>
                `nav-link mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${isActive ? 'text-white' : 'text-[color:var(--ink-300)] hover:text-white'}`
              }
              style={({ isActive }) => isActive
                ? { background: 'var(--brand-navy-700)', borderLeft: '3px solid var(--brand-gold-500)', paddingLeft: '13px' }
                : { borderLeft: '3px solid transparent' }
              }>
              <Inbox size={17} />
              Campus feeds · {pendingFeeds}
            </NavLink>
          )}
        </nav>

        <p className="tp-meta rounded-xl p-3.5 text-[color:var(--ink-400)] mt-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          Write your unscripted path.
        </p>
        {/* The stored calendar goes with the session. It is public listings
            rather than anything private, but it names a school, and the next
            person to sign in on this browser is not owed someone else's. */}
        <button onClick={() => { clearCampusStore(); base44.auth.logout('/'); }}
          className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-[color:var(--ink-400)] transition hover:bg-white/5 hover:text-white">
          <LogOut size={15} /> Log out
        </button>
      </aside>

      <main className="pb-24 lg:ml-60 lg:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav — same four destinations, touch-sized */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-white lg:hidden"
        style={{ borderColor: 'var(--border-light)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(([to, , shortLabel, Icon]) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `nav-link tp-meta flex flex-1 flex-col items-center justify-center gap-1 py-2.5 font-semibold ${isActive ? '' : 'text-[color:var(--ink-400)]'}`
            }
            style={({ isActive }) => ({ minHeight: '56px', ...(isActive ? { color: 'var(--brand-navy-900)' } : {}) })}>
            <Icon size={20} />
            {shortLabel}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}