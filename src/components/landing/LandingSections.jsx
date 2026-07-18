import { Target, Route, CalendarCheck, ArrowRight, RotateCcw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

const uses = [
  'Build a personal brand', 'Join a startup', 'Start a side project',
  'Choose a career path', 'Create a networking plan', 'Build real-world skills',
  'Balance ambition and wellness', 'Escape the default path',
];

const howItWorks = [
  { Icon: Search, step: '01', title: 'Understand yourself', body: 'Identify your goals, priorities, pressures, interests, desired lifestyle, and practical constraints.' },
  { Icon: Route, step: '02', title: 'Compare paths', body: 'Review three to five realistic paths with honest tradeoffs, requirements, lifestyle implications, and examples.' },
  { Icon: Target, step: '03', title: 'Test them', body: 'Complete guided missions — interview a professional, create a project, publish work, or complete a simulation.' },
  { Icon: CalendarCheck, step: '04', title: 'Build your week', body: 'Fit those missions around your actual classes, work, clubs, athletics, energy, and available time.' },
  { Icon: RotateCcw, step: '05', title: 'Learn and adapt', body: 'Reflect on what gave you energy, what felt wrong, what you completed, and what should change next.' },
];

export default function LandingSections() {
  return (
    <>
      {/* Differentiation */}
      <section className="px-6 py-20" style={{ background: '#FAFAF9', borderTop: '1px solid #E2E8F0' }}>
        <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] mb-4" style={{ color: '#8B0C21' }}>What makes Unscripted different</p>
            <h2 className="font-heading text-4xl font-bold text-[#050816] leading-tight">Most platforms help after you choose a path.</h2>
          </div>
          <div>
            <p className="text-[#334155] leading-7">
              Unscripted helps you determine which paths are worth choosing in the first place. Then it gives you the experiments, instructions, resources, and weekly plan needed to test them in the real world.
            </p>
          </div>
        </div>
      </section>

      {/* Dark problem/solution */}
      <section className="px-6 py-28" style={{ background: '#081225' }}>
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] mb-5" style={{ color: '#8B0C21' }}>The default script</p>
            <h2 className="font-heading mt-3 text-4xl font-bold leading-tight tracking-tight text-white lg:text-5xl">
              College gives you a syllabus. Not a strategy for your life.
            </h2>
            <p className="mt-6 leading-7 text-slate-400">
              Students are often pushed toward majors and professions based on prestige, expectations, or incomplete information. They may know how to complete assignments without knowing what the career actually involves, what lifestyle it creates, or whether it fits the person they want to become.
            </p>
          </div>
          <div className="rounded-[20px] p-8" style={{ background: '#111D33', border: '1px solid rgba(139,12,33,0.30)' }}>
            <p className="text-xs font-bold uppercase tracking-[.14em] mb-4" style={{ color: '#8B0C21' }}>The Unscripted method</p>
            <h3 className="font-heading text-2xl font-bold text-white mb-4">Explore. Test. Learn. Adjust.</h3>
            <p className="leading-7 text-slate-300">
              Unscripted turns self-awareness into action. Compare paths, run controlled real-world experiments, receive step-by-step Mission Guides, and learn from your own results before making major decisions.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-6 py-28">
        <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>How it works</p>
        <h2 className="font-heading mt-3 text-4xl font-bold tracking-tight text-[#050816]">From uncertainty to weekly action.</h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {howItWorks.map(({ Icon, step, title, body }) => (
            <div key={title} className="rounded-[18px] border border-[#E2E8F0] bg-white p-7 transition hover:-translate-y-1 hover:shadow-md"
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(139,12,33,0.25)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
              <div className="flex items-center justify-between mb-6">
                <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: '#F8ECEF' }}>
                  <Icon size={20} style={{ color: '#8B0C21' }} />
                </div>
                <span className="font-heading text-2xl font-bold" style={{ color: 'rgba(139,12,33,0.15)' }}>{step}</span>
              </div>
              <h3 className="font-heading text-lg font-bold text-[#050816]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#334155]">{body}</p>
            </div>
          ))}
        </div>

        {/* Paths section */}
        <div className="mt-24 rounded-[24px] p-10 sm:p-14" style={{ background: '#FCF6F7' }}>
          <p className="text-xs font-bold uppercase tracking-[.14em] mb-3" style={{ color: '#8B0C21' }}>Built for more than one path</p>
          <h2 className="font-heading text-3xl font-bold text-[#050816]">Whatever direction you're building toward.</h2>
          <div className="mt-9 flex flex-wrap gap-3">
            {uses.map(x => (
              <div key={x} className="rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition cursor-default hover:border-[rgba(139,12,33,0.35)] hover:text-[#8B0C21]">
                {x}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-28">
        <div className="mx-auto max-w-7xl rounded-[24px] px-8 py-20 text-center text-white" style={{ background: '#8B0C21' }}>
          <h2 className="font-heading mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            You do not need to choose your entire life today. You need a better way to test what comes next.
          </h2>
          <Link to="/register"
            className="mt-10 inline-flex items-center gap-2 rounded-[10px] bg-white px-7 py-4 text-sm font-semibold transition hover:-translate-y-px hover:shadow-xl"
            style={{ color: '#050816', boxShadow: '0 4px 16px rgba(5,8,22,0.12)' }}>
            Build My Roadmap <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}