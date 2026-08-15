/**
 * Team-only: publish the validated career library.
 *
 * Idempotent, so re-running after the library content changes updates the stored
 * blueprints, sources, templates and validation records in place. It never
 * creates professional reviews, which is why everything it publishes lands at
 * Source Grounded.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { seedLibrary } from '@/lib/career-library/seed';

export default function AdminLibrarySeed() {
  const [user, setUser] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => setUser({})); }, []);

  const run = async (dryRun) => {
    setBusy(true);
    setError(null);
    try {
      setReport(await seedLibrary({ dryRun }));
    } catch (err) {
      setError(err?.message || 'Publishing failed.');
    } finally {
      setBusy(false);
    }
  };

  if (user && user.role !== 'admin') {
    return (
      <main className="app-page">
        <PageHeader title="Career library" description="This page is for the Unscripted team." />
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Team only"
        title="Publish the career library"
        description="Writes the role blueprints, their verified sources, the experiment templates and one validation record per template. Safe to re-run."
      />
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => run(true)} disabled={busy} className="ui-press app-cta-secondary tp-control">
          {busy ? 'Working…' : 'Preview without writing'}
        </button>
        <button type="button" onClick={() => run(false)} disabled={busy} className="ui-press app-cta tp-control">
          {busy ? 'Working…' : 'Publish library'}
        </button>
      </div>

      {error && <p className="tp-body mt-4" style={{ color: 'var(--danger-700)' }}>{error}</p>}

      {report && (
        <section className="app-card mt-6 p-5">
          <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
            {report.dryRun ? 'Preview' : 'Published'}: {report.totals.careers} careers, {report.totals.experiments} experiments, {report.totals.sources} sources
          </h2>
          <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
            Professional reviews created: {report.totals.professional_reviews_created}. Reviews on file across the app: {report.professional_reviews_on_file}.
          </p>
          <ul className="mt-4 space-y-3">
            {report.careers.map(c => (
              <li key={c.career_key}>
                <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{c.career_title}</p>
                <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>
                  {c.experiments.length} experiments · {c.sources} verified sources · Source Grounded · no professional review
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}