import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatePathTest } from '@/lib/path-generator';
import { CompassIcon } from '@/components/UnscriptedLogo';
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';

const LABELS = [
  'Analyzing your priorities and available time...',
  'Mapping your selected path against your profile...',
  'Building honest tradeoff assessments...',
  'Generating your 30-day experiment plan...',
];

export default function Generating() {
  const nav = useNavigate();
  const [labelIdx, setLabelIdx] = useState(0);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  const run = useCallback(async () => {
    setError(null);
    setRetrying(true);
    setLabelIdx(0);
    let intervalId;
    try {
      intervalId = setInterval(() => {
        setLabelIdx(i => Math.min(i + 1, LABELS.length - 1));
      }, 2500);
      await generatePathTest();
      nav('/path-results', { replace: true });
    } catch (e) {
      // The generator has already logged the stage it failed at. Logging the
      // error object again here would put the raw server message, and with it
      // whatever of the student's profile the model was working from, into the
      // console a second time.
      if (e?.stage) console.error(`Path generation failed at stage=${e.stage}`);
      else console.error('Path generation failed.');
      setError(e?.message || 'Something went wrong generating your path test. Please try again.');
    } finally {
      clearInterval(intervalId);
      setRetrying(false);
    }
  }, [nav]);

  useEffect(() => { run(); }, []);

  if (error) {
    return (
      <main className="grid min-h-[100svh] place-items-center px-6 text-center text-white" style={{ background: 'var(--surface-dark-700)' }}>
        <div className="max-w-md">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full"           style={{ background: 'rgba(31,58,95,0.25)', border: '1px solid rgba(31,58,95,0.4)' }}>
            <AlertTriangle size={24} aria-hidden="true" />
          </div>
          <h1 className="tp-page">Generation failed</h1>
          <p className="tp-lead mt-3 text-[color:var(--ink-400)]">{error}</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <button onClick={run}
              className="flex items-center gap-2 rounded-[var(--r-control)] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-px"
              style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
              <RefreshCw size={15} /> Retry
            </button>
            {/* Anyone who gets here has an account and saved answers. The old
                way out was the signed-out intake, which ends at the account
                wall and drops them back on My Journey anyway. */}
            <button onClick={() => nav('/journey')}
              className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink-400)] hover:text-white transition">
              <ArrowLeft size={14} /> Back to My Journey
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-[100svh] place-items-center px-6 text-center text-white" style={{ background: 'var(--surface-dark-700)' }}>
      <div>
        <div className="mx-auto flex items-center justify-center h-16 w-16 animate-pulse">
          <CompassIcon size={56} />
        </div>
        <h1 className="tp-page mt-8">Building your 30-day path test.</h1>
        <p className="tp-lead mx-auto mt-3 text-[color:var(--ink-400)]">{LABELS[labelIdx]}</p>
        <div className="mx-auto mt-8 h-1.5 w-64 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full animate-pulse rounded-full" style={{ width: `${Math.round((labelIdx + 1) / LABELS.length * 100)}%`, background: 'var(--brand-navy-900)', transition: 'width 0.5s ease' }} />
        </div>
        <p className="tp-meta mt-6 text-[color:var(--ink-500)]">This usually takes 20-30 seconds.</p>
      </div>
    </main>
  );
}