import { Link } from 'react-router-dom';
import { LogoWordmark } from '@/components/UnscriptedLogo';

export default function LandingNav() {
  return (
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
      <LogoWordmark />
      <div className="flex items-center gap-3">
        <Link
          to="/login"
          className="hidden text-sm font-semibold text-[#334155] sm:block hover:text-[#050816] transition"
        >
          Log in
        </Link>
        <Link
          to="/register"
          className="rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px"
          style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}
        >
          Build My Roadmap
        </Link>
      </div>
    </nav>
  );
}