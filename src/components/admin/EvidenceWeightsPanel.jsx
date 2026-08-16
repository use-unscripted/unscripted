/**
 * The admin path for evidence weights and scenario pattern thresholds.
 *
 * Saving writes a NEW configuration version and retires the old one, because a
 * score already produced has to stay readable against the configuration it was
 * produced under. Nothing here rewrites a stored response.
 */
import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { EVIDENCE_TIERS } from '@/lib/scenarios/evidence-hierarchy';
import { DEFAULT_CONFIG, loadEvidenceConfig, saveEvidenceConfig } from '@/lib/evidence-weights';

const THRESHOLD_LABELS = {
  initial_signal_responses: 'Answers for an initial signal',
  some_responses: 'Answers for "some scenario evidence"',
  stronger_responses: 'Answers for "stronger scenario evidence"',
  stronger_distinct_scenarios: 'Distinct scenarios for "stronger"',
  stronger_moderate_signals: 'Moderate signals for "stronger"',
  contradiction_min_responses: 'Answers before a disagreement counts',
};

function NumberField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="tp-label block" style={{ color: 'var(--ink-500)' }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-3 py-2 text-sm"
      />
    </label>
  );
}

export default function EvidenceWeightsPanel() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    loadEvidenceConfig()
      .then(({ config: active }) => setConfig({
        source_weights: { ...DEFAULT_CONFIG.source_weights, ...active.source_weights },
        pattern_thresholds: { ...DEFAULT_CONFIG.pattern_thresholds, ...active.pattern_thresholds },
        config_version: active.config_version,
      }))
      .catch(() => setConfig({ ...DEFAULT_CONFIG }));
  }, []);

  if (!config) return null;

  const save = async () => {
    setSaving(true);
    setSaved('');
    const row = await saveEvidenceConfig({
      source_weights: config.source_weights,
      pattern_thresholds: config.pattern_thresholds,
      note: 'Updated from the decision intelligence dashboard.',
    }).catch(() => null);
    setSaving(false);
    setSaved(row ? `Saved as ${row.config_version}` : 'Could not save.');
  };

  return (
    <section className="app-card-flat p-5">
      <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>Evidence weights and thresholds</h2>
      <p className="tp-meta mt-1" style={{ color: 'var(--ink-500)' }}>
        Active configuration: {config.config_version}. Initial values, not scientific claims. Saving creates a new version;
        past scores keep the version they were produced under.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EVIDENCE_TIERS.map(t => (
          <NumberField
            key={t.id}
            label={t.label}
            value={config.source_weights[t.id]}
            onChange={v => setConfig(c => ({ ...c, source_weights: { ...c.source_weights, [t.id]: v } }))}
          />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.keys(config.pattern_thresholds).map(k => (
          <NumberField
            key={k}
            label={THRESHOLD_LABELS[k] || k}
            value={config.pattern_thresholds[k]}
            onChange={v => setConfig(c => ({ ...c, pattern_thresholds: { ...c.pattern_thresholds, [k]: v } }))}
          />
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-[var(--r-control)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--brand-navy-900)' }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save new version
        </button>
        {saved && <span className="tp-meta" style={{ color: 'var(--ink-500)' }}>{saved}</span>}
      </div>
    </section>
  );
}