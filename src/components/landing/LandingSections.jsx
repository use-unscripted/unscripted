import { Compass, Route, CalendarCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CompassIcon } from '@/components/UnscriptedLogo';

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
  { Icon: Compass, title: 'Define your direction', body: 'Tell us what you actually want—not only what your major or current path expects.' },
  { Icon: Route, title: 'Build your roadmap', body: 'Receive your personalized profile, 30-day plan, semester roadmap, and recommended path.' },
  { Icon: CalendarCheck, title: 'Execute each week', body: 'Follow a realistic plan built around your classes, commitments, energy, and available time.' },
];

export default function LandingSections() {
  return (
    <>
      {/* Dark problem/solution */}
      <section className="px-6 py-28" style={{ background: '#081225' }}>
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>The default script</p>
            <h2 className="font-heading mt-5 text-4xl font-bold leading-tight tracking-tight text-white lg:text-5xl">
              College gives you a syllabus. Not a strategy for your life.
            </h2>
            <p className="mt-6 leading-7 text-slate-400">
              Majors and expected career paths can box students in. Classes rarely teach networking, personal branding, proof of work, startup access, opportunity creation, or how to build leverage.
            </p>
          </div>
          <div
            className="rounded-[20px] p-8"
            style={{
              background: '#111D33',
              border: '1px solid rgba(139,12,33,0.30)',
            }}
          >
            <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>The Unscripted path</p>
            <h3 className="font-heading mt-4 text-2xl font-bold text-white">
              Reverse-engineer who you want to become.
            </h3>
            <p className="mt-4 leading-7 text-slate-300">
              Unscripted turns your goals, schedule, constraints, and interests into a concrete roadmap for your career, skills, habits, network, personal brand, and next move.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-6 py-28">
        <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>How it works</p>
        <h2 className="font-heading mt-3 text-4xl font-bold tracking-tight text-[#050816]">
          From uncertainty to weekly action.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {howItWorks.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="group rounded-[18px] border border-[#E2E8F0] bg-white p-8 transition hover:-translate-y-1 hover:shadow-md"
              style={{ '--hover-border': 'rgba(139,12,33,0.25)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(139,12,33,0.25)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
            >
              <div
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{ background: '#F8ECEF' }}
              >
                <Icon size={22} style={{ color: '#8B0C21' }} />
              </div>
              <h3 className="font-heading mt-7 text-xl font-bold text-[#050816]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#334155]">{body}</p>
            </div>
          ))}
        </div>

        {/* Built for more than one path */}
        <div className="mt-24 rounded-[24px] p-10 sm:p-14" style={{ background: '#FCF6F7' }}>
          <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>Built for more than one path</p>
          <h2 className="font-heading mt-3 text-3xl font-bold text-[#050816]">Whatever direction you're building toward.</h2>
          <div className="mt-9 flex flex-wrap gap-3">
            {uses.map(x => (
              <div
                key={x}
                className="rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition cursor-default hover:border-[rgba(139,12,33,0.35)] hover:text-[#8B0C21]"
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
          style={{ background: '#8B0C21' }}
        >
          <h2 className="font-heading mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Stop following a path you never chose. Build your own.
          </h2>
          <Link
            to="/register"
            className="mt-10 inline-flex items-center gap-2 rounded-[10px] bg-white px-7 py-4 text-sm font-semibold transition hover:-translate-y-px hover:shadow-xl"
            style={{ color: '#050816', boxShadow: '0 4px 16px rgba(5,8,22,0.12)' }}
          >
            Build My Roadmap <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}