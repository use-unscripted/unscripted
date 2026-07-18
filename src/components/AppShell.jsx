import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Beaker, CalendarDays, Users, FileText, RotateCcw, Settings, LogOut, Target } from 'lucide-react';
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
  ['/proof', 'Proof of Work', FileText],
  ['/reflection', 'Reflect', RotateCcw],
];

function NavGroup({ label, links }) {
  return (
    <div className="mb-4">
      <p className="mb-1 px-4 text-[10px] font-bold uppercase tracking-[.12em] text-slate-600">{label}</p>
      {links.map(([to, label, Icon]) => (
        <NavLink key={to} to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${isActive ? 'text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`
          }
          style={({ isActive }) => isActive ? { background: 'rgba(139,12,33,0.30)', border: '1px solid rgba(139,12,33,0.40)' } : {}}>
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
    <div className="min-h-screen font-body" style={{ background: '#FAFAF9' }}>
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col p-5 lg:flex" style={{ background: '#081225' }}>
        <NavLink to="/dashboard" className="mb-8 block">
          <div className="flex items-center gap-2.5">
            <CompassIcon size={20} />
            <span className="font-heading text-base font-bold tracking-tight text-white">Unscripted</span>
          </div>
        </NavLink>

        <nav className="flex-1 overflow-y-auto">
          <NavGroup label="Path Test" links={coreLinks} />
          <NavGroup label="Build Evidence" links={buildLinks} />
          <NavGroup label="Account" links={[['/settings', 'Settings', Settings]]} />
        </nav>

        <p className="rounded-xl p-3 text-xs leading-5 text-slate-500 mt-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          Write your unscripted path.
        </p>
        <button onClick={() => base44.auth.logout('/')}
          className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-white/5 hover:text-white">
          <LogOut size={15} /> Log out
        </button>
      </aside>

      <main className="pb-20 lg:ml-60 lg:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-[#E2E8F0] bg-white px-2 py-2 lg:hidden">
        {mobileLinks.map(([to, label, Icon]) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold transition ${isActive ? 'text-[#8B0C21]' : 'text-[#64748B]'}`
            }>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}