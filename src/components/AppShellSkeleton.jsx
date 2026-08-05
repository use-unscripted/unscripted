/**
 * What you look at while the app decides who you are.
 *
 * This used to be a spinner alone in the middle of a white screen: the sidebar,
 * the nav, the page and its content all arrived at once, several hundred
 * milliseconds later, as one hard cut. Standing the shell up first means the
 * furniture is already where it belongs and only the content fills in.
 *
 * The sidebar here is a stand-in, not the real one — deliberately. Importing
 * AppShell would drag its data fetches into the gate, and this renders before
 * we know whether the visitor is even signed in.
 */
import { Sk, SkHeader, SkCards } from '@/components/PageSkeleton';

/** Routes that live inside the signed-in shell, so the shell is worth drawing. */
const SHELL_ROUTES = [
  '/journey', '/evidence', '/roadmap', '/calendar', '/saved', '/settings',
  '/blueprints', '/paths', '/experiment', '/reflect', '/experiments',
  '/resources', '/creators', '/goals-tracker', '/resume', '/recently-deleted',
  '/guide', '/pilot', '/admin', '/dashboard', '/outreach', '/proof', '/reflection',
];

export function isShellRoute(pathname) {
  return SHELL_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));
}

export default function AppShellSkeleton() {
  return (
    <div className="min-h-[100svh] font-body" style={{ background: 'var(--background-secondary)' }}>
      {/* Sidebar — same width, same colour, same rhythm as the real one, so it
          does not redraw when the real nav takes over. */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col px-4 py-5 lg:flex"
        style={{ background: 'var(--brand-navy-900)' }}
        aria-hidden="true"
      >
        <div className="mb-8 flex h-11 items-center justify-center">
          <Sk h={13} w={132} r={4} style={{ opacity: 0.22 }} />
        </div>
        <nav className="flex-1">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="mb-1 flex items-center gap-3 rounded-xl px-4 py-3">
              <Sk h={17} w={17} r={5} style={{ opacity: 0.18 }} />
              <Sk h={12} w={i === 3 ? 122 : 88} r={4} style={{ opacity: 0.18 }} />
            </div>
          ))}
        </nav>
      </aside>

      <main className="pb-[calc(6rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:ml-60 lg:pb-0">
        <div className="app-page">
          <SkHeader />
          <SkCards count={3} h={152} r={20} />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-white lg:hidden"
        style={{
          borderColor: 'var(--border-light)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex flex-1 flex-col items-center justify-center gap-1.5 py-2.5" style={{ minHeight: 56 }}>
            <Sk h={20} w={20} r={6} />
            <Sk h={9} w={44} r={3} />
          </div>
        ))}
      </nav>
    </div>
  );
}
