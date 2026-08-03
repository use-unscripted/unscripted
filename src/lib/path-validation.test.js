import { describe, it, expect } from 'vitest';
import { validatePathSet, normalizeMissionStep, READINESS_MAX } from './path-validation';

/** A recommendation that passes everything, so each test can break one thing. */
function rec(overrides = {}) {
  return {
    path_name: 'Product Analyst at a Health Startup',
    fit_reason: 'Your stats coursework and your interest in health line up here.',
    concern: 'You have never worked with a real dataset under deadline.',
    lifestyle_implications: 'Office-based, collaborative, mostly predictable hours.',
    main_tradeoffs: 'Stability over autonomy in the first two years.',
    readiness_score: 6,
    confidence_level: 'medium',
    risk_level: 'low',
    current_gaps: ['SQL', 'A portfolio project'],
    first_experiment: 'Interview two analysts.',
    path_fit_signals: ['You rated impact highly.'],
    ...overrides,
  };
}

function exp(overrides = {}) {
  return {
    title: 'Interview two working product analysts',
    objective: 'Find out what the job is actually like day to day.',
    expected_learning: 'Whether the work matches what you imagined.',
    estimated_hours: 4,
    deliverable: 'Notes from both conversations.',
    completion_criteria: 'Both calls happened.',
    proof_required: 'Your notes.',
    mission_steps: [
      { order: 1, title: 'Find five analysts', description: 'Search alumni.', estimated_minutes: 20 },
    ],
    reflection_questions: ['What surprised you?'],
    common_mistakes: ['Asking only about salary.'],
    alternative_version: 'Interview one analyst and one manager.',
    ...overrides,
  };
}

function payload(overrides = {}) {
  return {
    path_recommendations: [
      rec(),
      rec({ path_name: 'Clinical Research Coordinator' }),
      rec({ path_name: 'Public Health Policy Analyst' }),
    ],
    experiments: [exp(), exp({ title: 'Shadow an analyst for a day' }), exp({ title: 'Build one dashboard' })],
    feasibility_note: 'Eight hours a week is enough for all three.',
    identity_statement: 'Someone testing whether analysis work fits.',
    archetype: 'Investigator',
    ...overrides,
  };
}

describe('validatePathSet: the happy path', () => {
  it('accepts a well-formed response and returns three recommendations', () => {
    const v = validatePathSet(payload());
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
    expect(v.data.path_recommendations).toHaveLength(3);
    expect(v.data.experiments).toHaveLength(3);
  });

  it('caps experiments at three even when the model returns more', () => {
    const v = validatePathSet(payload({
      experiments: [exp({ title: 'A' }), exp({ title: 'B' }), exp({ title: 'C' }), exp({ title: 'D' })],
    }));
    expect(v.ok).toBe(true);
    expect(v.data.experiments).toHaveLength(3);
  });
});

describe('validatePathSet: the three-path rule', () => {
  it('rejects two recommendations rather than saving an incomplete set', () => {
    const v = validatePathSet(payload({
      path_recommendations: [rec(), rec({ path_name: 'Clinical Research Coordinator' })],
    }));
    expect(v.ok).toBe(false);
    expect(v.data).toBeNull();
    expect(v.codes).toContain('recs_wrong_count');
  });

  it('rejects four recommendations', () => {
    const v = validatePathSet(payload({
      path_recommendations: [
        rec(), rec({ path_name: 'B' }), rec({ path_name: 'C' }), rec({ path_name: 'D' }),
      ],
    }));
    expect(v.ok).toBe(false);
    expect(v.codes).toContain('recs_wrong_count');
  });

  it('rejects recommendations returned as bare strings', () => {
    const v = validatePathSet(payload({
      path_recommendations: ['Product Analyst', 'Nurse', 'Teacher'],
    }));
    expect(v.ok).toBe(false);
    expect(v.codes).toContain('rec_malformed');
    // The prose reason has to name the shape, since the model never sees its
    // own previous output.
    expect(v.errors[0]).toMatch(/string/);
  });

  it('rejects a missing path_recommendations key outright', () => {
    const v = validatePathSet(payload({ path_recommendations: undefined }));
    expect(v.ok).toBe(false);
    expect(v.codes).toContain('recs_not_array');
  });

  it('rejects a non-object response', () => {
    for (const bad of [null, undefined, 'text', 42, []]) {
      const v = validatePathSet(bad);
      expect(v.ok).toBe(false);
      expect(v.codes).toContain('no_result');
    }
  });
});

