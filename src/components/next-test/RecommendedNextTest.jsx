import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FlaskConical } from 'lucide-react';
import DepthBadge from '@/components/experiments/DepthBadge';
import { DEPTHS } from '@/lib/experiment-depth';
import WhyThisMatters from '@/components/next-test/WhyThisMatters';
import AlternativeTests from '@/components/next-test/AlternativeTests';

/**
 * Recommended next test.
 *
 * States what Unscripted believes is the most useful thing to test next, why,
 * and what it will tell us — then leaves the student free to do something else.
 * No scores, no talk of variables or information value.
 */
export default function RecommendedNextTest({ recommendation }) {
  const [showWhy, setShowWhy] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  if (!recommendation) return null;

  const {
    title, why, tests, path_name, detail, alternatives, early,
    depth = 'quick_test', depth_reason, depth_meta, alternative_depth_meta,
    quick_to, deep_to, start_to, unlock,
  } = recommendation;

  const quickFirst = depth !== 'deep_dive';
  const primary = {
    to: (quickFirst ? quick_to : deep_to) || start_to,
    meta: depth_meta || DEPTHS[depth],
  };
  const secondary = {
    to: (quickFirst ? deep_to : quick_to) || start_to,
    meta: alternative_depth_meta || DEPTHS[quickFirst ? 'deep_dive' : 'quick_test'],
  };

  return (
    <section
      className="rounded-[22px] border bg-white p-6 sm:p-8"
      style={{ borderColor: 'var(--ink-200)' }}
      aria-labelledby="next-test-title"
    >
      <div className="flex items-center gap-2">
        <FlaskConical size={16} style={{ color: 'var(--brand-gold-700)' }} aria-hidden="true" />
        <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-700)' }}>Recommended next test</p>
      </div>

      <h2 id="next-test-title" className="tp-section mt-3" style={{ color: 'var(--ink-900)' }}>{title}</h2>
      <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>For {path_name}</p>

      {early && (
        <p className="tp-meta mt-3 inline-block rounded-full px-2.5 py-1 font-semibold" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }}>
          Early recommendation, based on your answers so far
        </p>
      )}

      <div className="mt-4">
        <h3 className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Why we are recommending this</h3>
        <p className="tp-body mt-2" style={{ color: 'var(--ink-700)' }}>{why}</p>
      </div>

      <div className="mt-4">
        <h3 className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>This will help us test</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {tests.map(t => (
            <li key={t} className="tp-meta rounded-full px-2.5 py-1 font-semibold" style={{ background: 'var(--ink-100)', color: 'var(--ink-700)' }}>{t}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DepthBadge depth={primary.meta.id} />
        <span className="tp-meta" style={{ color: 'var(--ink-400)' }}>{depth_reason}</span>
      </div>

      {/* The optional upgrade in depth, once a run of short tests exists. Never
          a requirement: the short test stays right beside it. */}
      {unlock && (
        <div className="mt-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--brand-gold-500)', background: 'var(--warning-50)' }}>
          <p className="tp-body font-semibold" style={{ color: 'var(--ink-900)' }}>{unlock.headline}</p>
          <p className="tp-meta mt-1" style={{ color: 'var(--ink-700)' }}>{unlock.prompt}</p>
          <Link to={deep_to || start_to} className="tp-body mt-2 inline-block font-bold" style={{ color: 'var(--brand-gold-700)' }}>
            {unlock.cta}
          </Link>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Quick Test is the default level. Deep Dive stays one tap away and is
            never required. */}
        <Link
          to={primary.to}
          className="ui-press tp-card inline-flex items-center justify-center gap-2 rounded-[12px] px-6 py-3 font-semibold text-white"
          style={{ background: 'var(--brand-navy-900)' }}
        >
          Start the {primary.meta.label} · {primary.meta.duration_label} <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <Link
          to={secondary.to}
          className="tp-body rounded-[12px] border px-5 py-3 font-semibold"
          style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-700)' }}
        >
          {secondary.meta.label} instead · {secondary.meta.duration_label}
        </Link>
        <button
          type="button"
          onClick={() => setShowWhy(v => !v)}
          className="tp-body rounded-[12px] border px-5 py-3 font-semibold"
          style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-700)' }}
          aria-expanded={showWhy}
        >
          {showWhy ? 'Hide why this matters' : 'Why this matters'}
        </button>
        <button
          type="button"
          onClick={() => setShowOthers(v => !v)}
          className="tp-body px-2 py-3 font-semibold"
          style={{ color: 'var(--brand-navy-700)' }}
          aria-expanded={showOthers}
        >
          {showOthers ? 'Hide other experiments' : 'Choose another experiment'}
        </button>
      </div>

      {showWhy && <WhyThisMatters detail={detail} />}
      {showOthers && <AlternativeTests alternatives={alternatives} />}
    </section>
  );
}