import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowRight, AlertTriangle, TrendingUp, Zap, Loader2, Rocket } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';

const LABELS = ['Best apparent fit', 'Strong alternative', 'Contrarian option'];
const LABEL_STYLES = [
  { bg: 'var(--ink-100)', color: 'var(--brand-navy-900)' },
  { bg: 'var(--info-50)', color: 'var(--info-700)' },
  { bg: 'var(--ink-100)', color: 'var(--ink-600)' },
];

const CONFIDENCE_LABEL = { low: 'Low confidence', medium: 'Moderate confidence', high: 'High confidence' };
const CONFIDENCE_COLOR = { low: 'var(--warning-700)', medium: 'var(--info-700)', high: 'var(--success-700)' };

function ReadinessBar({ score }) {
  const pct = Math.min(100, Math.max(0, (score || 0) * 10));
  return (
    <div>
      <div className="flex justify-between text-xs text-[color:var(--ink-500)] mb-1">
        <span>Current readiness</span>
        <span className="font-bold">{score ? `${score}/10` : 'Not scored'}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-200)' }}>
        <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: 'var(--brand-navy-900)' }} />
      </div>
    </div>
  );
}

function PathCard({ rec, index, onStart, starting, disabled }) {
  const [expanded, setExpanded] = useState(index === 0);
  const labelStyle = LABEL_STYLES[index] || LABEL_STYLES[2];

  return (
    <div className="rounded-[22px] border border-[color:var(--ink-200)] bg-white overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={labelStyle}>{LABELS[index] || 'Path option'}</span>
              {rec.confidence_level && (
                <span className="text-xs font-semibold" style={{ color: CONFIDENCE_COLOR[rec.confidence_level] }}>
                  {CONFIDENCE_LABEL[rec.confidence_level]}
                </span>
              )}
            </div>
            <h3 className="font-heading text-xl font-bold text-[color:var(--surface-dark-900)]">{rec.path_name}</h3>
          </div>
          <button onClick={() => setExpanded(e => !e)}
            className="shrink-0 text-xs font-semibold transition hover:opacity-70" style={{ color: 'var(--brand-navy-900)' }}>
            {expanded ? 'Collapse' : 'See details'}
          </button>
        </div>

        {expanded && (
          <div className="space-y-4">
            <ReadinessBar score={rec.readiness_score} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl p-4" style={{ background: 'var(--success-50)', border: '1px solid rgba(21,128,61,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={14} style={{ color: 'var(--success-700)' }} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--success-700)' }}>Why it may fit</p>
                </div>
                <p className="text-sm text-[color:var(--ink-700)] leading-6">{rec.fit_reason}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--warning-50)', border: '1px solid rgba(180,83,9,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} style={{ color: 'var(--warning-700)' }} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--warning-700)' }}>Why it may not</p>
                </div>
                <p className="text-sm text-[color:var(--ink-700)] leading-6">{rec.concern}</p>
              </div>
            </div>

            {rec.lifestyle_implications && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-1">Lifestyle implications</p>
                <p className="text-sm text-[color:var(--ink-700)] leading-6">{rec.lifestyle_implications}</p>
              </div>
            )}
            {rec.main_tradeoffs && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-1">Main tradeoffs</p>
                <p className="text-sm text-[color:var(--ink-700)] leading-6">{rec.main_tradeoffs}</p>
              </div>
            )}
            {rec.current_gaps?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-2">Main skill gaps</p>
                <div className="flex flex-wrap gap-2">{rec.current_gaps.map((g, i) => (
                  <span key={i} className="rounded-full border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-3 py-1 text-xs font-semibold text-[color:var(--ink-700)]">{g}</span>
                ))}</div>
              </div>
            )}
            {rec.first_experiment && (
              <div className="rounded-xl p-4" style={{ background: 'var(--ink-100)', border: '1px solid rgba(31,58,95,0.15)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={13} style={{ color: 'var(--brand-navy-900)' }} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--brand-navy-900)' }}>One low-risk experiment to start</p>
                </div>
                <p className="text-sm text-[color:var(--ink-700)]">{rec.first_experiment}</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onStart}
          disabled={disabled}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-[10px] px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}
        >
          {starting
            ? <><Loader2 size={16} className="animate-spin" /> Starting…</>
            : <><Rocket size={16} /> Start This 30-Day Test</>}
        </button>
      </div>
    </div>
  );
}

