import { Compass, Route, CalendarCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const uses = [
  'Build a personal brand',
  'Join a startup',
  'Start a side project',
  'Choose a career path',
  'Create a networking plan',
  'Build real-world skills',
  'Balance ambition and wellness',
  'Escape the default path',
];

const howItWorks = [
  { Icon: Compass, title: 'Define your direction', body: 'Tell us what you want — not just what your major expects.' },
  { Icon: Route, title: 'Get your roadmap', body: 'Receive your Ambition Profile plus 30-day and semester plans.' },
  { Icon: CalendarCheck, title: 'Execute each week', body: 'Work a realistic plan around your actual classes, energy, and commitments.' },
];

export default function LandingSections() {
  return (
    <>
      {/* Dark problem/solution */}
      <section className="px-6 py-28" style={{ background: '#061226' }}>
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#22D3EE]">The problem</p>
            <h2 className="font-heading mt-5 text-4xl font-bold leading-tight tracking-tight text-white lg:text-5xl">
              College gives you a syllabus. Not a strategy for your life.
            </h2>
            <p className="mt-6 leading-7 text-slate-400">
              Majors and expected career paths can box students in. Classes rarely teach networking, personal branding, proof of work, startup access, or how to build leverage.
            </p>
          </div>
          <div
            className="rounded-[22px] p-8"
            style={{
              background: '#0F1E36',
              border: '1px solid rgba(34,211,238,0.18)',
              boxShadow: '0 20px 50px rgba(37,99,235,0.15)',
            }}
          >
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#22D3EE]">The solution</p>
            <h3 className="font-heading mt-4 text-2xl font-bold text-white">
              Reverse-engineer who you want to become.
            </h3>
            <p className="mt-4 leading-7 text-slate-300">
              AmbitionOS turns your goals, constraints, and schedule into a concrete roadmap for your career, skills, habits, network, and next move.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-6 py-28">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2563EB]">How it works</p>
        <h2 className="font-heading mt-3 text-4xl font-bold tracking-tight text-[#07111F]">
          From uncertainty to weekly action.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {howItWorks.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="group rounded-[20px] border border-[#E2E8F0] bg-white p-8 transition hover:-translate-y-1 hover:border-[#BFDBFE] hover:shadow-lg"
            >
              <div
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{ background: 'linear-gradient(135deg, #EFF6FF, #F5F3FF)' }}
              >
                <Icon size={22} className="text-[#2563EB]" />
              </div>
              <h3 className="font-heading mt-7 text-xl font-bold text-[#07111F]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#334155]">{body}</p>
            </div>
          ))}
        </div>

        {/* Built for more than one path */}
        <div className="mt-24 rounded-[24px] p-10 sm:p-14" style={{ background: '#EEF2F7' }}>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#7C3AED]">Built for more than one path</p>
          <h2 className="font-heading mt-3 text-3xl font-bold text-[#07111F]">Whatever direction you're building toward.</h2>
          <div className="mt-9 flex flex-wrap gap-3">
            {uses.map(x => (
              <div
                key={x}
                className="rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:border-[#BFDBFE] hover:text-[#2563EB]"
              >
                {x}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-28">
        <div
          className="mx-auto max-w-7xl rounded-[24px] px-8 py-20 text-center text-white"
          style={{
            background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 65%, #22D3EE 100%)',
            boxShadow: '0 30px 80px rgba(37,99,235,0.3)',
          }}
        >
          <h2 className="font-heading mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Stop following a path you never chose. Build your own operating system.
          </h2>
          <Link
            to="/register"
            className="mt-10 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 font-semibold text-[#07111F] transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Build My Roadmap <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}