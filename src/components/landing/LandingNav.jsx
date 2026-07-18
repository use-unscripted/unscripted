import { Link } from 'react-router-dom';
import { LogoWordmark } from '@/components/UnscriptedLogo';

export default function LandingNav() {
  return (
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
      <LogoWordmark />
      <div className="hidden items-center gap-6 sm:flex">
        <a href="#how-it-works" className="text-sm font-semibold text-[#334155] hover:text-[#050816] transition">How It Works</a>
        <Link to="/login" className="text-sm font-semibold text-[#334155] hover:text-[#050816] transition">Log in</Link>
      </div>
      <Link to="/register"
        className="rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px"
        style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
        Start My 30-Day Path Test
      </Link>
    </nav>
  );
}