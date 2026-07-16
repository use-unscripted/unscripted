import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
// Hero is only shown to guests (Landing redirects authed users away)
// so all CTAs safely point to /register

const tasks = [
  'Tuesday · Build first public project',
  'Wednesday · Send 5 founder messages',
  'Friday · Publish a reflection',
];

export default function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl gap-14 px-6 pb-28 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:pt-24">
      {/* Left */}
      <div className="flex flex-col justify-center">
        <div
          className="mb-7 inline-flex w-fit rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[.08em] text-[#2563EB]"
          style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}
        >
          Your ambition deserves a system
        </div>
        <h1 className="font-heading max-w-2xl text-[3.4rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-[#07111F] sm:text-[4.5rem]">
          The real-world curriculum for ambitious students.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[#334155] font-body">
          AmbitionOS helps college students figure out the life they actually want, then builds a personalized weekly roadmap around their schedule, career goals, personal brand, startup interests, habits, and real-world ambitions.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            to="/register"
            className="flex items-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', boxShadow: '0 12px 30px rgba(37,99,235,0.28)' }}
          >
            Build My Roadmap <ArrowRight size={17} />
          </Link>
          <Link
            to="/register"
            className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-3.5 font-semibold text-[#07111F] transition hover:bg-[#EFF6FF] hover:border-[#BFDBFE]"
          >
            Join the Beta
          </Link>
        </div>
      </div>

      {/* Right — Profile Card */}
      <div
        className="relative rounded-[22px] p-7 text-white"
        style={{
          background: 'linear-gradient(145deg, #0F1E36 0%, #061226 100%)',
          border: '1px solid rgba(34,211,238,0.18)',
          boxShadow: '0 30px 80px rgba(37,99,235,0.22)',
        }}
      >
        <div className="mb-8 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Your Ambition Profile</span>
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: '#10B981' }}>
            High agency
          </span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#22D3EE]">Archetype</p>
        <h2 className="font-heading mt-2 text-3xl font-bold">Strategic Builder</h2>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          Use your current path as a credibility base while building proof of work, public voice, and real-world leverage.
        </p>
        <div className="mt-8 space-y-3">
          {tasks.map(x => (
            <div
              key={x}
              className="flex items-center gap-3 rounded-xl p-4 text-sm"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <CheckCircle2 size={17} className="shrink-0 text-[#22D3EE]" />
              {x}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}