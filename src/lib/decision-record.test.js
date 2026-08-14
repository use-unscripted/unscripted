import { describe, it, expect } from 'vitest';
import { buildChain, buildDecisionRecord, updateDirection, crossHypothesisEvidence } from '@/lib/decision-record';
import { buildExport } from '@/lib/decision-record-export';

const path = {
  id: 'p1',
  path_name: 'Healthcare Investment Banking',
  why_this_may_fit: 'Specialised niche with valuation work',
  fit_confidence_score: 30,
  hypothesis_status: 'testing',
  unresolved_questions: [{ question: 'Do you enjoy long analytical stretches?' }, { question: 'Do you like client pressure?' }],
};

const exp = (id, title, day) => ({
  id, title, path_id: 'p1', status: 'completed', test_question: `Q for ${title}`,
  created_date: `2026-0${day}-01 10:00:00`,
});

const update = (id, seq, expId, over) => ({
  id, path_id: 'p1', stage: 'update', sequence: seq, experiment_id: expId,
  experiment_title: `E${seq}`, confidence_before: 30, confidence_after: 55,
  confidence_label_before: 'Low', confidence_label_after: 'Moderate',
  strengthened_by: [{ text: 'You rated the analysis 9/10' }],
  remaining_unknowns: ['Do you like client pressure?'],
  decision: 'continue_testing', recorded_at: `2026-0${seq + 1}-02 10:00:00`, ...over,
});

const initialRow = {
  id: 'i1', path_id: 'p1', stage: 'initial', sequence: 0,
  hypothesis_statement: 'Specialised niche with valuation work',
  confidence_after: 20,
  remaining_unknowns: ['Do you enjoy long analytical stretches?', 'Do you like client pressure?'],
  recorded_at: '2026-01-01 10:00:00',
};

describe('updateDirection', () => {
  it('reads strengthened, weakened and mixed from the stored row', () => {
    expect(updateDirection({ strengthened_by: [{ text: 'a' }] })).toBe('strengthened');
    expect(updateDirection({ weakened_by: [{ text: 'a' }] })).toBe('weakened');
    expect(updateDirection({ strengthened_by: [{ text: 'a' }], weakened_by: [{ text: 'b' }] })).toBe('mixed');
    expect(updateDirection({ confidence_before: 40, confidence_after: 40 })).toBe('unchanged');
  });
});

describe('two experiments under one hypothesis', () => {
  const chain = buildChain({
    path,
    updates: [initialRow, update('u1', 1, 'e1'), update('u2', 2, 'e2', {
      weakened_by: [{ text: 'Client pressure drained you' }],
      strengthened_by: [],
      remaining_unknowns: ['Do you want this for ten years?'],
      confidence_label_after: 'Low',
      confidence_after: 25,
    })],
    experiments: [exp('e1', 'Comparable analysis', 2), exp('e2', 'Client call practice', 3)],
    missions: [{ id: 'm1', experiment_id: 'e1', title: 'Build the comp set' }],
    outreach: [{ id: 'o1', experiment_id: 'e2', name: 'Dana', role: 'VP', company: 'Bank' }],
    proof: [{ id: 'pr1', experiment_id: 'e1', title: 'Comp table', resume_status: 'approved' }],
    reflections: [],
    measurements: {
      e1: { expected_enjoyment: 6, actual_enjoyment: 9, enjoyment_expectation_delta: 3, post_completed_at: 'x', biggest_concern: 'the maths' },
    },
  });

  it('runs initial → experiment → update → experiment → update in order', () => {
    expect(chain.nodes.map(n => n.kind)).toEqual(['initial', 'experiment', 'update', 'experiment', 'update']);
    expect(chain.experimentCount).toBe(2);
    expect(chain.updateCount).toBe(2);
  });

  it('keeps the initial position exactly as recorded, not as later evidence suggests', () => {
    const first = chain.nodes[0];
    expect(first.confidence).toBe(20);
    expect(first.reconstructed).toBe(false);
    expect(first.unknowns).toHaveLength(2);
  });

  it('shows expectation, activity, evidence and reality on the experiment node', () => {
    const e = chain.nodes[1];
    expect(e.tested).toBe('Q for Comparable analysis');
    expect(e.expectation.join(' ')).toContain('Expected enjoyment 6/10');
    expect(e.activity.missions).toEqual(['Build the comp set']);
    expect(e.evidence[0]).toMatchObject({ title: 'Comp table', approved: true });
    expect(e.reality.join(' ')).toContain('More enjoyable than expected');
  });

  it('derives resolved and new unknowns from the difference between recorded states', () => {
    const u1 = chain.nodes[2];
    expect(u1.resolved).toEqual(['Do you enjoy long analytical stretches?']);
    expect(u1.newUnknowns).toEqual([]);
    const u2 = chain.nodes[4];
    expect(u2.direction).toBe('weakened');
    expect(u2.resolved).toEqual(['Do you like client pressure?']);
    expect(u2.newUnknowns).toEqual(['Do you want this for ten years?']);
    expect(chain.current.openUnknowns).toEqual(['Do you want this for ten years?']);
  });
});