describe('validatePathSet: required recommendation fields', () => {
  it('rejects a recommendation with no name', () => {
    const v = validatePathSet(payload({
      path_recommendations: [rec({ path_name: '   ' }), rec({ path_name: 'B' }), rec({ path_name: 'C' })],
    }));
    expect(v.ok).toBe(false);
    expect(v.codes).toContain('rec_missing_name');
  });

  it('rejects duplicate path names, ignoring case and padding', () => {
    const v = validatePathSet(payload({
      path_recommendations: [
        rec({ path_name: 'Product Analyst' }),
        rec({ path_name: '  product analyst  ' }),
        rec({ path_name: 'C' }),
      ],
    }));
    expect(v.ok).toBe(false);
    expect(v.codes).toContain('rec_duplicate_name');
  });

  it('rejects a recommendation with no fit_reason', () => {
    const v = validatePathSet(payload({
      path_recommendations: [rec({ fit_reason: '' }), rec({ path_name: 'B' }), rec({ path_name: 'C' })],
    }));
    expect(v.ok).toBe(false);
    expect(v.codes).toContain('rec_missing_fit_reason');
  });
});

describe('validatePathSet: readiness score', () => {
  it('rejects a score above the scale instead of writing it', () => {
    const v = validatePathSet(payload({
      path_recommendations: [rec({ readiness_score: 74 }), rec({ path_name: 'B' }), rec({ path_name: 'C' })],
    }));
    expect(v.ok).toBe(false);
    expect(v.codes).toContain('rec_score_out_of_range');
  });

  it('rejects a negative score', () => {
    const v = validatePathSet(payload({
      path_recommendations: [rec({ readiness_score: -1 }), rec({ path_name: 'B' }), rec({ path_name: 'C' })],
    }));
    expect(v.ok).toBe(false);
    expect(v.codes).toContain('rec_score_out_of_range');
  });

  it('rejects a non-numeric score', () => {
    const v = validatePathSet(payload({
      path_recommendations: [rec({ readiness_score: 'high' }), rec({ path_name: 'B' }), rec({ path_name: 'C' })],
    }));
    expect(v.ok).toBe(false);
    expect(v.codes).toContain('rec_score_missing');
  });

  it('accepts the ends of the scale', () => {
    const v = validatePathSet(payload({
      path_recommendations: [
        rec({ readiness_score: 0 }),
        rec({ path_name: 'B', readiness_score: READINESS_MAX }),
        rec({ path_name: 'C', readiness_score: 7.5 }),
      ],
    }));
    expect(v.ok).toBe(true);
  });

  it('accepts a numeric string and stores it as a number', () => {
    const v = validatePathSet(payload({
      path_recommendations: [rec({ readiness_score: '6' }), rec({ path_name: 'B' }), rec({ path_name: 'C' })],
    }));
    expect(v.ok).toBe(true);
    expect(v.data.path_recommendations[0].readiness_score).toBe(6);
  });
});

describe('validatePathSet: repairs that should not block a save', () => {
  it('defaults an unusable confidence or risk level to medium and warns', () => {
    const v = validatePathSet(payload({
      path_recommendations: [
        rec({ confidence_level: 'extremely high', risk_level: null }),
        rec({ path_name: 'B' }),
        rec({ path_name: 'C' }),
      ],
    }));
    expect(v.ok).toBe(true);
    expect(v.data.path_recommendations[0].confidence_level).toBe('medium');
    expect(v.data.path_recommendations[0].risk_level).toBe('medium');
    expect(v.warnings.length).toBeGreaterThan(0);
  });

  it('accepts levels in mixed case', () => {
    const v = validatePathSet(payload({
      path_recommendations: [rec({ risk_level: 'HIGH' }), rec({ path_name: 'B' }), rec({ path_name: 'C' })],
    }));
    expect(v.ok).toBe(true);
    expect(v.data.path_recommendations[0].risk_level).toBe('high');
  });

  it('replaces a non-array gaps list with an empty one', () => {
    const v = validatePathSet(payload({
      path_recommendations: [rec({ current_gaps: 'SQL' }), rec({ path_name: 'B' }), rec({ path_name: 'C' })],
    }));
    expect(v.ok).toBe(true);
    expect(v.data.path_recommendations[0].current_gaps).toEqual([]);
  });
});

