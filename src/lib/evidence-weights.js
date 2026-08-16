/**
 * The admin configuration path for evidence weights and pattern thresholds.
 *
 * The defaults live in evidence-hierarchy.js, which is the single scoring
 * authority — nothing here is a second scoring system. This module only loads the
 * active EvidenceWeightConfig row (if one exists) and hands it to
 * configureEvidence(), so the numbers can be tuned without a code change and
 * every change is versioned rather than silently retroactive.
 */
import { base44 } from '@/api/base44Client';
import {
  SCORING_VERSION,
  EVIDENCE_TIERS,
  PATTERN_THRESHOLDS,
  configureEvidence,
  evidenceConfig,
} from '@/lib/scenarios/evidence-hierarchy';

export const DEFAULT_CONFIG = {
  config_version: SCORING_VERSION,
  source_weights: Object.fromEntries(EVIDENCE_TIERS.map(t => [t.id, t.weight])),
  pattern_thresholds: { ...PATTERN_THRESHOLDS },
};

/** Load the active row and apply it. Falls back to the coded defaults. */
export async function loadEvidenceConfig() {
  const rows = await base44.entities.EvidenceWeightConfig.filter({ active: true }, '-updated_at', 1).catch(() => []);
  const row = (Array.isArray(rows) ? rows : [])[0];
  if (row) configureEvidence(row);
  return { row: row || null, config: evidenceConfig() };
}

/**
 * Save a new configuration. A new version is written rather than the old one
 * edited, and the previous row is deactivated, so a past score can always be
 * read against the configuration it was produced under.
 */
export async function saveEvidenceConfig({ source_weights, pattern_thresholds, note }) {
  const existing = await base44.entities.EvidenceWeightConfig.filter({ active: true }, '-updated_at', 5).catch(() => []);
  const version = `${SCORING_VERSION}+cfg-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-4)}`;
  const created = await base44.entities.EvidenceWeightConfig.create({
    config_version: version,
    active: true,
    note: note || null,
    source_weights,
    pattern_thresholds,
    updated_at: new Date().toISOString(),
  });
  await Promise.all((Array.isArray(existing) ? existing : [])
    .map(r => base44.entities.EvidenceWeightConfig.update(r.id, { active: false }).catch(() => null)));
  configureEvidence(created);
  return created;
}