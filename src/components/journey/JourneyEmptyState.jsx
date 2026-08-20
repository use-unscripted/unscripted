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
    body: 'A short set of questions. Your paths are built from your answers.',
    cta: { label: 'Begin onboarding', to: '/onboarding' },
  },
  paths: {
    Icon: Sparkles,
    title: 'Your paths haven’t been generated yet',
    body: 'Your answers are saved. Generate your three paths to compare them.',
    // Straight to generation. Their answers are already saved, so sending them
    // through the signed-out intake ended at the account wall, which bounces a
    // student who already has an account back here with nothing generated.
    cta: { label: 'Generate my paths', to: '/generating' },
  },
  path: {
    Icon: ListChecks,
    title: 'No path selected yet',
    body: 'Pick the one you want to test first. You can change later.',
    cta: { label: 'Compare my paths', to: '/paths' },
  },
  experiment: {
    Icon: FlaskConical,
    title: 'No experiment yet',
    body: 'Set up one experiment for this path.',
    cta: { label: 'Begin my experiment', to: '/experiments/new' },
  },
  experiment_done: {
    Icon: CheckCircle2,
    title: 'Your experiment is finished',
    body: 'Turn what you did into evidence, then reflect on it.',
    cta: { label: 'Add evidence', to: '/evidence?tab=proof' },
  },
  legacy: {
    Icon: FileWarning,
    title: 'Some older records need a home',
    body: 'A few older records couldn’t be matched to a cycle. Nothing was deleted.',
    cta: { label: 'Review my records', to: '/evidence' },
  },
};

export default function JourneyEmptyState({ variant, ctaTo }) {
  const s = STATES[variant];
  if (!s) return null;
  const { Icon, title, body, cta } = s;

  return (
    <section className="app-card p-6 text-center sm:p-8">
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
        className="ui-press app-cta tp-control mt-5"
        style={{ minHeight: '48px' }}
      >
        {cta.label}
      </Link>
    </section>
  );
}