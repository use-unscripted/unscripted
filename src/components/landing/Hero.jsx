import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const tasks = [
  'Tuesday · Build your first public project',
  'Wednesday · Send five founder messages',
  'Friday · Publish a reflection',
];

export default function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl gap-14 px-6 pb-28 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:pt-24">
      {/* Left */}
      <div className="flex flex-col justify-center">
        <div
          className="mb-7 inline-flex w-fit rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[.08em]"
          style={{ background: '#F8ECEF', border: '1px solid rgba(139,12,33,0.25)', color: '#8B0C21' }}
        >
          Your life was never meant to follow a script
        </div>
        <h1 className="font-heading max-w-2xl text-[3.2rem] font-extrabold leading-[1.03] tracking-[-0.03em] text-[#050816] sm:text-[4.2rem]">
          The real-world curriculum for students building their own path.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[#334155] font-body">
          Unscripted helps college students turn their goals, schedule, interests, and ambition into a personalized roadmap for careers, startups, personal brands, and real-world growth.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            to="/register"
            className="flex items-center gap-2 rounded-[10px] px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-px"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}
          >
            Build My Roadmap <ArrowRight size={17} />
          </Link>
          <Link
            to="/register"
            className="rounded-[10px] border border-[#E2E8F0] bg-white px-6 py-3.5 text-sm font-semibold text-[#050816] transition hover:bg-[#FCF6F7]"
            style={{ ':hover': { borderColor: 'rgba(139,12,33,0.35)' } }}
          >
            Join the Beta
          </Link>
        </div>
      </div>

      {/* Right — Profile Card */}
      <div
        className="relative rounded-[20px] p-7 text-white"
        style={{
          background: '#081225',
          border: '1px solid rgba(139,12,33,0.35)',
          boxShadow: '0 28px 70px rgba(5,8,22,0.20)',
        }}
      >
        <div className="mb-8 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Your Unscripted Profile</span>
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: '#15803D' }}>
            High agency
          </span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em]" style={{ color: '#8B0C21' }}>Path Archetype</p>
        <h2 className="font-heading mt-2 text-3xl font-bold">Strategic Builder</h2>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          Use your current path as a credibility base while building proof of work, a public voice, and opportunities beyond the traditional route.
        </p>
        <div className="mt-8 space-y-3">
          {tasks.map(x => (
            <div
              key={x}
              className="flex items-center gap-3 rounded-xl p-4 text-sm"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <CheckCircle2 size={17} className="shrink-0" style={{ color: '#8B0C21' }} />
              {x}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}