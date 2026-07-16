import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, CalendarDays, Archive, Settings, BookOpen } from 'lucide-react';

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
    <div className="min-h-screen font-body" style={{ background: '#F8FAFC' }}>
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col p-6 text-white lg:flex"
        style={{ background: '#061226' }}
      >
        {/* Logo */}
        <NavLink to="/dashboard" className="mb-10 flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)' }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" fill="none" />
              <path d="M8 4L11 5.75V9.25L8 11L5 9.25V5.75L8 4Z" fill="white" />
            </svg>
          </span>
          <span className="font-heading text-lg font-bold text-white">AmbitionOS</span>
        </NavLink>

        {/* Nav */}
        <nav className="space-y-1">
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
                  ? { background: 'linear-gradient(135deg, rgba(37,99,235,0.35) 0%, rgba(124,58,237,0.25) 100%)', border: '1px solid rgba(37,99,235,0.3)' }
                  : {}
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <p className="mt-auto rounded-2xl p-4 text-xs leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          Build proof. Create leverage. Choose your path.
        </p>
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
                isActive ? 'text-[#2563EB]' : 'text-[#64748B]'
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