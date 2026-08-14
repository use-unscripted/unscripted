/**
 * Persisting dimension evidence.
 *
 * One row per user per dimension, updated in place so the current picture is
 * cheap to read anywhere in the app. Nothing is destroyed by an update: the
 * observations themselves live on the experiments, measurements and reflections
 * they were read from, and each row keeps the full list of behavioural and
 * contradictory evidence with its source experiment attached.
 *
 * A row is only written when the dimension actually has something behind it, so
 * an untouched account does not acquire twenty-four "unknown" rows.
 */
import { base44 } from '@/api/base44Client';

const meaningful = (d) => d.current_evidence_level !== 'unknown' || d.evidence_count > 0;

const payload = (d) => ({
  dimension: d.dimension,
  dimension_label: d.dimension_label,
  current_evidence_level: d.current_evidence_level,
  direction: d.direction,
  self_reported_preference: d.self_reported_preference || null,
  self_report_source: d.self_report_source || null,
  behavioral_evidence_count: d.behavioral_evidence_count || 0,
  positive_evidence_count: d.positive_evidence_count || 0,
  negative_evidence_count: d.negative_evidence_count || 0,
  conflicting_evidence_count: d.conflicting_evidence_count || 0,
  current_interpretation: d.current_interpretation || null,
  next_test_priority: d.next_test_priority || 0,
  last_tested_at: d.last_tested_at || null,
  behavioral_evidence: d.behavioral_evidence,
  contradictory_evidence: d.contradictory_evidence,
  careers_observed_in: d.careers_observed_in,
  confidence: d.confidence,
  evidence_count: d.evidence_count,
  statement: d.statement,
  last_updated_at: new Date().toISOString(),
});

/** This student's stored rows, keyed by dimension. */
export async function loadDimensionEvidence() {
  const rows = await base44.entities.CareerDimensionEvidence.list('-last_updated_at', 200).catch(() => []);
  const out = {};
  (Array.isArray(rows) ? rows : []).forEach(r => { if (!out[r.dimension]) out[r.dimension] = r; });
  return out;
}

/**
 * Write the derived picture back. Returns the number of rows touched.
 * Only rows whose level, count or confidence actually moved are written.
 */
export async function syncDimensionEvidence(dimensions = []) {
  const existing = await loadDimensionEvidence();
  const creates = [];
  const updates = [];

  dimensions.filter(meaningful).forEach(d => {
    const row = existing[d.dimension];
    if (!row) { creates.push(payload(d)); return; }
    const changed = row.current_evidence_level !== d.current_evidence_level
      || (row.evidence_count || 0) !== d.evidence_count
      || (row.confidence || 0) !== d.confidence
      || (row.direction || 'none') !== d.direction
      || (row.next_test_priority || 0) !== (d.next_test_priority || 0)
      || (row.current_interpretation || null) !== (d.current_interpretation || null);
    if (changed) updates.push({ id: row.id, ...payload(d) });
  });

  if (creates.length) await base44.entities.CareerDimensionEvidence.bulkCreate(creates);
  if (updates.length) await base44.entities.CareerDimensionEvidence.bulkUpdate(updates);
  return creates.length + updates.length;
}