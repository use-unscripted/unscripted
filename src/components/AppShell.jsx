import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, CalendarDays, Archive, Settings, BookOpen, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { LogoWordmark, CompassIcon } from '@/components/UnscriptedLogo';

const links = [
  ['/dashboard', 'Today', LayoutDashboard],
  ['/roadmap', 'Roadmap', Map],
  ['/calendar', 'Week', CalendarDays],
  ['/blueprints', 'Blueprints', BookOpen],
  ['/saved', 'History', Archive],
  ['/settings', 'Profile', Settings],
];

export default function AppShell() {
  return (
    <div className="min-h-screen font-body" style={{ background: '#FAFAF9' }}>
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col p-6 text-white lg:flex"
        style={{ background: '#081225' }}
      >
        {/* Logo */}
        <NavLink to="/dashboard" className="mb-10 block">
          <div className="flex items-center gap-2.5">
            <CompassIcon size={22} />
            <span className="font-heading text-lg font-bold tracking-tight text-white">Unscripted</span>
          </div>
        </NavLink>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {links.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? { background: 'rgba(139,12,33,0.30)', border: '1px solid rgba(139,12,33,0.40)' }
                  : {}
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <p className="rounded-2xl p-4 text-xs leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          Build your own path.
        </p>
        <button
          onClick={() => base44.auth.logout('/')}
          className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-white/5 hover:text-white"
        >
          <LogOut size={16} /> Log out
        </button>
      </aside>

      {/* Main */}
      <main className="pb-24 lg:ml-64 lg:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-[#E2E8F0] bg-white px-2 py-2 lg:hidden">
        {links.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-2 py-1 text-[10px] font-semibold transition ${
                isActive ? 'text-[#8B0C21]' : 'text-[#64748B]'
              }`
            }
          >
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}