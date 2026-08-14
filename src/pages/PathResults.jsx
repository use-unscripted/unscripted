import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowRight, AlertTriangle, TrendingUp, Zap, Loader2, Rocket } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';
import { Sk, SkCards } from '@/components/PageSkeleton';

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
      <div className="tp-meta flex justify-between text-[color:var(--ink-500)] mb-1.5">
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
    <div className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="tp-meta rounded-full px-3 py-1 font-bold" style={labelStyle}>{rec.contrast_role || LABELS[index] || 'Hypothesis'}</span>
              {rec.confidence_level && (
                <span className="tp-meta font-semibold" style={{ color: CONFIDENCE_COLOR[rec.confidence_level] }}>
                  {CONFIDENCE_LABEL[rec.confidence_level]}
                </span>
              )}
            </div>
            <h3 className="tp-section text-[color:var(--surface-dark-900)]">{rec.path_name}</h3>
          </div>
          <button onClick={() => setExpanded(e => !e)}
            className="touch-reach tp-meta shrink-0 px-1 py-1 font-semibold transition hover:opacity-70" style={{ color: 'var(--brand-navy-900)' }}>
            {expanded ? 'Collapse' : 'See details'}
          </button>
        </div>

        {expanded && (
          <div className="space-y-4">
            <ReadinessBar score={rec.readiness_score} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[var(--r-control)] p-4" style={{ background: 'var(--success-50)', border: '1px solid rgba(21,128,61,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={14} style={{ color: 'var(--success-700)' }} />
                  <p className="tp-eyebrow" style={{ color: 'var(--success-700)' }}>Why it may fit</p>
                </div>
                <p className="tp-body text-[color:var(--ink-700)]">{rec.fit_reason}</p>
              </div>
              <div className="rounded-[var(--r-control)] p-4" style={{ background: 'var(--warning-50)', border: '1px solid rgba(180,83,9,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} style={{ color: 'var(--warning-700)' }} />
                  <p className="tp-eyebrow" style={{ color: 'var(--warning-700)' }}>Why it may not</p>
                </div>
                <p className="tp-body text-[color:var(--ink-700)]">{rec.concern}</p>
              </div>
            </div>

            {rec.lifestyle_implications && (
              <div>
                <p className="tp-eyebrow text-[color:var(--ink-500)] mb-1.5">Lifestyle implications</p>
                <p className="tp-prose text-[color:var(--ink-700)]">{rec.lifestyle_implications}</p>
              </div>
            )}
            {rec.main_tradeoffs && (
              <div>
                <p className="tp-eyebrow text-[color:var(--ink-500)] mb-1.5">Main tradeoffs</p>
                <p className="tp-prose text-[color:var(--ink-700)]">{rec.main_tradeoffs}</p>
              </div>
            )}
            {rec.what_we_know?.length > 0 && (
              <div>
                <p className="tp-eyebrow text-[color:var(--ink-500)] mb-1.5">What we know</p>
                <ul className="space-y-1">
                  {rec.what_we_know.map((k, i) => (
                    <li key={i} className="tp-body text-[color:var(--ink-700)]">· {k.text || k}</li>
                  ))}
                </ul>
              </div>
            )}
            {rec.unresolved_questions?.length > 0 && (
              <div className="rounded-[var(--r-control)] p-4" style={{ background: 'var(--ink-50)', border: '1px solid var(--border-light)' }}>
                <p className="tp-eyebrow text-[color:var(--ink-500)] mb-1.5">What we do not know yet</p>
                <ul className="space-y-1.5">
                  {rec.unresolved_questions.map((q, i) => (
                    <li key={i}>
                      <p className="tp-body font-semibold text-[color:var(--ink-700)]">{q.question}</p>
                      {q.why_it_matters && <p className="tp-meta text-[color:var(--ink-400)]">{q.why_it_matters}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {rec.assumptions?.length > 0 && (
              <div>
                <p className="tp-eyebrow text-[color:var(--ink-500)] mb-1.5">Assumptions being made</p>
                <ul className="space-y-1">
                  {rec.assumptions.map((a, i) => (
                    <li key={i} className="tp-body text-[color:var(--ink-700)]">· {a}</li>
                  ))}
                </ul>
              </div>
            )}
            {rec.confidence_explanation && (
              <div>
                <p className="tp-eyebrow text-[color:var(--ink-500)] mb-1.5">Why confidence is where it is</p>
                <p className="tp-prose text-[color:var(--ink-700)]">{rec.confidence_explanation}</p>
              </div>
            )}
            {rec.current_gaps?.length > 0 && (
              <div>
                <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Main skill gaps</p>
                <div className="flex flex-wrap gap-2">{rec.current_gaps.map((g, i) => (
                  <span key={i} className="tp-meta rounded-full border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-3 py-1 font-semibold text-[color:var(--ink-700)]">{g}</span>
                ))}</div>
              </div>
            )}
            {rec.first_experiment && (
              <div className="rounded-[var(--r-control)] p-4" style={{ background: 'var(--ink-100)', border: '1px solid rgba(31,58,95,0.15)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={13} style={{ color: 'var(--brand-navy-900)' }} />
                  <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-900)' }}>One low-risk experiment to start</p>
                </div>
                <p className="tp-prose text-[color:var(--ink-700)]">{rec.first_experiment}</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onStart}
          disabled={disabled}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}
        >
          {starting
            ? <><Loader2 size={16} className="animate-spin" /> Starting…</>
            : <><Rocket size={16} /> Test This Hypothesis</>}
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

  // Wordmark, heading, standfirst, three path cards: the shape of the page
  // this becomes. This is the first real screen a new student sees, so it is
  // the last place we want a bare centred sentence that then vanishes.
  if (loading) return (
    <main className="min-h-[100svh]" style={{ background: 'var(--page-surface)' }}>
      <div className="app-page">
        <div className="mb-8"><LogoWordmark /></div>
        <div className="mb-3">
          <div className="mt-2 flex h-9 items-center"><Sk h={30} w="64%" r={8} /></div>
          <div className="mt-3 max-w-xl">
            <div className="flex h-5 items-center"><Sk h={13} w="96%" r={5} /></div>
            <div className="flex h-5 items-center"><Sk h={13} w="88%" r={5} /></div>
            <div className="flex h-5 items-center"><Sk h={13} w="52%" r={5} /></div>
          </div>
        </div>
        <div className="mt-8"><SkCards count={3} h={232} gap={20} r={24} /></div>
      </div>
    </main>
  );

  return (
    <main className="min-h-[100svh]" style={{ background: 'var(--page-surface)' }}>
      <div className="app-page">
        <div className="mb-8">
          <LogoWordmark />
        </div>

        <div className="mb-3">
          <h1 className="tp-page mt-2 text-[color:var(--surface-dark-900)]">Three career hypotheses.</h1>
          <p className="tp-lead mt-3 text-[color:var(--ink-500)]">
            A career hypothesis is a direction worth testing, not a prediction of what you should become. Each one below says why it may fit, why it may not, and what only real experience can tell you.
          </p>
        </div>

        <div className="space-y-5 mb-8">
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

        {startError && <p className="tp-body mb-6 font-semibold text-red-600">{startError}</p>}

        {recs.length === 0 && (
          <div className="tp-body rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] p-12 text-center text-[color:var(--ink-500)]">
            No path recommendations found. <Link to="/generating" style={{ color: 'var(--brand-navy-900)' }} className="font-semibold">Regenerate →</Link>
          </div>
        )}

        <div className="rounded-[var(--r-surface)] p-6" style={{ background: 'var(--surface-dark-700)', border: '1px solid rgba(31,58,95,0.3)' }}>
          {/* Gold, not navy: navy-900 on this surface measures 1.63:1 and the
              label was effectively invisible. Same treatment as the dashboard's
              dark panel, which carries the same kind of label. */}
          <p className="tp-eyebrow mb-2.5" style={{ color: 'var(--brand-gold-500)' }}>Your 30-day experiment plan is ready</p>
          <p className="tp-prose text-[color:var(--ink-300)] mb-5">
            Pick a path above to start its 30-day test. You can compare all three from your dashboard first.
          </p>
          <Link to="/journey"
            className="touch-reach inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink-300)] transition hover:text-white">
            Open My Dashboard <ArrowRight size={15} />
          </Link>
        </div>

        <p className="tp-meta mt-6 text-center text-[color:var(--ink-400)]">
          These recommendations will update each week based on your reflections and completed experiments.
        </p>
      </div>
    </main>
  );
}