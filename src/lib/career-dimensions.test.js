import { describe, it, expect } from 'vitest';
import {
  CAREER_DIMENSIONS, EVIDENCE_LEVELS, CONFIDENCE_CAP,
  levelFor, deriveDimensions, learningStatements, dimensionsForCareer,
} from './career-dimensions';

/** A rated characteristic signal, in the shape characteristicSignals returns. */
function signal(id, { enjoyment = [], energy = [], desire = [], experiments = [], label } = {}) {
  return {
    id,
    label: label || id,
    enjoyment, energy, desire, frustration: [],
    experiments,
    sources: experiments.map(e => ({ kind: 'experiment', detail: e.title, nodeId: `experiment:${e.id}` })),
    ratedCount: enjoyment.length || energy.length || desire.length,
  };
}

const exp = (id, title, career_name) => ({ id, title, career_name });

const find = (dims, id) => dims.find(d => d.dimension === id);

describe('the dimension catalogue', () => {
  it('covers the career decision dimensions without duplicating an id', () => {
    const ids = CAREER_DIMENSIONS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    ['analytical_depth', 'quantitative_intensity', 'ambiguity_tolerance', 'detail_orientation',
      'persuasion', 'client_interaction', 'teamwork', 'independent_work', 'creativity', 'leadership',
      'competition', 'high_pressure_pace', 'long_project_cycles', 'short_feedback_loops', 'autonomy',
      'structured_environments', 'risk_tolerance', 'building_orientation', 'research', 'writing',
      'presenting', 'operational_execution', 'mission_orientation'].forEach(id => {
      expect(ids).toContain(id);
    });
  });

  it('offers exactly the five evidence levels', () => {
    expect(EVIDENCE_LEVELS).toEqual(['unknown', 'weak', 'moderate', 'strong', 'conflicting']);
  });
});

describe('no single activity is definitive', () => {
  it('caps one glowing observation at weak evidence', () => {
    const dims = deriveDimensions({
      signals: [signal('ambiguity_tolerance', { enjoyment: [10], experiments: [exp('e1', 'Consulting case', 'Management Consulting')] })],
    });
    const d = find(dims, 'ambiguity_tolerance');
    expect(d.current_evidence_level).toBe('weak');
    expect(d.confidence).toBeLessThanOrEqual(CONFIDENCE_CAP.weak);
    expect(d.statement).toMatch(/^One experience suggests/);
  });

  it('never claims certainty in wording', () => {
    const dims = deriveDimensions({
      signals: [signal('analytical_intensity', {
        enjoyment: [9, 9], energy: [8],
        experiments: [exp('e1', 'Case study', 'Consulting'), exp('e2', 'Market model', 'Venture Capital')],
      })],
    });
    const d = find(dims, 'analytical_depth');
    expect(d.statement).toMatch(/suggests/);
    expect(d.statement).not.toMatch(/\bYou are\b/);
    expect(d.confidence).toBeLessThan(100);
  });

  it('reaches moderate on a second observation and strong only across two careers', () => {
    const twoOneCareer = deriveDimensions({
      signals: [signal('persuasion', { enjoyment: [8, 8, 9], experiments: [exp('e1', 'Pitch', 'Sales'), exp('e2', 'Pitch again', 'Sales'), exp('e3', 'Third', 'Sales')] })],
    });
    expect(find(twoOneCareer, 'persuasion').current_evidence_level).toBe('moderate');

    const across = deriveDimensions({
      signals: [signal('persuasion', { enjoyment: [8, 8, 9], experiments: [exp('e1', 'Pitch', 'Sales'), exp('e2', 'Client call', 'Consulting'), exp('e3', 'Fundraise', 'Startup')] })],
    });
    expect(find(across, 'persuasion').current_evidence_level).toBe('strong');
    expect(find(across, 'persuasion').confidence).toBeLessThanOrEqual(CONFIDENCE_CAP.strong);
  });

  it('treats a stated preference alone as weak, and marks it self-reported', () => {
    const dims = deriveDimensions({ signals: [], profile: { priority_autonomy: 5 } });
    const d = find(dims, 'autonomy');
    expect(d.current_evidence_level).toBe('weak');
    expect(d.self_reported_preference).toMatch(/your own direction/);
    expect(d.evidence_count).toBe(0);
  });
});

describe('contradictory evidence', () => {
  it('produces conflicting evidence rather than an average', () => {
    const dims = deriveDimensions({
      signals: [signal('pace', {
        enjoyment: [9, 2],
        experiments: [exp('e1', 'Trading floor day', 'Trading'), exp('e2', 'Deadline sprint', 'Consulting')],
      })],
    });
    const d = find(dims, 'high_pressure_pace');
    expect(d.current_evidence_level).toBe('conflicting');
    expect(d.direction).toBe('unclear');
    expect(d.statement).toMatch(/both ways/);
  });

  it('keeps the minority reading as contradictory evidence, with its source', () => {
    const dims = deriveDimensions({
      signals: [signal('teamwork', {
        enjoyment: [9, 8, 2],
        experiments: [exp('e1', 'Group case', 'Consulting'), exp('e2', 'Squad sprint', 'Product'), exp('e3', 'Committee work', 'Policy')],
      })],
    });
    const d = find(dims, 'teamwork');
    expect(d.current_evidence_level).toBe('conflicting');
    expect(d.behavioral_evidence.length).toBe(2);
    expect(d.contradictory_evidence.length).toBe(1);
    expect(d.contradictory_evidence[0].experiment_title).toBeTruthy();
  });

  it('leaves an untested dimension unknown rather than guessing', () => {
    const dims = deriveDimensions({ signals: [] });
    const d = find(dims, 'repetitive_precision');
    expect(d.current_evidence_level).toBe('unknown');
    expect(d.statement).toMatch(/still need to test/);
    expect(d.confidence).toBe(0);
  });

  it('never invents a level outside the five', () => {
    const dims = deriveDimensions({
      signals: [signal('creativity', { enjoyment: [7, 8], experiments: [exp('e1', 'A', 'X'), exp('e2', 'B', 'Y')] })],
      profile: { priority_creativity: 5 },
    });
    dims.forEach(d => expect(EVIDENCE_LEVELS).toContain(d.current_evidence_level));
  });
});

