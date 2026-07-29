import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ScrollReveal, { StaggerGroup } from '@/components/ScrollReveal';
import UniversityMarquee from '@/components/landing/UniversityMarquee';

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
          <ScrollReveal delay={0}>
            <div className="mb-6 inline-flex w-fit rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[.12em]"
              style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)', color: 'var(--brand-navy-700)' }}>
              Write your own path
            </div>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <h1 className="font-heading text-[3rem] font-extrabold leading-[1.04] tracking-[-0.02em] sm:text-[4rem]" style={{ color: 'var(--text-primary)' }}>
              Don't guess your next path. Test it.
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 font-body" style={{ color: 'var(--text-secondary)' }}>
              Unscripted helps high school and college students compare realistic career and life paths, complete guided real-world experiments, and learn what actually fits — before making a major commitment.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={240}>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link to="/onboarding"
                className="flex items-center gap-2 rounded-[10px] px-7 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-px"
                style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
                Start My 30-Day Path Test <ArrowRight size={17} />
              </Link>
              <a href="#how-it-works"
                className="rounded-[10px] px-7 py-3.5 text-sm font-semibold transition"
                style={{ background: 'white', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                See How It Works
              </a>
            </div>
            <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              Already have an account?{' '}
              <Link to="/login" className="font-semibold underline" style={{ color: 'var(--brand-navy-700)' }}>Log in</Link>
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* University marquee */}
      <UniversityMarquee />

      {/* 4-step process */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-6 pt-16 pb-24">
        <StaggerGroup base={0} step={90} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ n, title, body }) => (
            <div key={n} className="rounded-[18px] bg-white p-6" style={{ border: '1px solid var(--border-light)' }}>
              <span className="font-heading text-3xl font-bold" style={{ color: 'rgba(31,58,95,0.15)' }}>{n}</span>
              <h3 className="font-heading mt-3 text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{body}</p>
            </div>
          ))}
        </StaggerGroup>
      </section>
    </>
  );
}