describe('modified and eliminated hypotheses', () => {
  it('records a modification without touching the earlier position', () => {
    const chain = buildChain({
      path: { ...path, hypothesis_status: 'modified', hypothesis_modification_note: 'Try healthcare consulting instead' },
      updates: [initialRow, update('u1', 1, 'e1', { decision: 'modify_hypothesis' })],
      experiments: [exp('e1', 'Comparable analysis', 2)],
    });
    expect(chain.nodes[0].confidence).toBe(20);
    expect(chain.nodes[2].decisionLabel).toBe('Modify hypothesis');
    expect(chain.current.status).toBe('modified');
    expect(chain.current.modificationNote).toBe('Try healthcare consulting instead');
  });

  it('keeps an eliminated hypothesis and its evidence in the record', () => {
    const chain = buildChain({
      path: { ...path, hypothesis_status: 'eliminated' },
      updates: [initialRow, update('u1', 1, 'e1', { decision: 'eliminate_hypothesis', weakened_by: [{ text: 'Drained you twice' }], strengthened_by: [] })],
      experiments: [exp('e1', 'Comparable analysis', 2)],
      proof: [{ id: 'pr1', experiment_id: 'e1', title: 'Comp table' }],
    });
    expect(chain.current.decisionLabel).toBe('Eliminate hypothesis');
    expect(chain.nodes.find(n => n.kind === 'experiment').evidence).toHaveLength(1);
    expect(chain.nodes[0].statement).toBeTruthy();
  });
});

describe('legacy student with no recorded history', () => {
  const chain = buildChain({ path, updates: [], experiments: [exp('e1', 'Old experiment', 2)] });

  it('reconstructs the initial node from the hypothesis and says so', () => {
    expect(chain.nodes[0].reconstructed).toBe(true);
    expect(chain.nodes[0].confidence).toBe(30);
    expect(chain.hasHistory).toBe(false);
  });

  it('still shows the experiments and a current position', () => {
    expect(chain.experimentCount).toBe(1);
    expect(chain.current.status).toBe('testing');
    expect(chain.current.openUnknowns).toHaveLength(2);
  });
});

describe('cross-hypothesis evidence', () => {
  const dimensions = [
    {
      dimension: 'analytical_depth', dimension_label: 'Analytical depth', current_evidence_level: 'strong',
      statement: 'Consistent evidence suggests you are drawn to sustained analytical work.', evidence_count: 3,
      careers_observed_in: ['Banking', 'Consulting'],
      behavioral_evidence: [{ text: 'Rated highly after Comparable analysis', experiment_id: 'e1' }],
      contradictory_evidence: [],
    },
    {
      dimension: 'structured_environments', dimension_label: 'Structured environments', current_evidence_level: 'conflicting',
      statement: 'Pointed both ways.', evidence_count: 2, careers_observed_in: ['Banking'],
      behavioral_evidence: [{ text: 'Rated highly after A', experiment_id: 'e1' }],
      contradictory_evidence: [{ text: 'Rated low after B', experiment_id: 'e2' }],
    },
    {
      dimension: 'leadership', dimension_label: 'Leadership', current_evidence_level: 'unknown',
      statement: 'We still need to test this.', evidence_count: 0, careers_observed_in: [],
      behavioral_evidence: [], contradictory_evidence: [],
    },
  ];
  const cross = crossHypothesisEvidence(dimensions);

  it('separates confirmed, conflicting and untested, and keeps sources for tracing', () => {
    expect(cross.confirmed.map(c => c.label)).toEqual(['Analytical depth']);
    expect(cross.conflicting.map(c => c.label)).toEqual(['Structured environments']);
    expect(cross.open.map(c => c.label)).toEqual(['Leadership']);
    expect(cross.confirmed[0].sources[0].experiment_id).toBe('e1');
    expect(cross.experimentsBehind).toBe(2);
  });
});

describe('exports and privacy', () => {
  const record = buildDecisionRecord({
    paths: [path],
    experiments: [exp('e1', 'Comparable analysis', 2)],
    proof: [
      { id: 'pr1', experiment_id: 'e1', title: 'Comp table', resume_status: 'approved', approved_bullet: 'Built a comp set of six medtech names' },
      { id: 'pr2', experiment_id: 'e1', title: 'Private notes', resume_status: 'not_reviewed' },
    ],
    reflections: [{ id: 'r1', experiment_id: 'e1', lessons: 'SECRET REFLECTION TEXT' }],
    updates: [initialRow, update('u1', 1, 'e1', { student_correction: 'MY PRIVATE NOTE' })],
    profile: { baseline_career_clarity: 3, current_careers_considered: ['Banking'], major_uncertainties: ['Do I like the hours?'] },
    dimensions: [],
  });

  it('excludes private reflection writing and notes by default', () => {
    ['advisor', 'summary', 'portfolio'].forEach(key => {
      const text = buildExport(key, record, { proof: [] });
      expect(text).not.toContain('SECRET REFLECTION TEXT');
      expect(text).not.toContain('MY PRIVATE NOTE');
    });
  });

  it('includes the student\u2019s own notes only when they opt in', () => {
    const text = buildExport('portfolio', record, { includeReflections: true });
    expect(text).toContain('MY PRIVATE NOTE');
  });

  it('puts only approved work in the resume export', () => {
    const text = buildExport('resume', record, { proof: record ? [
      { title: 'Comp table', resume_status: 'approved', approved_bullet: 'Built a comp set of six medtech names' },
      { title: 'Private notes', resume_status: 'not_reviewed' },
    ] : [] });
    expect(text).toContain('Built a comp set of six medtech names');
    expect(text).not.toContain('Private notes');
  });

  it('carries the onboarding start into the advisor brief', () => {
    const text = buildExport('advisor', record, {});
    expect(text).toContain('Career clarity when I started: 3/10');
    expect(text).toContain('Do I like the hours?');
  });
});