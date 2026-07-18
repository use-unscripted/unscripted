import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const paths = [
  'A traditional professional career',
  'Joining a startup',
  'Building a company',
  'Building a personal brand',
  'Freelancing or offering a service',
  'Graduate school',
  'A mission-driven path',
];

const missionSteps = [
  'Identify 10 relevant professionals',
  'Research each person',
  'Draft personalized outreach',
  'Send and track messages',
  'Follow up appropriately',
  'Schedule a call',
  'Prepare tailored questions',
  'Record what you learned',
  'Update your path assessment',
];

export default function LandingSections() {
  return (
    <>
      {/* What are you trying to test? */}
      <section className="px-6 py-20" style={{ background: '#FAFAF9', borderTop: '1px solid #E2E8F0' }}>
        <div className="mx-auto max-w-7xl">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>What are you trying to test?</p>
            <h2 className="font-heading mt-3 text-3xl font-bold text-[#050816]">These are paths the system can help you test.</h2>
            <p className="mt-3 max-w-2xl text-[#334155]">
              Unscripted is not a separate product for each path. It helps you compare any of these options, run structured experiments, and build evidence before committing.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {paths.map(p => (
              <div key={p} className="rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#334155]">{p}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="px-6 py-28" style={{ background: '#081225' }}>
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] mb-5" style={{ color: '#8B0C21' }}>The problem</p>
            <h2 className="font-heading mt-3 text-4xl font-bold leading-tight tracking-tight text-white lg:text-5xl">
              College teaches you subjects. Not how to test whether a path actually fits you.
            </h2>
            <p className="mt-6 leading-7 text-slate-400">
              Most students choose a direction based on prestige, family expectations, or incomplete information. They may spend years pursuing a path before discovering it doesn't match their actual values, working style, or life goals.
            </p>
          </div>
          <div className="rounded-[20px] p-8" style={{ background: '#111D33', border: '1px solid rgba(139,12,33,0.30)' }}>
            <p className="text-xs font-bold uppercase tracking-[.14em] mb-4" style={{ color: '#8B0C21' }}>The Unscripted method</p>
            <h3 className="font-heading text-2xl font-bold text-white mb-4">Compare. Test. Execute. Reflect. Adjust.</h3>
            <p className="leading-7 text-slate-300">
              Unscripted helps you compare realistic paths with honest tradeoffs, run controlled real-world experiments, build weekly execution plans around your actual schedule, and use reflection to make better decisions.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Guide Preview */}
      <section className="mx-auto max-w-7xl px-6 py-28">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>Mission Guide preview</p>
            <h2 className="font-heading mt-3 text-4xl font-bold tracking-tight text-[#050816]">
              Every experiment comes with exact instructions.
            </h2>
            <p className="mt-5 text-[#334155] leading-7">
              Mission Guides are Unscripted's core differentiator. Each one explains exactly how to execute the assignment — not just what to do, but how to do it, what to say, common mistakes, and how to capture what you learned.
            </p>
            <Link to="/register"
              className="mt-8 inline-flex items-center gap-2 rounded-[10px] px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-px"
              style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
              See the Full Mission Guide <ArrowRight size={17} />
            </Link>
          </div>

          {/* Sample Mission Guide */}
          <div className="rounded-[24px] p-7" style={{ background: '#081225', border: '1px solid rgba(139,12,33,0.35)' }}>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'rgba(139,12,33,0.25)', color: '#F8ECEF' }}>Mission Guide</span>
            </div>
            <h3 className="font-heading text-lg font-bold text-white mb-1">
              Interview Someone Working in Your Target Role
            </h3>
            <p className="text-xs text-slate-400 mb-5">Estimated time: 4–6 hours · Deliverable: Written summary + path update</p>
            <ol className="space-y-2.5">
              {missionSteps.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" style={{ color: '#8B0C21' }} />
                  <span className="text-sm text-slate-300">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-28">
        <div className="mx-auto max-w-7xl rounded-[24px] px-8 py-20 text-center text-white" style={{ background: '#8B0C21' }}>
          <h2 className="font-heading mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            You don't need to choose your entire life today. You need a better way to test what comes next.
          </h2>
          <Link to="/register"
            className="mt-10 inline-flex items-center gap-2 rounded-[10px] bg-white px-7 py-4 text-sm font-semibold transition hover:-translate-y-px hover:shadow-xl"
            style={{ color: '#050816', boxShadow: '0 4px 16px rgba(5,8,22,0.12)' }}>
            Start My 30-Day Path Test <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}