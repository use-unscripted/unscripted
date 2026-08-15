/**
 * Provenance for the Career Decision Matrix: for each score the page shows, the
 * records it was actually read from.
 *
 * This module is a PROJECTION of the already-scored row. It reads nothing, adds
 * nothing, and cannot cite a record the scorer did not use, so an explanation
 * can never name an experiment, conversation or reflection that does not exist.
 * Every source it returns carries a human-readable title and a date; database
 * ids are deliberately dropped on the way out, because an id explains nothing
 * to a student.
 *
 * The honest-state rule lives here too: when a metric has no traceable records
 * behind it, the panel says so rather than assembling a plausible-sounding
 * reason out of nothing.
 */

const INSUFFICIENT = 'We do not yet have enough traceable evidence to explain this score confidently.';

const dateOf = (v) => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? new Date(t) : null;
};

/** "12 Aug 2026", or nothing at all rather than a guessed date. */
export const humanDate = (v) => {
  const d = dateOf(v);
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
};

const newestFirst = (a, b) => (dateOf(b.date)?.getTime() || 0) - (dateOf(a.date)?.getTime() || 0);

/** A source line: what kind of record it is, what it is called, and when. */
const src = (kind, title, date, note) => (title ? { kind, title, date: date || null, note: note || null } : null);

const experimentSources = (rec) => rec.experiments.map(e =>
  src('Experiment', e.title, e.completed_at || e.deadline || e.created_date,
    e.status === 'completed' ? 'Completed' : e.status?.replace(/_/g, ' ')));

const measuredSources = (rec) => rec.measured.map(m =>
  src('Experiment check-in', m.experiment_title || 'An experiment', m.post_completed_at,
    m.pre_completed_at ? 'Rated before and after' : 'Rated afterwards'));

const proofSources = (rec) => rec.proof.map(p =>
  src('Evidence', p.title, p.completed_at || p.created_date, p.category?.replace(/_/g, ' ')));

const reflectionSources = (rec) => rec.reflections.map(r =>
  src('Reflection', r.is_experiment_conclusion ? 'Experiment reflection' : 'Weekly reflection',
    r.created_date || r.week_start));

const conversationSources = (row) => row.human.people.map(p =>
  src('Conversation', p.name, p.date, p.role || null));

const dimensionSources = (row) => (row.coverage.rows || [])
  .filter(r => r.current_evidence_level && r.current_evidence_level !== 'unknown')
  .map(r => src('Decision dimension', r.dimension_label, r.last_tested_at, r.current_interpretation));

/**
 * One line per record. Several signals can come out of the same experiment on
 * the same day, and listing that experiment three times reads as three separate
 * pieces of evidence, which would overstate what the student actually did.
 */
