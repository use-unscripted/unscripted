import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';
import { saveDraft, loadDraft } from '@/lib/guest-draft';

const EXAMPLE_PATHS = [
  'Investment banking / finance',
  'Management consulting',
  'Tech / software engineering',
  'Venture capital / private equity',
  'Startup operations or founding',
  'Medicine / healthcare',
  'Law',
  'Graduate school / academia',
  'Marketing / brand',
  'Building a personal brand / content',
  'Freelancing / independent consulting',
  'Real estate / investing',
  'Nonprofit / mission-driven work',
  'Creative industries (film, design, music)',
  'Government / policy',
];

export default function PathsIntake() {
  const nav = useNavigate();
  const [primaryPath, setPrimaryPath] = useState('');
  const [customPrimary, setCustomPrimary] = useState('');
  const [comparisonPath, setComparisonPath] = useState('');
  const [customComparison, setCustomComparison] = useState('');

  const primary = primaryPath === 'other' ? customPrimary : primaryPath;
  const comparison = comparisonPath === 'other' ? customComparison : comparisonPath;

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft();
    const ALL_PATHS = EXAMPLE_PATHS;
    if (draft?.primary_path) {
      const known = ALL_PATHS.find(p => p === draft.primary_path);
      if (known) setPrimaryPath(draft.primary_path);
      else { setPrimaryPath('other'); setCustomPrimary(draft.primary_path); }
    }
    if (draft?.comparison_path) {
      const known = ALL_PATHS.find(p => p === draft.comparison_path);
      if (known) setComparisonPath(draft.comparison_path);
      else { setComparisonPath('other'); setCustomComparison(draft.comparison_path); }
    }
  }, []);

  const submit = () => {
    if (!primary) return;
    saveDraft({ primary_path: primary, comparison_path: comparison, current_step: 3 });
    nav('/onboarding-review');
  };

  const selectClass = (selected) =>
    `w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-[color:var(--brand-navy-900)] ${selected ? 'border-[color:var(--brand-navy-900)] bg-[color:var(--ink-100)]' : 'border-[color:var(--ink-200)] bg-[color:var(--ink-50)]'}`;

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: 'var(--page-surface)' }}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 flex items-center justify-between">
          <LogoWordmark />
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-[color:var(--ink-500)]">STEP 5 OF 5</span>
            <Link to="/login" className="text-xs font-semibold text-[color:var(--ink-500)] hover:text-[color:var(--surface-dark-900)] transition">Log in</Link>
          </div>
        </div>

        <div className="mb-2 flex justify-between text-xs text-[color:var(--ink-500)]">
          <span>Path selection</span>
          <span>Almost done</span>
        </div>
        <div className="mb-10 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-200)' }}>
          <div className="h-full rounded-full" style={{ width: '100%', background: 'var(--brand-navy-900)' }} />
        </div>

        <section className="rounded-[24px] border border-[color:var(--ink-200)] bg-white p-7 shadow-sm sm:p-10">
          <h1 className="font-heading mb-2 mt-3 text-2xl font-bold tracking-tight text-[color:var(--surface-dark-900)]">Which paths should we build your 30-day test around?</h1>
          <p className="mb-8 text-sm text-[color:var(--ink-500)]">
            We will generate three path recommendations, then build a 30-day experiment plan for the one you select. You are not committing — you are choosing what to test first.
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-2">
                Primary path to test <span style={{ color: 'var(--brand-navy-900)' }}>*</span>
              </label>
              <select className={selectClass(primaryPath)}
                value={primaryPath} onChange={e => setPrimaryPath(e.target.value)}>
                <option value="">Select a path</option>
                {EXAMPLE_PATHS.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="other">Other — I'll describe it below</option>
              </select>
              {primaryPath === 'other' && (
                <input
                  className="mt-3 w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3 text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
                  placeholder="Describe the path you want to test"
                  value={customPrimary}
                  onChange={e => setCustomPrimary(e.target.value)}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-2">
                Comparison path <span className="text-[color:var(--ink-400)] font-normal">(optional)</span>
              </label>
              <p className="text-xs text-[color:var(--ink-500)] mb-2">We'll include this as one of your three recommended paths so you can compare them directly.</p>
              <select className={selectClass(comparisonPath && comparisonPath !== 'none')}
                value={comparisonPath} onChange={e => setComparisonPath(e.target.value)}>
                <option value="">No comparison path (skip)</option>
                {EXAMPLE_PATHS.filter(p => p !== (primaryPath === 'other' ? customPrimary : primaryPath)).map(p => <option key={p} value={p}>{p}</option>)}
                <option value="other">Other — I'll describe it below</option>
              </select>
              {comparisonPath === 'other' && (
                <input
                  className="mt-3 w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3 text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
                  placeholder="Describe the comparison path"
                  value={customComparison}
                  onChange={e => setCustomComparison(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="mt-10 flex justify-between">
            <button onClick={() => nav('/onboarding')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[color:var(--ink-500)] hover:text-[color:var(--surface-dark-900)] transition">
              <ArrowLeft size={16} /> Back
            </button>
            <button onClick={submit} disabled={!primary}
              className="flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-60"
              style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
              Review My Test <ArrowRight size={16} />
            </button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-[color:var(--ink-400)]">
          You can change your selected path at any time. This is a test, not a commitment.
        </p>
      </div>
    </main>
  );
}