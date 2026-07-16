import { Link } from 'react-router-dom';

export default function LandingNav() {
  return (
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M8 4L11 5.75V9.25L8 11L5 9.25V5.75L8 4Z" fill="white"/>
          </svg>
        </span>
        <span className="font-heading text-lg font-bold text-[#07111F]">AmbitionOS</span>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/login" className="hidden text-sm font-semibold text-[#334155] sm:block hover:text-[#07111F] transition">Log in</Link>
        <Link
          to="/register"
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', boxShadow: '0 12px 30px rgba(37,99,235,0.28)' }}
        >
          Build My Roadmap
        </Link>
      </div>
    </nav>
  );
}