describe('validatePathSet: mission steps', () => {
  it('converts steps returned as bare strings into step objects', () => {
    const v = validatePathSet(payload({
      experiments: [exp({ mission_steps: ['Find five analysts on LinkedIn', 'Send the email'] })],
    }));
    expect(v.ok).toBe(true);
    const steps = v.data.experiments[0].mission_steps;
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({
      order: 1,
      title: 'Find five analysts on LinkedIn',
      description: 'Find five analysts on LinkedIn',
      status: 'not_started',
    });
    expect(typeof steps[1].estimated_minutes).toBe('number');
    expect(v.warnings.join(' ')).toMatch(/plain text/);
  });

  it('never lets a string step become a character map', () => {
    const v = validatePathSet(payload({
      experiments: [exp({ mission_steps: ['Send the email'] })],
    }));
    const step = v.data.experiments[0].mission_steps[0];
    expect(Object.keys(step).sort()).toEqual(
      ['description', 'estimated_minutes', 'order', 'proof_required', 'status', 'title']
    );
  });

  it('drops steps that are neither text nor an object, and warns', () => {
    const v = validatePathSet(payload({
      experiments: [exp({ mission_steps: [null, 42, { title: 'Real step' }, []] })],
    }));
    expect(v.ok).toBe(true);
    expect(v.data.experiments[0].mission_steps).toHaveLength(1);
    expect(v.warnings.join(' ')).toMatch(/dropped/);
  });

  it('fills a missing title, description and time estimate', () => {
    const v = validatePathSet(payload({
      experiments: [exp({ mission_steps: [{ proof_required: 'A screenshot' }] })],
    }));
    const step = v.data.experiments[0].mission_steps[0];
    expect(step.title).toBe('Step 1');
    expect(step.description).toBe('Step 1');
    expect(step.estimated_minutes).toBe(30);
    expect(step.status).toBe('not_started');
  });

  it('renumbers steps by position so ordering never depends on the model', () => {
    const v = validatePathSet(payload({
      experiments: [exp({ mission_steps: ['a', 'b', 'c'] })],
    }));
    expect(v.data.experiments[0].mission_steps.map(s => s.order)).toEqual([1, 2, 3]);
  });

  it('treats a non-array mission_steps as empty rather than throwing', () => {
    const v = validatePathSet(payload({
      experiments: [exp({ mission_steps: 'Do the thing' })],
    }));
    expect(v.ok).toBe(true);
    expect(v.data.experiments[0].mission_steps).toEqual([]);
  });
});

describe('validatePathSet: experiments', () => {
  it('rejects an experiment with no title', () => {
    const v = validatePathSet(payload({ experiments: [exp({ title: '' })] }));
    expect(v.ok).toBe(false);
    expect(v.codes).toContain('experiment_missing_title');
  });

  it('rejects experiments returned as bare strings', () => {
    const v = validatePathSet(payload({ experiments: ['Interview two analysts'] }));
    expect(v.ok).toBe(false);
    expect(v.codes).toContain('experiment_malformed');
  });

  it('rejects an empty experiment list: three paths with nothing to run is a dead end', () => {
    const v = validatePathSet(payload({ experiments: [] }));
    expect(v.ok).toBe(false);
    expect(v.codes).toContain('experiments_empty');
  });

  it('saves with a warning when fewer than three experiments come back', () => {
    const v = validatePathSet(payload({ experiments: [exp()] }));
    expect(v.ok).toBe(true);
    expect(v.warnings.join(' ')).toMatch(/1 of 3/);
  });

  it('omits estimated_hours rather than writing a bad number', () => {
    const v = validatePathSet(payload({ experiments: [exp({ estimated_hours: 'about four' })] }));
    expect(v.ok).toBe(true);
    expect(v.data.experiments[0]).not.toHaveProperty('estimated_hours');
  });
});

describe('validatePathSet: the two error channels', () => {
  it('never puts generated text in a code, only in the prose reason', () => {
    const v = validatePathSet(payload({
      path_recommendations: [
        rec({ path_name: 'Product Analyst' }),
        rec({ path_name: 'Product Analyst' }),
        rec({ path_name: 'C' }),
      ],
    }));
    expect(v.ok).toBe(false);
    expect(v.codes.join(' ')).not.toMatch(/Product Analyst/);
    expect(v.errors.join(' ')).toMatch(/Product Analyst/);
  });

  it('leads the retry prompt with the cause, not the count symptom', () => {
    const v = validatePathSet(payload({
      path_recommendations: [rec({ path_name: '' }), rec({ path_name: 'B' }), rec({ path_name: 'C' })],
    }));
    expect(v.errors[0]).toMatch(/path_name/);
  });

  it('reports every problem at once so one retry can fix all of them', () => {
    const v = validatePathSet(payload({
      path_recommendations: [
        rec({ path_name: '' }),
        rec({ path_name: 'B', fit_reason: '' }),
        rec({ path_name: 'C', readiness_score: 99 }),
      ],
    }));
    expect(v.codes).toEqual(
      expect.arrayContaining(['rec_missing_name', 'rec_missing_fit_reason', 'rec_score_out_of_range'])
    );
  });
});

describe('normalizeMissionStep', () => {
  it('trims a string step', () => {
    expect(normalizeMissionStep('  Send the email  ', 0).title).toBe('Send the email');
  });

  it('keeps a usable order and time estimate from the model', () => {
    const step = normalizeMissionStep({ order: 4, title: 'X', estimated_minutes: 45 }, 0);
    expect(step.order).toBe(4);
    expect(step.estimated_minutes).toBe(45);
  });

  it('replaces a zero or negative time estimate with the default', () => {
    expect(normalizeMissionStep({ title: 'X', estimated_minutes: 0 }, 0).estimated_minutes).toBe(30);
    expect(normalizeMissionStep({ title: 'X', estimated_minutes: -5 }, 0).estimated_minutes).toBe(30);
  });

  it('falls back to the title when a description is missing', () => {
    expect(normalizeMissionStep({ title: 'Send the email' }, 0).description).toBe('Send the email');
  });
});
