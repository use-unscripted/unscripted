import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowRight, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';

const LABELS = ['Best apparent fit', 'Strong alternative', 'Contrarian option'];
const LABEL_STYLES = [
  { bg: '#EEF2F6', color: 'var(--brand-navy-900)' },
  { bg: '#EFF6FF', color: '#1D4ED8' },
  { bg: '#F1F5F9', color: '#475569' },
];

const CONFIDENCE_LABEL = { low: 'Low confidence', medium: 'Moderate confidence', high: 'High confidence' };
const CONFIDENCE_COLOR = { low: '#B45309', medium: '#1D4ED8', high: '#15803D' };

function ReadinessBar({ score }) {
  const pct = Math.min(100, Math.max(0, (score || 0) * 10));
  return (
    <div>
      <div className="flex justify-between text-xs text-[#64748B] mb-1">
        <span>Current readiness</span>
        <span className="font-bold">{score ? `${score}/10` : 'Not scored'}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--brand-navy-900)' }} />
      </div>
    </div>
  );
}

function PathCard({ rec, index }) {
  const [expanded, setExpanded] = useState(index === 0);
  const labelStyle = LABEL_STYLES[index] || LABEL_STYLES[2];

  return (
    <div className="rounded-[22px] border border-[#E2E8F0] bg-white overflow-hidden">
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
            <h3 className="font-heading text-xl font-bold text-[#050816]">{rec.path_name}</h3>
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
              <div className="rounded-xl p-4" style={{ background: '#F0FDF4', border: '1px solid rgba(21,128,61,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={14} style={{ color: '#15803D' }} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#15803D' }}>Why it may fit</p>
                </div>
                <p className="text-sm text-[#334155] leading-6">{rec.fit_reason}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: '#FFFBEB', border: '1px solid rgba(180,83,9,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} style={{ color: '#B45309' }} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#B45309' }}>Why it may not</p>
                </div>
                <p className="text-sm text-[#334155] leading-6">{rec.concern}</p>
              </div>
            </div>

            {rec.lifestyle_implications && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-1">Lifestyle implications</p>
                <p className="text-sm text-[#334155] leading-6">{rec.lifestyle_implications}</p>
              </div>
            )}
            {rec.main_tradeoffs && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-1">Main tradeoffs</p>
                <p className="text-sm text-[#334155] leading-6">{rec.main_tradeoffs}</p>
              </div>
            )}
            {rec.current_gaps?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2">Main skill gaps</p>
                <div className="flex flex-wrap gap-2">{rec.current_gaps.map((g, i) => (
                  <span key={i} className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-semibold text-[#334155]">{g}</span>
                ))}</div>
              </div>
            )}
            {rec.first_experiment && (
              <div className="rounded-xl p-4" style={{ background: '#EEF2F6', border: '1px solid rgba(31,58,95,0.15)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={13} style={{ color: 'var(--brand-navy-900)' }} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--brand-navy-900)' }}>One low-risk experiment to start</p>
                </div>
                <p className="text-sm text-[#334155]">{rec.first_experiment}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PathResults() {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.PathRecommendations.list('-created_date', 3).then(data => {
      setRecs(data.slice(0, 3));
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="grid min-h-screen place-items-center" style={{ background: '#FAFAF9' }}>
      <p className="text-[#64748B]">Loading your path recommendations...</p>
    </div>
  );

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: '#FAFAF9' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <LogoWordmark />
        </div>

        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: 'var(--brand-navy-900)' }}>Your path recommendations</p>
          <h1 className="font-heading mt-2 text-3xl font-bold tracking-tight text-[#050816]">Three paths worth testing.</h1>
          <p className="mt-3 text-sm text-[#64748B] max-w-xl">
            These are working hypotheses, not conclusions. None of them is objectively correct. Your job is to test the primary one and use what you learn to update your assessment.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {recs.map((r, i) => <PathCard key={r.id} rec={r} index={i} />)}
        </div>

        {recs.length === 0 && (
          <div className="rounded-[20px] border border-dashed border-[#E2E8F0] p-12 text-center text-[#64748B]">
            No path recommendations found. <Link to="/generating" style={{ color: 'var(--brand-navy-900)' }} className="font-semibold">Regenerate →</Link>
          </div>
        )}

        <div className="rounded-[20px] p-6" style={{ background: '#081225', border: '1px solid rgba(31,58,95,0.3)' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--brand-navy-900)' }}>Your 30-day experiment plan is ready</p>
          <p className="text-sm text-slate-300 mb-5">
            We've built 3 experiments for your primary path. Open your dashboard to see your first missions and schedule them into your week.
          </p>
          <Link to="/dashboard"
            className="inline-flex items-center gap-2 rounded-[10px] px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-px"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            Open My Dashboard <ArrowRight size={17} />
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-[#94A3B8]">
          These recommendations will update each week based on your reflections and completed experiments.
        </p>
      </div>
    </main>
  );
}