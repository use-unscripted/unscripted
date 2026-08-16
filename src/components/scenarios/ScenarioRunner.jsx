/**
 * A short run of scenarios: one per step, Step X of Y, Back and Continue.
 *
 * Two modes. Signed in, it loads this student's existing answers and saves each
 * one as it is given, updating the same row when they change their mind so one
 * scenario is still one signal. Given `answers`/`onAnswer` it stays controlled
 * and persists nothing, which is how the guest intake uses it.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import ScenarioCard from '@/components/scenarios/ScenarioCard';
import { loadResponses, byScenarioKey, saveAnswer } from '@/lib/scenarios/scenario-answers';
import { isPerformance } from '@/lib/scenarios/scenario-signals';

export default function ScenarioRunner({
  scenarios = [], context = {}, whyThis, answers, onAnswer, onComplete, doneLabel = 'Done',
}) {
  const controlled = typeof onAnswer === 'function';
  const [index, setIndex] = useState(0);
  const [local, setLocal] = useState({});          // scenario_key → option_id
  const [numbers, setNumbers] = useState({});      // scenario_key → number
  const [existing, setExisting] = useState({});    // scenario_key → stored row
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);

  // A returning student sees the answers they already gave, not a blank run.
  useEffect(() => {
    if (controlled) return;
    let alive = true;
    loadResponses().then(rows => {
      if (!alive) return;
      const map = byScenarioKey(rows);
      setExisting(map);
      const picked = {};
      const nums = {};
      Object.entries(map).forEach(([key, row]) => {
        if (row.selected_option_id) picked[key] = row.selected_option_id;
        if (Number.isFinite(row.numeric_answer)) nums[key] = row.numeric_answer;
      });
      setLocal(picked);
      setNumbers(nums);
    });
    return () => { alive = false; };
  }, [controlled]);

  const scenario = scenarios[index];
  const shownKey = scenario?.scenario_key;

  /* The scenario reached the screen. Its own fact: a stored answer only ever
     proved the ones students went on to answer, so a scenario people skipped
     was invisible. Deduped per scenario, so paging back does not re-count. */
  useEffect(() => {
    if (!shownKey || controlled) return;
    import('@/lib/analytics/decision-funnel-events')
      .then(m => m.scenarioShown({
        scenarioKey: shownKey,
        pathId: context.path_id,
        experimentId: context.experiment_id,
        stage: context.response_context,
      }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey, controlled]);

  if (!scenario) return null;

  const key = scenario.scenario_key;
  const chosen = controlled ? answers?.[key] : local[key];
  const numeric = numbers[key];
  const answered = isPerformance(scenario) && !(scenario.options || []).length
    ? Number.isFinite(numeric)
    : Boolean(chosen);

  const pick = (option) => {
    if (controlled) { onAnswer(key, option.id); return; }
    setLocal(p => ({ ...p, [key]: option.id }));
  };

  const next = async () => {
    if (!controlled) {
      setSaving(true);
      const option = (scenario.options || []).find(o => o.id === local[key]) || null;
      // Revising before the run finishes updates the same row rather than
      // adding a second signal for the same scenario.
      const row = await saveAnswer({
        scenario, option, context, numericAnswer: numbers[key], existing: existing[key],
      }).catch(() => null);
      if (row) setExisting(p => ({ ...p, [key]: row }));
      if (row) {
        import('@/lib/analytics/decision-funnel-events')
          .then(m => m.scenarioAnswered({
            scenarioKey: key,
            pathId: context.path_id,
            experimentId: context.experiment_id,
            stage: context.response_context,
          }))
          .catch(() => {});
      }
      setSaving(false);
    }
    if (index + 1 < scenarios.length) { setIndex(i => i + 1); return; }
    setFinished(true);
    onComplete?.();
  };

  if (finished) {
    return (
      <p className="tp-body inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--success-700)' }}>
        <Check size={16} /> Saved. These are early signals, not conclusions.
      </p>
    );
  }

  return (
    <div>
      {scenarios.length > 1 && (
        <p className="tp-meta mb-2 font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
          Step {index + 1} of {scenarios.length}
        </p>
      )}

      <ScenarioCard
        scenario={scenario}
        selectedOptionId={chosen}
        onSelect={pick}
        numericAnswer={numeric}
        onNumericAnswer={v => setNumbers(p => ({ ...p, [key]: v }))}
        seedKey={context.seed_key || ''}
        whyThis={whyThis}
        disabled={saving}
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex(i => i - 1)}
            className="app-cta-secondary tp-body font-bold"
            style={{ minHeight: '48px' }}
          >
            <ArrowLeft size={15} /> Back
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={!answered || saving}
          className="app-cta tp-body font-bold disabled:opacity-50"
          style={{ minHeight: '48px' }}
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {index + 1 < scenarios.length ? 'Continue' : doneLabel}
          {!saving && <ArrowRight size={15} />}
        </button>
      </div>
    </div>
  );
}