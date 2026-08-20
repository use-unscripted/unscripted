import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FlaskConical } from 'lucide-react';
import DepthBadge from '@/components/experiments/DepthBadge';
import { DEPTHS } from '@/lib/experiment-depth';
import WhyThisMatters from '@/components/next-test/WhyThisMatters';
import AlternativeTests from '@/components/next-test/AlternativeTests';
import OverrideActions from '@/components/next-test/OverrideActions';
import DimensionPicker from '@/components/next-test/DimensionPicker';
import TestTypeBadge from '@/components/next-test/TestTypeBadge';

/**
 * Recommended next test.
 *
 * States what Unscripted believes is the most useful thing to test next, why,
 * and what it will tell us — then leaves the student free to do something else.
 * No scores, no talk of variables or information value.
 */
export default function RecommendedNextTest({ recommendation, onOverride, onAccept, busy, exhausted }) {
  const [showWhy, setShowWhy] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [chosen, setChosen] = useState(recommendation?.candidate?.variable || '');
  if (!recommendation) return null;

  const {
    title, why, tests, path_name, path_id, detail, alternatives, early,
    depth = 'quick_test', depth_reason, depth_meta, alternative_depth_meta,
    quick_to, deep_to, start_to, unlock, cross_career_note, smallest_useful,
    dimension_options = [], candidate,
    test_type_label, test_type_purpose, test_type_produces,
  } = recommendation;

  // The dropdown only ever changes WHICH open question this test answers. The
  // career it is designed against is the one named above, either way.
  const selected = dimension_options.find(o => o.variable === chosen) || dimension_options[0] || null;
  const switched = selected && candidate && selected.variable !== candidate.variable;
  const linkTo = (base) => (switched && path_id
    ? `${base}?recId=${path_id}&variable=${encodeURIComponent(selected.variable)}`
    : null);

  const quickFirst = depth !== 'deep_dive';
  const quickLink = linkTo('/moment') || quick_to || start_to;
  const deepLink = linkTo('/experiments/new') || deep_to || start_to;
  const primary = {
    to: quickFirst ? quickLink : deepLink,
    meta: depth_meta || DEPTHS[depth],
  };
  const secondary = {
    to: quickFirst ? deepLink : quickLink,
    meta: alternative_depth_meta || DEPTHS[quickFirst ? 'deep_dive' : 'quick_test'],
  };

  return (
    <section
      className="app-card p-6 sm:p-8"
      aria-labelledby="next-test-title"
    >
      <div className="flex items-center gap-2">
        <FlaskConical size={16} style={{ color: 'var(--brand-gold-700)' }} aria-hidden="true" />
        <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-700)' }}>Recommended next test</p>
      </div>

      <h2 id="next-test-title" className="tp-section mt-3" style={{ color: 'var(--ink-900)' }}>{title}</h2>
      <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>For {path_name}</p>

      <TestTypeBadge label={test_type_label} purpose={test_type_purpose} produces={test_type_produces} />

      {early && (
        <p className="tp-meta mt-3 inline-block rounded-full px-2.5 py-1 font-semibold" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }}>
          Early recommendation, based on your answers so far
        </p>
      )}

      <div className="mt-4">
        <h3 className="tp-label" style={{ color: 'var(--ink-500)' }}>Why we are recommending this</h3>
        <p className="tp-body mt-2" style={{ color: 'var(--ink-700)' }}>{why}</p>
      </div>

      {/* One answer that informs several directions beats three career-shaped
          tests of the same unknown, so it is worth saying out loud. */}
      {cross_career_note && (
        <p className="tp-body mt-3 rounded-[var(--r-control)] px-3 py-2" style={{ background: 'var(--info-50)', color: 'var(--info-700)' }}>
          {cross_career_note}
        </p>
      )}

      <div className="mt-4">
        <h3 className="tp-label" style={{ color: 'var(--ink-500)' }}>This will help us test</h3>
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
      {smallest_useful && (
        <p className="tp-meta mt-1.5" style={{ color: 'var(--ink-400)' }}>{smallest_useful}</p>
      )}

      {/* The optional upgrade in depth, once a run of short tests exists. Never
          a requirement: the short test stays right beside it. */}
      {unlock && (
        <div className="mt-4 rounded-[var(--r-control)] border p-4" style={{ borderColor: 'var(--brand-gold-500)', background: 'var(--warning-50)' }}>
          <p className="tp-body font-semibold" style={{ color: 'var(--ink-900)' }}>{unlock.headline}</p>
          <p className="tp-meta mt-1" style={{ color: 'var(--ink-700)' }}>{unlock.prompt}</p>
          <Link to={deep_to || start_to} className="tp-body mt-2 inline-block font-bold" style={{ color: 'var(--brand-gold-700)' }}>
            {unlock.cta}
          </Link>
        </div>
      )}

      {/* Chosen before the test starts, so the student decides what they are
          trying to learn rather than discovering it inside the task. */}
      <DimensionPicker
        options={dimension_options}
        value={selected?.variable || ''}
        onChange={setChosen}
        question={selected?.question}
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Quick Test is the default level. Deep Dive stays one tap away and is
            never required. */}
        <Link to={primary.to} onClick={onAccept} className="ui-press app-cta tp-control">
          Start the {primary.meta.label} · {primary.meta.duration_label} <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <Link to={secondary.to} onClick={onAccept} className="app-cta-secondary tp-control">
          {secondary.meta.label} instead · {secondary.meta.duration_label}
        </Link>
        <button
          type="button"
          onClick={() => setShowWhy(v => !v)}
          className="app-cta-secondary tp-control"
          aria-expanded={showWhy}
        >
          {showWhy ? 'Hide why this matters' : 'Why this matters'}
        </button>
        <button
          type="button"
          onClick={() => setShowOthers(v => !v)}
          className="tp-control px-2 py-3.5"
          style={{ color: 'var(--brand-navy-700)' }}
          aria-expanded={showOthers}
        >
          {showOthers ? 'Hide other experiments' : 'Choose another experiment'}
        </button>
      </div>

      {showWhy && <WhyThisMatters detail={detail} />}
      {showOthers && <AlternativeTests alternatives={alternatives} />}

      {onOverride && <OverrideActions onOverride={onOverride} busy={busy} />}
      {exhausted && (
        <p className="tp-meta mt-3" style={{ color: 'var(--ink-400)' }}>
That was the last open question we could put forward. Nothing you set aside is lost.
        </p>
      )}
    </section>
  );
}