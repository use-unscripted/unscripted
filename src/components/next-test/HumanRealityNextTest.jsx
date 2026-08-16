import { Link } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';
import OverrideActions from '@/components/next-test/OverrideActions';

/**
 * The recommended next test, when that test is a conversation.
 *
 * Same slot, same authority as a work sample: this is put forward because the
 * open question cannot honestly be simulated, not as a softer alternative.
 */
export default function HumanRealityNextTest({ recommendation, onAccept, onOverride, busy, exhausted }) {
  const { human_reality: hr, path_name, why, start_to } = recommendation;

  return (
    <section className="app-card p-6 sm:p-8" aria-labelledby="human-next-title">
      <div className="flex items-center gap-2">
        <Users size={16} style={{ color: 'var(--brand-gold-700)' }} aria-hidden="true" />
        <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-700)' }}>Best next test for you</p>
      </div>

      <h2 id="human-next-title" className="tp-section mt-3" style={{ color: 'var(--ink-900)' }}>
        A Human Reality conversation
      </h2>
      <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>For {path_name}</p>

      <p className="tp-body mt-4 rounded-[var(--r-control)] px-4 py-3" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }}>
        {hr.cannot_simulate}
      </p>

      <div className="mt-4">
        <h3 className="tp-label" style={{ color: 'var(--ink-500)' }}>What we&apos;re trying to learn</h3>
        <p className="tp-body mt-2" style={{ color: 'var(--ink-700)' }}>{hr.learning}</p>
        <p className="tp-body mt-2" style={{ color: 'var(--ink-700)' }}>{why}</p>
      </div>

      <div className="mt-4">
        <h3 className="tp-label" style={{ color: 'var(--ink-500)' }}>Questions worth asking</h3>
        <ol className="mt-2 space-y-1.5">
          {hr.questions.map((q, i) => (
            <li key={q} className="tp-body" style={{ color: 'var(--ink-700)' }}>
              <span className="mr-2 font-bold" style={{ color: 'var(--brand-navy-700)' }}>{i + 1}.</span>{q}
            </li>
          ))}
        </ol>
      </div>

      <p className="tp-meta mt-4" style={{ color: 'var(--ink-400)' }}>
        One conversation is enough. Your own contact, an alumnus, a mentor or your careers service all count the same.
      </p>

      <div className="mt-6">
        <Link to={start_to} onClick={onAccept} className="ui-press app-cta tp-control">
          Set up the conversation <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>

      {onOverride && <OverrideActions onOverride={onOverride} busy={busy} />}
      {exhausted && (
        <p className="tp-meta mt-3" style={{ color: 'var(--ink-400)' }}>
          That was the last open question we could put forward right now, so this one is still showing.
        </p>
      )}
    </section>
  );
}