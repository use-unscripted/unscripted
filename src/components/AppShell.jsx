import { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Beaker, CalendarDays, Users, FileText, RotateCcw, Settings, LogOut, Target, BookOpen, Inbox } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { listFeedSubmissions } from '@/lib/campus-events';
import { CompassIcon } from '@/components/UnscriptedLogo';

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

const coreLinks = [
['/dashboard', 'Dashboard', LayoutDashboard],
['/experiments', 'Missions', Beaker],
['/calendar', 'Week', CalendarDays],
['/paths', 'Paths', Target]];


const buildLinks = [
['/outreach', 'Outreach', Users],
['/proof', 'Proof', FileText],
['/reflection', 'Reflect', RotateCcw],
['/resume', 'Resume', BookOpen]];


function NavGroup({ label, links }) {
  return (
    <div className="mb-4">
      <p className="mb-1 px-4 text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--brand-gold-500)' }}>{label}</p>
      {links.map(([to, label, Icon]) =>
      <NavLink key={to} to={to}
      className={({ isActive }) =>
      `nav-link flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-300 hover:text-white'}`
      }
      style={({ isActive }) => isActive ?
      { background: 'var(--brand-navy-700)', borderLeft: '3px solid var(--brand-gold-500)', paddingLeft: '13px' } :
      { borderLeft: '3px solid transparent' }
      }>
          <Icon size={16} />
          {label}
        </NavLink>
      )}
    </div>);

}

const mobileLinks = [
['/dashboard', 'Home', LayoutDashboard],
['/experiments', 'Missions', Beaker],
['/calendar', 'Week', CalendarDays],
['/outreach', 'Outreach', Users],
['/proof', 'Portfolio', FileText]];


/**
 * The team's link to the campus-feed review queue, with what's waiting on it.
 *
 * The count is the point. A student can paste a working calendar link, get
 * their own events, and have the row sit unreviewed forever — their school
 * never gets switched on and nobody finds out. A page nobody remembers to open
 * is the same as no page, so the number has to be somewhere already looked at.
 *
 * Silent for everyone else, and silent for an admin with an empty queue.
 */
function ReviewQueueLink() {
  const { user } = useAuth();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let cancelled = false;
    listFeedSubmissions()
      .then(rows => {
        if (cancelled) return;
        setPending(rows.filter(r => r.resolution === 'resolved' && r.review_status === 'pending').length);
      })
      .catch(() => {}); // A nav badge is never worth an error on someone's screen.
    return () => { cancelled = true; };
  }, [user?.role]);

  if (user?.role !== 'admin' || pending === 0) return null;

  return (
    <NavGroup label="Team" links={[['/admin/campus-feeds', `Campus feeds · ${pending}`, Inbox]]} />
  );
}

export default function AppShell() {
  return (
    <div className="min-h-screen font-body" style={{ background: 'var(--background-secondary)' }}>
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col lg:flex py-5 px-4" style={{ background: 'var(--brand-navy-900)' }}>
        <NavLink to="/dashboard" className="block -mx-5 px-5 py-3 mb-8 text-sm">
          <div className="flex items-center justify-center gap-0 font-heading font-bold text-white uppercase select-none" style={{ fontSize: '14px', letterSpacing: '0.20em' }}>
            <span>UNSCRIP</span>
            <CompassSVG />
            <span>ED</span>
          </div>
        </NavLink>

        <nav className="flex-1 overflow-y-auto">
          <NavGroup label="Path Test" links={coreLinks} />
          <NavGroup label="Build Evidence" links={buildLinks} />
          <NavGroup label="Account" links={[['/settings', 'Settings', Settings]]} />
          <ReviewQueueLink />
        </nav>

        <p className="rounded-xl p-3 text-xs leading-5 text-slate-400 mt-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          Write your unscripted path.
        </p>
        <button onClick={() => base44.auth.logout('/')}
        className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white">
          <LogOut size={15} /> Log out
        </button>
      </aside>

      <main className="pb-20 lg:ml-60 lg:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t bg-white px-2 py-2 lg:hidden" style={{ borderColor: 'var(--border-light)' }}>
        {mobileLinks.map(([to, label, Icon]) =>
        <NavLink key={to} to={to}
        className={({ isActive }) =>
        `nav-link flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold ${isActive ? '' : 'text-slate-400'}`
        }
        style={({ isActive }) => isActive ? { color: 'var(--brand-navy-900)' } : {}}>
            <Icon size={18} />
            {label}
          </NavLink>
        )}
      </nav>
    </div>);

}