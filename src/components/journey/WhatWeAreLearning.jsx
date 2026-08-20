/**
 * "What we're learning about you" — the shared dimension evidence, in the
 * student's own words. Ticks are what evidence supports, question marks are what
 * still has to be tested, and every line opens the experiences behind it.
 *
 * Nothing here is a personality result. The wording is always "evidence
 * suggests", and a conclusion with one observation behind it says so.
 */
import { useEffect, useState } from 'react';
import { Check, HelpCircle, Scale, ChevronRight, MessageSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { loadMeasurements } from '@/lib/experiment-measurement';
import { dimensionsFromActivity, learningStatements, EVIDENCE_LEVEL_LABELS } from '@/lib/career-dimensions';
import { syncDimensionEvidence } from '@/lib/career-dimensions-store';
import DimensionInspector from '@/components/journey/DimensionInspector';
import { loadEvidenceConfig } from '@/lib/evidence-weights';
import { taskPerformance } from '@/lib/scenarios/scenario-performance';
import { Reveal } from '@/components/motion';

function Row({ icon, tone, dimension, onInspect }) {
  return (
    <button
      onClick={() => onInspect(dimension)}
      className="touch-target flex w-full items-start gap-2.5 rounded-[var(--r-control)] px-2 py-2 text-left hover:bg-[color:var(--ink-50)]"
    >
      <span className="mt-0.5 shrink-0" style={{ color: tone }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="tp-body block" style={{ color: 'var(--ink-700)' }}>
          {dimension.current_interpretation || dimension.statement}
        </span>
        <span className="tp-meta mt-0.5 block" style={{ color: 'var(--ink-400)' }}>
          {dimension.dimension_label} · {EVIDENCE_LEVEL_LABELS[dimension.current_evidence_level]}
          {dimension.evidence_count ? ` · ${dimension.evidence_count} observation${dimension.evidence_count === 1 ? '' : 's'}` : ''}
        </span>
      </span>
      <ChevronRight size={14} className="mt-1 shrink-0 text-[color:var(--ink-300)]" />
    </button>
  );
}

export default function WhatWeAreLearning() {
  const [state, setState] = useState(null);
  const [inspecting, setInspecting] = useState(null);
  const [scenarioResponses, setScenarioResponses] = useState([]);
  const [performance, setPerformance] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [exps, refs, profs, responses] = await Promise.all([
        base44.entities.Experiments.list('-created_date', 100).catch(() => []),
        base44.entities.WeeklyReflections.list('-created_date', 50).catch(() => []),
        base44.entities.StudentProfile.list('-created_date', 1).catch(() => []),
        base44.entities.ScenarioResponse.list('-completed_at', 200).catch(() => []),
      ]);
      // Any admin-tuned weights and thresholds, before anything is interpreted.
      await loadEvidenceConfig().catch(() => null);
      const measurements = await loadMeasurements().catch(() => ({}));
      const dimensions = dimensionsFromActivity({
        experiments: Array.isArray(exps) ? exps : [],
        measurements,
        reflections: Array.isArray(refs) ? refs : [],
        profile: (Array.isArray(profs) ? profs[0] : null) || {},
      });
      if (!alive) return;
      const rows = Array.isArray(responses) ? responses : [];
      setScenarioResponses(rows);
      setPerformance(taskPerformance(rows));
      setState(learningStatements(dimensions));
      // Keep the stored picture current so other screens read one shared answer.
      syncDimensionEvidence(dimensions).catch(() => null);
    })();
    return () => { alive = false; };
  }, []);

  if (!state) return null;
  const { knowing, suspecting, conflicting, stated = [], open } = state;
  if (!knowing.length && !suspecting.length && !conflicting.length && !stated.length && !open.length) return null;

  return (
    <Reveal y={20}>
      <section className="app-card p-6">
        <h2 className="tp-section" style={{ color: 'var(--surface-dark-900)' }}>What we&rsquo;re learning about you</h2>
        <p className="tp-meta mt-1.5" style={{ color: 'var(--ink-400)' }}>
Built from what you have done. Tap a line to see the evidence.
        </p>

        <div className="mt-4 space-y-0.5">
          {knowing.map(d => <Row key={d.dimension} dimension={d} onInspect={setInspecting} tone="var(--success-700)" icon={<Check size={15} />} />)}
          {suspecting.map(d => <Row key={d.dimension} dimension={d} onInspect={setInspecting} tone="var(--brand-navy-700)" icon={<Check size={15} />} />)}
          {conflicting.map(d => <Row key={d.dimension} dimension={d} onInspect={setInspecting} tone="var(--warning-700)" icon={<Scale size={15} />} />)}
          {/* Told us, not tested. Deliberately marked differently from anything
              you have shown us. */}
          {stated.map(d => <Row key={d.dimension} dimension={d} onInspect={setInspecting} tone="var(--brand-navy-700)" icon={<MessageSquare size={15} />} />)}
          {open.map(d => <Row key={d.dimension} dimension={d} onInspect={setInspecting} tone="var(--ink-400)" icon={<HelpCircle size={15} />} />)}
        </div>
      </section>

      {inspecting && (
        <DimensionInspector
          dimension={inspecting}
          responses={scenarioResponses}
          performance={performance}
          onClose={() => setInspecting(null)}
        />
      )}
    </Reveal>
  );
}