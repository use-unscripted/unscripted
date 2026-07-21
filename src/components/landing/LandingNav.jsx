import { Link } from 'react-router-dom';
import { LogoFull } from '@/components/UnscriptedLogo';

export default function LandingNav() {
  return (
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
      <LogoFull height={36} />
      <div className="hidden items-center gap-6 sm:flex">
        <a href="#how-it-works" className="text-sm font-semibold transition" style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
          How It Works
        </a>
        <Link to="/login" className="text-sm font-semibold transition" style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
          Log in
        </Link>
      </div>
      <Link to="/onboarding"
        className="rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px"
        style={{ background: 'var(--brand-navy-900)', boxShadow: '0 6px 20px rgba(31,58,95,0.25)' }}>
        Start My 30-Day Path Test
      </Link>
    </nav>
  );
}