export default function PathResults() {
  const navigate = useNavigate();
  const [recs, setRecs] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState(null);
  const [startError, setStartError] = useState('');

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      const [ps, exps] = await Promise.all([
        base44.entities.PathRecommendations.filter({ created_by_id: me.id }, '-created_date', 20).catch(() => []),
        base44.entities.Experiments.filter({ created_by_id: me.id }, '-created_date', 100).catch(() => []),
      ]);
      setRecs((Array.isArray(ps) ? ps : []).slice(0, 3));
      setExperiments(Array.isArray(exps) ? exps : []);
      setLoading(false);
    })();
  }, []);

  const handleStart = async (rec) => {
    if (startingId) return;
    setStartingId(rec.id);
    setStartError('');
    try {
      const active = experiments.filter(e => !e.deletion_status || e.deletion_status === 'active');
      const match =
        active.find(e => e.path_recommendation_id === rec.id) ||
        active.find(e => e.path_name && e.path_name === rec.path_name);

      // Promote this path to the user's primary focus, demote the others.
      const others = recs.filter(p => p.id !== rec.id && p.is_primary_focus);
      await Promise.all(others.map(p => base44.entities.PathRecommendations.update(p.id, { is_primary_focus: false })));
      await base44.entities.PathRecommendations.update(rec.id, {
        is_primary_focus: true,
        status: 'active',
        started_at: new Date().toISOString().split('T')[0],
      });

      if (match) {
        await base44.entities.Experiments.update(match.id, { status: 'in_progress' });
        navigate(`/experiments?experimentId=${match.id}`);
      } else {
        navigate(`/experiments/new?pathId=${encodeURIComponent(rec.id)}&pathName=${encodeURIComponent(rec.path_name || '')}`);
      }
    } catch {
      setStartError('Could not start this test. Please try again.');
      setStartingId(null);
    }
  };

  if (loading) return (
    <div className="grid min-h-screen place-items-center" style={{ background: 'var(--page-surface)' }}>
      <p className="text-[color:var(--ink-500)]">Loading your path recommendations...</p>
    </div>
  );

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: 'var(--page-surface)' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <LogoWordmark />
        </div>

        <div className="mb-3">
          <h1 className="font-heading mt-2 text-3xl font-bold tracking-tight text-[color:var(--surface-dark-900)]">Three paths worth testing.</h1>
          <p className="mt-3 text-sm text-[color:var(--ink-500)] max-w-xl">
            These are working hypotheses, not conclusions. None of them is objectively correct. Your job is to test the primary one and use what you learn to update your assessment.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {recs.map((r, i) => (
            <PathCard
              key={r.id}
              rec={r}
              index={i}
              onStart={() => handleStart(r)}
              starting={startingId === r.id}
              disabled={!!startingId}
            />
          ))}
        </div>

        {startError && <p className="mb-6 text-sm font-semibold text-red-600">{startError}</p>}

        {recs.length === 0 && (
          <div className="rounded-[20px] border border-dashed border-[color:var(--ink-200)] p-12 text-center text-[color:var(--ink-500)]">
            No path recommendations found. <Link to="/generating" style={{ color: 'var(--brand-navy-900)' }} className="font-semibold">Regenerate →</Link>
          </div>
        )}

        <div className="rounded-[20px] p-6" style={{ background: 'var(--surface-dark-700)', border: '1px solid rgba(31,58,95,0.3)' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--brand-navy-900)' }}>Your 30-day experiment plan is ready</p>
          <p className="text-sm text-[color:var(--ink-300)] mb-5">
            Pick a path above to start its 30-day test. You can compare all three from your dashboard first.
          </p>
          <Link to="/journey"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink-300)] transition hover:text-white">
            Open My Dashboard <ArrowRight size={15} />
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-[color:var(--ink-400)]">
          These recommendations will update each week based on your reflections and completed experiments.
        </p>
      </div>
    </main>
  );
}