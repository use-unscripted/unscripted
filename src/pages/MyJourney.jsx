/**
 * My Journey — the one centralized student screen.
 * Answers, in order: what am I testing, what stage am I in, what do I do next,
 * what evidence exists, and what decision is coming.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { resolveJourney } from '@/lib/journey';
import CycleStageSync from '@/components/journey/CycleStageSync';
import { loadOwnedPaths } from '@/lib/path-set';
import JourneyStages from '@/components/journey/JourneyStages';
import PrimaryActionCard from '@/components/journey/PrimaryActionCard';
import JourneySnapshot from '@/components/journey/JourneySnapshot';
import DecisionPanel from '@/components/journey/DecisionPanel';

export default function MyJourney() {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const [owned, exps, prf, refs] = await Promise.all([
      loadOwnedPaths().catch(() => ({ paths: [] })),
      base44.entities.Experiments.list('-created_date', 100).catch(() => []),
      base44.entities.ProofOfWork.list('-created_date', 100).catch(() => []),
      base44.entities.WeeklyReflections.list('-created_date', 50).catch(() => []),
    ]);
    setData({
      paths: owned?.paths || [],
      experiments: Array.isArray(exps) ? exps : [],
      proof: Array.isArray(prf) ? prf : [],
      reflections: Array.isArray(refs) ? refs : [],
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <div className="skeleton h-24 w-full" />
        <div className="skeleton mt-4 h-48 w-full" />
      </main>
    );
  }

  const { stage, currentPath, counts, action, livePaths } = resolveJourney(data);

  const scrollToDecision = () => {
    document.getElementById('decision')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
          My Journey
        </h1>
        <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
          {currentPath
            ? <>You're currently testing <strong style={{ color: 'var(--text-primary)' }}>{currentPath.path_name}</strong>.</>
            : 'One direction at a time. Pick what you test first, and this page tells you what comes next.'}
        </p>
      </header>

      <CycleStageSync stage={stage} />

      <div className="space-y-5">
        <JourneyStages stage={stage} />

        <PrimaryActionCard
          action={action}
          pathName={currentPath?.path_name}
          onAnchorClick={scrollToDecision}
        />

        <JourneySnapshot counts={counts} />

        {stage === 'decide' && (
          <DecisionPanel path={currentPath} otherPaths={livePaths} onDecided={load} />
        )}

        <p className="pt-2 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Working on something else? <Link to="/paths" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Compare all paths</Link>
          {' · '}
          <Link to="/experiments" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>All missions</Link>
          {' · '}
          <Link to="/calendar" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Your week</Link>
        </p>
      </div>
    </main>
  );
}