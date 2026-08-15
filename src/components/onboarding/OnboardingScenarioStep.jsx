/**
 * The intake's scenarios: five short situations, one at a time, inside a single
 * intake question. Tapping an option moves to the next one, so this is five taps
 * rather than a questionnaire, and the last one hands back to the intake footer.
 *
 * Nothing here tells the student what any answer supposedly means, and no label
 * comes out the other end.
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import ScenarioCard from '@/components/scenarios/ScenarioCard';
import { ONBOARDING_SCENARIOS } from '@/lib/scenarios/scenario-library';

export default function OnboardingScenarioStep({ value = [], onChange }) {
  const answerFor = (key) => value.find(a => a.scenario_key === key)?.option_id || null;
  const firstUnanswered = ONBOARDING_SCENARIOS.findIndex(s => !answerFor(s.scenario_key));
  const [index, setIndex] = useState(firstUnanswered === -1 ? ONBOARDING_SCENARIOS.length - 1 : firstUnanswered);

  const scenario = ONBOARDING_SCENARIOS[index];

  const pick = (option) => {
    const rest = value.filter(a => a.scenario_key !== scenario.scenario_key);
    onChange([...rest, { scenario_key: scenario.scenario_key, option_id: option.id }]);
    if (index + 1 < ONBOARDING_SCENARIOS.length) setTimeout(() => setIndex(i => i + 1), 220);
  };

  return (
    <div>
      {/* Numbered dots double as Back: an answer can be revisited and changed,
          and the draft keeps one answer per scenario either way. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {ONBOARDING_SCENARIOS.map((s, i) => (
          <button
            key={s.scenario_key}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Scenario ${i + 1}`}
            className="inline-flex items-center gap-1 rounded-full border px-3 text-[12px] font-bold"
            style={{
              minHeight: '36px',
              borderColor: i === index ? 'var(--brand-navy-900)' : 'var(--ink-200)',
              background: i === index ? 'var(--brand-navy-900)' : 'var(--brand-white)',
              color: i === index ? '#fff' : 'var(--text-primary)',
            }}
          >
            {answerFor(s.scenario_key) && <Check size={12} />} {i + 1}
          </button>
        ))}
        <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>
          {value.length} of {ONBOARDING_SCENARIOS.length} answered
        </span>
      </div>

      <ScenarioCard
        scenario={scenario}
        selectedOptionId={answerFor(scenario.scenario_key)}
        onSelect={pick}
        seedKey="intake"
      />
    </div>
  );
}