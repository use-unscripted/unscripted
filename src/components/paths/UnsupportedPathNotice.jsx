import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, Wrench } from 'lucide-react';
import { UNSUPPORTED_HEADLINE, relatedSupportedCareers } from '@/lib/path-support';
import { addLibraryPath } from '@/lib/library-paths';
import PathSupportBadge from '@/components/paths/PathSupportBadge';

/**
 * What a student sees instead of a test they cannot honestly run.
 *
 * Nothing is removed and nothing is forced: the direction stays saved, a related
 * direction that CAN be tested is offered rather than substituted, and what is
 * already known about this one remains readable. No strength or learning-value
 * reading is shown here, because neither exists for this direction yet.
 */
export default function UnsupportedPathNotice({ path, support, index }) {
  const navigate = useNavigate();
  const [busyKey, setBusyKey] = useState(null);
  const [kept, setKept] = useState(false);
  const related = relatedSupportedCareers(path, index);

  const explore = async (career) => {
    setBusyKey(career.key);
    try {
      await addLibraryPath(career);
      navigate('/choose');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="app-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <PathSupportBadge support={support} />
      </div>

      <h2 className="tp-section mt-3" style={{ color: 'var(--text-primary)' }}>
        {UNSUPPORTED_HEADLINE}
      </h2>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        {path?.path_name} stays saved exactly as it is. We are not going to show you a
        strength score or a learning value for tests we have not built and validated yet.
      </p>

      <div className="mt-5 space-y-2.5">
        <button
          type="button"
          onClick={() => setKept(true)}
          className="ui-press app-cta-secondary tp-control w-full"
        >
          Keep this path
        </button>
        {kept && (
          <p className="tp-meta font-semibold" style={{ color: 'var(--success-700)' }}>
            Kept. Nothing was changed or removed.
          </p>
        )}

        <Link to="/paths" className="ui-press app-cta-secondary tp-control w-full">
          View what is currently known
        </Link>
      </div>

      {related.length > 0 && (
        <div className="mt-6">
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
            <Wrench size={11} className="mr-1 inline" /> Related directions you can test now
          </p>
          <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
            Only worth taking if one of these genuinely interests you. Adding one does not
            replace {path?.path_name}.
          </p>
          <ul className="mt-3 space-y-2">
            {related.map(({ career, support: s }) => (
              <li key={career.key}>
                <button
                  type="button"
                  onClick={() => explore(career)}
                  disabled={busyKey === career.key}
                  className="ui-lift flex w-full items-center justify-between gap-3 rounded-[var(--r-control)] p-4 text-left disabled:opacity-60"
                  style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)', minHeight: '56px' }}
                >
                  <span className="min-w-0">
                    <span className="tp-card block" style={{ color: 'var(--text-primary)' }}>{career.title}</span>
                    <span className="tp-meta block" style={{ color: 'var(--ink-400)' }}>
                      {career.family} · {s.state.badge}
                    </span>
                  </span>
                  {busyKey === career.key
                    ? <Loader2 size={16} className="shrink-0 animate-spin" style={{ color: 'var(--brand-navy-700)' }} />
                    : <ArrowRight size={16} className="shrink-0" style={{ color: 'var(--brand-navy-700)' }} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}