describe('levelFor', () => {
  it('is unknown with nothing behind it', () => {
    expect(levelFor({})).toBe('unknown');
  });
  it('never returns strong from a single observation', () => {
    expect(levelFor({ positives: 1, careers: 1 })).toBe('weak');
    expect(levelFor({ positives: 1, careers: 5 })).toBe('weak');
  });
  it('returns conflicting whenever both directions exist', () => {
    expect(levelFor({ positives: 6, negatives: 1, careers: 4 })).toBe('conflicting');
  });
});

describe('cross-career learning', () => {
  const dims = deriveDimensions({
    signals: [signal('ambiguity_tolerance', {
      enjoyment: [9, 8], energy: [8],
      experiments: [exp('e1', 'Consulting case sprint', 'Management Consulting'), exp('e2', 'Ambiguous brief', 'Management Consulting')],
    })],
  });

  const hypothesis = (variables) => ({ uncertainty: { variables } });

  it('lets a second hypothesis read a dimension tested on the first', () => {
    const view = dimensionsForCareer({
      hypothesis: hypothesis([{ variable: 'ambiguity_tolerance', relevance: 'high', label: 'Ambiguity tolerance' }]),
      dimensions: dims,
      careerName: 'Product Management',
    });
    const row = view.rows.find(r => r.dimension === 'ambiguity_tolerance');
    expect(row.current_evidence_level).not.toBe('unknown');
    expect(view.unknown.map(r => r.dimension)).not.toContain('ambiguity_tolerance');
  });

  it('marks transferred evidence and names the career it came from', () => {
    const view = dimensionsForCareer({
      hypothesis: hypothesis([{ variable: 'ambiguity_tolerance', relevance: 'high', label: 'Ambiguity tolerance' }]),
      dimensions: dims,
      careerName: 'Product Management',
    });
    const row = view.rows[0];
    expect(row.transferred).toBe(true);
    expect(row.transferred_from).toContain('Management Consulting');
    expect(row.transfer_note).toMatch(/may read differently here/);
  });

  it('does not mark evidence as transferred on the career it was learned on', () => {
    const view = dimensionsForCareer({
      hypothesis: hypothesis([{ variable: 'ambiguity_tolerance', relevance: 'high', label: 'Ambiguity tolerance' }]),
      dimensions: dims,
      careerName: 'Management Consulting',
    });
    expect(view.rows[0].transferred).toBe(false);
  });

  it('lists a hypothesis\u2019 untested dimensions as its unknowns', () => {
    const view = dimensionsForCareer({
      hypothesis: hypothesis([
        { variable: 'ambiguity_tolerance', relevance: 'high' },
        { variable: 'interpersonal', relevance: 'high' },
        { variable: 'teamwork', relevance: 'medium' },
      ]),
      dimensions: dims,
      careerName: 'Management Consulting',
    });
    expect(view.unknown.map(r => r.dimension)).toEqual(expect.arrayContaining(['client_interaction', 'teamwork']));
    expect(view.answered.map(r => r.dimension)).toContain('ambiguity_tolerance');
  });

  it('ignores dimensions that are irrelevant to the career', () => {
    const view = dimensionsForCareer({
      hypothesis: hypothesis([{ variable: 'ambiguity_tolerance', relevance: 'high' }, { variable: 'writing', relevance: 'low' }]),
      dimensions: dims,
      careerName: 'Management Consulting',
    });
    expect(view.rows.map(r => r.dimension)).not.toContain('writing');
  });
});

describe('what we are learning about you', () => {
  const dims = deriveDimensions({
    signals: [
      signal('analytical_intensity', { enjoyment: [9, 8], experiments: [exp('e1', 'Case', 'Consulting'), exp('e2', 'Model', 'VC')] }),
      signal('interpersonal', { enjoyment: [8], experiments: [exp('e3', 'Two interviews', 'Consulting')] }),
      signal('pace', { enjoyment: [9, 2], experiments: [exp('e4', 'Sprint', 'Consulting'), exp('e5', 'Trading day', 'Trading')] }),
    ],
  });

  it('separates what evidence supports, what is only suspected, and what is open', () => {
    const s = learningStatements(dims);
    expect(s.knowing.map(d => d.dimension)).toContain('analytical_depth');
    expect(s.suspecting.map(d => d.dimension)).toContain('client_interaction');
    expect(s.conflicting.map(d => d.dimension)).toContain('high_pressure_pace');
    expect(s.open.length).toBeGreaterThan(0);
    expect(s.open.every(d => d.current_evidence_level === 'unknown')).toBe(true);
  });

  it('keeps the source experiences attached so a conclusion can be inspected', () => {
    const d = find(dims, 'analytical_depth');
    expect(d.behavioral_evidence[0].experiment_title).toBeTruthy();
    expect(d.careers_observed_in.length).toBeGreaterThan(0);
    expect(d.sources.length).toBeGreaterThan(0);
  });
});