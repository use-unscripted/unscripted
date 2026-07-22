import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Beaker, CalendarDays, Users, FileText, RotateCcw, Settings, LogOut, Target, BookOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { CompassIcon } from '@/components/UnscriptedLogo';

const coreLinks = [
  ['/dashboard', 'Dashboard', LayoutDashboard],
  ['/experiments', 'Missions', Beaker],
  ['/calendar', 'Week', CalendarDays],
  ['/paths', 'Paths', Target],
];

const buildLinks = [
  ['/outreach', 'Outreach', Users],
  ['/proof', 'Proof', FileText],
  ['/reflection', 'Reflect', RotateCcw],
  ['/resume', 'Resume', BookOpen],
];

function NavGroup({ label, links }) {
  return (
    <div className="mb-4">
      <p className="mb-1 px-4 text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--brand-gold-500)' }}>{label}</p>
      {links.map(([to, label, Icon]) => (
        <NavLink key={to} to={to}
          className={({ isActive }) =>
            `nav-link flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-300 hover:text-white'}`
          }
          style={({ isActive }) => isActive
            ? { background: 'var(--brand-navy-700)', borderLeft: '3px solid var(--brand-gold-500)', paddingLeft: '13px' }
            : { borderLeft: '3px solid transparent' }
          }>
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </div>
  );
}

const mobileLinks = [
  ['/dashboard', 'Home', LayoutDashboard],
  ['/experiments', 'Missions', Beaker],
  ['/calendar', 'Week', CalendarDays],
  ['/outreach', 'Outreach', Users],
  ['/proof', 'Portfolio', FileText],
];

export default function AppShell() {
  return (
    <div className="min-h-screen font-body" style={{ background: 'var(--background-secondary)' }}>
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col p-5 lg:flex" style={{ background: 'var(--brand-navy-900)' }}>
        <NavLink to="/dashboard" className="mb-8 block -mx-5 px-5 py-3">
          <div className="flex items-center justify-center gap-0 font-heading font-bold text-white uppercase select-none" style={{ fontSize: '14px', letterSpacing: '0.20em' }}>
            <span>UNSCRIP</span>
            {/* Compass star as the "T" */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mx-0.5 shrink-0" style={{ marginTop: '-1px' }}>
              <path d="M12 2 L13.2 10.8 L22 12 L13.2 13.2 L12 22 L10.8 13.2 L2 12 L10.8 10.8 Z" fill="var(--brand-gold-500)" />
            </svg>
            <span>ED</span>
          </div>
        </NavLink>

        <nav className="flex-1 overflow-y-auto">
          <NavGroup label="Path Test" links={coreLinks} />
          <NavGroup label="Build Evidence" links={buildLinks} />
          <NavGroup label="Account" links={[['/settings', 'Settings', Settings]]} />
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
        {mobileLinks.map(([to, label, Icon]) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `nav-link flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold ${isActive ? '' : 'text-slate-400'}`
            }
            style={({ isActive }) => isActive ? { color: 'var(--brand-navy-900)' } : {}}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}