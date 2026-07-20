import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const steps = [
  { n: '01', title: 'Compare realistic paths', body: 'See honest tradeoffs, lifestyle implications, and fit signals for 3 paths matched to your profile.' },
  { n: '02', title: 'Run guided experiments', body: 'Complete structured real-world missions — interviews, simulations, and proof-of-work outputs.' },
  { n: '03', title: 'Execute around your schedule', body: 'Your experiments are scheduled around your actual classes, work, and commitments.' },
  { n: '04', title: 'Reflect and adjust', body: 'Weekly reflections update your path assessment based on what you actually experienced.' },
];

export default function Hero() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex w-fit rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[.1em]"
            style={{ background: '#F8ECEF', border: '1px solid rgba(139,12,33,0.25)', color: '#8B0C21' }}>
            Write your own path
          </div>
          <h1 className="font-heading text-[3rem] font-extrabold leading-[1.04] tracking-[-0.03em] text-[#050816] sm:text-[4rem]">
            Don't guess your next path. Test it.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#334155] font-body">
            Unscripted helps college students compare realistic career and life paths, complete guided real-world experiments, and learn what actually fits — before making a major commitment.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/onboarding"
              className="flex items-center gap-2 rounded-[10px] px-7 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-px"
              style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
              Start My 30-Day Path Test <ArrowRight size={17} />
            </Link>
            <a href="#how-it-works"
              className="rounded-[10px] border border-[#E2E8F0] bg-white px-7 py-3.5 text-sm font-semibold text-[#050816] transition hover:bg-[#FCF6F7]">
              See How It Works
            </a>
          </div>
          <p className="mt-4 text-sm text-[#64748B]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold underline" style={{ color: '#8B0C21' }}>Log in</Link>
          </p>
        </div>
      </section>

      {/* 4-step process */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ n, title, body }) => (
            <div key={n} className="rounded-[18px] border border-[#E2E8F0] bg-white p-6">
              <span className="font-heading text-3xl font-bold" style={{ color: 'rgba(139,12,33,0.15)' }}>{n}</span>
              <h3 className="font-heading mt-3 text-base font-bold text-[#050816]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#334155]">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}