const compact = (list) => {
  const seen = new Set();
  return list.filter(Boolean).filter(s => {
    const key = `${s.kind}|${s.title}|${s.date || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort(newestFirst);
};

/** The records behind one metric. Never a superset: only what that score used. */
export function sourcesFor(row, metric) {
  const rec = row.records;
  if (metric === 'confidence') {
    return compact([...measuredSources(rec), ...proofSources(rec), ...reflectionSources(rec),
      ...conversationSources(row), ...dimensionSources(row)]);
  }
  if (metric === 'coverage' || metric === 'uncertainty') return compact(dimensionSources(row));
  if (metric === 'fit') return compact(measuredSources(rec));
  if (metric === 'expectation') {
    return compact(rec.measured.filter(m => m.pre_completed_at).map(m =>
      src('Expectation vs reality', m.experiment_title || 'An experiment', m.post_completed_at, 'Rated before and after')));
  }
  if (metric === 'human') return compact(conversationSources(row));
  if (metric === 'trend') {
    return compact((row.trend.points || []).map(p =>
      src('Path update', p.label, p.at, p.outcome ? p.outcome.replace(/_/g, ' ') : null)));
  }
  return compact([...experimentSources(rec), ...proofSources(rec)]);
}

const resolvedList = (row) => (row.coverage.tested || []).map(r => ({
  key: r.dimension, label: r.dimension_label, note: r.current_interpretation,
}));

const openList = (row) => (row.unknowns || []).map(u => ({ key: u.key, label: u.label, note: u.question }));

const pct = (v) => (typeof v === 'number' ? `${v}%` : null);

/**
 * Everything one metric panel needs. `sufficient` false means the panel shows
 * the honest state instead of an explanation.
 */
export function metricPanel(row, metric) {
  const sources = sourcesFor(row, metric);
  const base = { metric, hypothesis: row.name, sources, insufficientNote: INSUFFICIENT, resolved: [], open: [], lines: [] };

  if (metric === 'confidence') {
    const conf = row.confidence;
    return {
      ...base,
      title: `Why ${row.name} confidence is where it is`,
      current: pct(conf.value) || row.maturity.label,
      previous: pct(row.trend.to !== null && row.trend.from !== null ? row.trend.from : null),
      note: conf.value === null ? row.maturity.note : conf.basis,
      signals: conf.signals,
      strengthening: row.strengthening,
      weakening: row.weakening,
      resolved: resolvedList(row),
      open: openList(row),
      sufficient: sources.length > 0,
    };
  }

  if (metric === 'coverage') {
    return {
      ...base,
      title: `What has actually been tested for ${row.name}`,
      current: pct(row.coverage.value),
      note: 'Coverage counts the dimensions this direction turns on, weighted by how much each one matters here.',
      resolved: resolvedList(row),
      open: openList(row),
      sufficient: (row.coverage.rows || []).length > 0,
    };
  }

  if (metric === 'fit') {
    return {
      ...base,
      title: `How the work itself felt`,
      current: pct(row.fit.value),
      note: 'Only ratings you gave after doing the work count here. Nothing you predicted beforehand enters this score.',
      lines: row.fit.inputs.map(i => ({ label: i.label, value: `${i.raw}/10`, source: i.source })),
      sufficient: row.fit.inputs.length > 0,
    };
  }

  if (metric === 'expectation') {
    return {
      ...base,
      title: 'What you expected, and what happened',
      current: pct(row.expectation.value),
      note: row.expectation.available
        ? `From ${row.expectation.experiments} experiment${row.expectation.experiments === 1 ? '' : 's'} you rated both before and after.`
        : null,
      expectation: row.expectation,
      sufficient: row.expectation.available,
    };
  }

  if (metric === 'human') {
    return {
      ...base,
      title: 'Perspective from people doing the work',
      current: `${row.human.count} conversation${row.human.count === 1 ? '' : 's'}`,
      note: 'Only conversations with real people are counted here.',
      people: row.human.people,
      sufficient: row.human.people.length > 0,
    };
  }

  if (metric === 'uncertainty') {
    return {
      ...base,
      title: `What is still unknown about ${row.name}`,
      current: pct(row.uncertainty.value),
      note: 'Uncertainty is the share of what this direction turns on that you have not tested yet.',
      biggest: row.uncertainty.biggest,
      resolved: resolvedList(row),
      open: openList(row),
      sufficient: (row.coverage.rows || []).length > 0,
    };
  }

  // Trend
  const last = (row.trend.points || [])[row.trend.points.length - 1] || null;
  return {
    ...base,
    // With fewer than two recorded updates there is no movement to explain, so
    // the heading asks the question rather than asserting a direction.
    title: (row.trend.points || []).length >= 2
      ? `Why ${row.name} is ${row.trend.label.toLowerCase()}`
      : `How ${row.name} has moved`,
    current: pct(row.trend.to),
    previous: pct(row.trend.from),
    note: last?.change || null,
    strengthening: (last?.strengthened || []).map(s => ({ text: s.text || s, source: last.label })),
    weakening: (last?.weakened || []).map(s => ({ text: s.text || s, source: last.label })),
    sufficient: (row.trend.points || []).length >= 2,
  };
}

/**
 * Workstyle provenance: which experiences a dimension reading rests on, plus a
 * context note and the part of it that is still untested. Both notes are
 * derived from the stored records, never written by a model.
 */
export function workstyleProvenance(row) {
  const basedOn = compact([
    ...(row.behavioral || []).map(b => src(b.career_name || 'Experience', b.experiment_title || b.source || b.text, b.occurred_at, b.text)),
  ]);
  const contradicting = compact((row.contradictory || []).map(b =>
    src(b.career_name || 'Experience', b.experiment_title || b.source || b.text, b.occurred_at, b.text)));

  const careers = row.careers || [];
  const contextNote = basedOn.length
    ? careers.length > 1
      ? `Evidence for this came from more than one direction: ${careers.join(', ')}.`
      : careers.length === 1
        ? `All of this evidence came from one direction: ${careers[0]}. It has not been seen elsewhere yet.`
        : null
    : null;

  const remaining = contradicting.length
    ? 'Some experiences pointed the other way, so this reading is not settled.'
    : basedOn.length === 1
      ? 'This rests on a single experience, so it is an early signal rather than a pattern.'
      : ['unknown', 'mixed'].includes(row.levelKey)
        ? 'This has not been tested enough to read clearly yet.'
        : null;

  return {
    basedOn,
    contradicting,
    contextNote,
    remaining,
    selfReported: row.selfReported || null,
    sufficient: basedOn.length > 0,
    insufficientNote: INSUFFICIENT,
  };
}

export { INSUFFICIENT };
export default metricPanel;