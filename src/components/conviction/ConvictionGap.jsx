import { Link } from 'react-router-dom';
import { HelpCircle, ArrowRight } from 'lucide-react';

const Block = ({ label, children }) => (
  <div className="mt-4">
    <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{label}</p>
    <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>{children}</p>
  </div>
);

/**
 * The one thing this path most needs the student to learn next, in plain
 * language: what they do not know, why it matters, what evidence already exists,
 * and the kind of test that would answer it. Everything shown here is read from
 * records the student already produced.
 */
export default function ConvictionGap({ gap }) {
  if (!gap) return null;

  return (
    <section className="app-card p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ background: 'var(--warning-50)' }}>
          <HelpCircle size={18} style={{ color: 'var(--warning-700)' }} />
        </div>
        <div className="min-w-0">
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Your biggest conviction gap</p>
          <h2 className="tp-section mt-1" style={{ color: 'var(--text-primary)' }}>{gap.area}</h2>
        </div>
      </div>

      <Block label="What you still do not know">
        {gap.unknown}
        {gap.dimension ? ` (${gap.dimension})` : ''}
      </Block>
      <Block label="Why it matters">{gap.matters}</Block>
      <Block label="What evidence already exists">{gap.evidence}</Block>
      <Block label="What kind of test would help">{gap.test}</Block>

      {gap.to && (
        <Link to={gap.to} className="ui-press app-cta tp-control mt-5 w-full sm:w-auto">
          Test this now
          <ArrowRight size={16} />
        </Link>
      )}
      <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
        The recommended next test below is aimed at this gap.
      </p>
    </section>
  );
}