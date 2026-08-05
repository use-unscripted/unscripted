/**
 * Every "there is nothing here yet" case on My Journey, with a way forward.
 * No blank screens.
 */
import { Link } from 'react-router-dom';
import { Compass, ListChecks, FlaskConical, FileWarning, CheckCircle2, Sparkles } from 'lucide-react';

const STATES = {
  onboarding: {
    Icon: Compass,
    title: 'Start with your onboarding',
    body: 'Answer a short set of questions about your interests, goals and time. Your paths are built from those answers.',
    cta: { label: 'Begin onboarding', to: '/onboarding' },
  },
  paths: {
    Icon: Sparkles,
    title: 'Your paths haven’t been generated yet',
    body: 'Your onboarding answers are saved. Generate your three paths to start comparing them.',
    // Straight to generation. Their answers are already saved, so sending them
    // through the signed-out intake ended at the account wall, which bounces a
    // student who already has an account back here with nothing generated.
    cta: { label: 'Generate my paths', to: '/generating' },
  },
  path: {
    Icon: ListChecks,
    title: 'No path selected yet',
    body: 'Compare your three paths and pick the one you want to test first. You can change direction later.',
    cta: { label: 'Compare my paths', to: '/paths' },
  },
  experiment: {
    Icon: FlaskConical,
    title: 'No experiment yet',
    body: 'A path only teaches you something once you test it. Set up one experiment for this path.',
    cta: { label: 'Begin my experiment', to: '/experiments/new' },
  },
  experiment_done: {
    Icon: CheckCircle2,
    title: 'Your experiment is finished',
    body: 'Turn what you did into evidence, then reflect on it. That’s what makes the decision at the end honest.',
    cta: { label: 'Add evidence', to: '/evidence?tab=proof' },
  },
  legacy: {
    Icon: FileWarning,
    title: 'Some older records need a home',
    body: 'A few things you created before we introduced cycles couldn’t be matched to one automatically. Nothing was deleted. Open Evidence to see them.',
    cta: { label: 'Review my records', to: '/evidence' },
  },
};

export default function JourneyEmptyState({ variant, ctaTo }) {
  const s = STATES[variant];
  if (!s) return null;
  const { Icon, title, body, cta } = s;

  return (
    <section className="rounded-[20px] bg-white p-6 text-center sm:p-8" style={{ border: '1px solid var(--border-light)' }}>
      <div
        className="mx-auto grid h-12 w-12 place-items-center rounded-full"
        style={{ background: 'var(--background-tertiary)' }}
      >
        <Icon size={20} style={{ color: 'var(--brand-navy-700)' }} />
      </div>
      <h2 className="tp-section mt-5" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      <p className="tp-body mx-auto mt-2.5 max-w-md" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      <Link
        to={ctaTo || cta.to}
        className="ui-press mt-5 inline-flex items-center justify-center rounded-[10px] px-6 font-heading font-bold text-white"
        style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
      >
        {cta.label}
      </Link>
    </section>
  );
}