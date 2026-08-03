import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * These exist because a dropped import once made every path generation throw a
 * ReferenceError from inside the prompt template, and the whole suite stayed
 * green: nothing called the prompt builder. Lint and the bundler do not resolve
 * free identifiers either, so only running it catches this.
 */

const invoked = [];
let llmResponse;

const listResult = { StudentProfile: [], Schedule: [], PathRecommendations: [] };

vi.mock('@/api/base44Client', () => ({
  base44: {
    auth: { me: () => Promise.resolve({ id: 'u_1', primary_path: 'Marketing / brand' }) },
    integrations: { Core: { InvokeLLM: (args) => { invoked.push(args); return Promise.resolve(llmResponse); } } },
    entities: {
      StudentProfile: { list: () => Promise.resolve(listResult.StudentProfile) },
      Schedule: { list: () => Promise.resolve(listResult.Schedule) },
      PathRecommendations: {
        list: () => Promise.resolve(listResult.PathRecommendations),
        bulkCreate: (rows) => Promise.resolve(rows.map((r, i) => ({ ...r, id: `rec_${i}` }))),
        update: () => Promise.resolve({}),
        delete: () => Promise.resolve({}),
      },
      Experiments: {
        bulkCreate: (rows) => Promise.resolve(rows.map((r, i) => ({ ...r, id: `exp_${i}` }))),
        delete: () => Promise.resolve({}),
      },
      Roadmap: { create: (r) => Promise.resolve({ ...r, id: 'road_1' }), delete: () => Promise.resolve({}) },
      AmbitionProfile: { create: (r) => Promise.resolve({ ...r, id: 'amb_1' }), delete: () => Promise.resolve({}) },
    },
  },
}));

vi.mock('@/lib/path-set', () => ({
  loadOwnedPaths: () => Promise.resolve({ paths: [] }),
  authoritativeSet: () => null,
  loadOnboardingSubmission: () => Promise.resolve(null),
}));
vi.mock('@/lib/pilot-metrics', () => ({ trackPilotEvent: () => Promise.resolve(null) }));
vi.mock('@/lib/ai-failures', () => ({ logAiFailure: () => Promise.resolve(null) }));

const { generatePathTest, STAGES } = await import('./path-generator');

function rec(name) {
  return {
    path_name: name,
    fit_reason: 'It lines up with what you told us.',
    readiness_score: 5,
    confidence_level: 'medium',
    risk_level: 'low',
    current_gaps: [],
    path_fit_signals: [],
  };
}

function goodResponse() {
  return {
    path_recommendations: [rec('A'), rec('B'), rec('C')],
    experiments: [{ title: 'Interview two analysts', mission_steps: ['Find five people'] }],
    feasibility_note: 'Fine.',
    identity_statement: 'Testing.',
    archetype: 'Investigator',
  };
}

beforeEach(() => { invoked.length = 0; llmResponse = goodResponse(); });

describe('the prompt is actually built', () => {
  it('generates without throwing, which a missing binding in the template would prevent', async () => {
    const saved = await generatePathTest();
    expect(saved).toHaveLength(3);
    expect(invoked).toHaveLength(1);
  });

  it('states the readiness scale with real numbers, not undefined', async () => {
    await generatePathTest();
    const { prompt } = invoked[0];
    expect(prompt).toMatch(/0-10 scale/);
    expect(prompt).not.toMatch(/undefined/);
  });

  it('bounds the readiness score in the request schema too', async () => {
    await generatePathTest();
    const score = invoked[0].response_json_schema.properties.path_recommendations.items.properties.readiness_score;
    expect(score).toMatchObject({ minimum: 0, maximum: 10 });
  });

  it('asks for exactly three recommendations in the schema', async () => {
    await generatePathTest();
    const recs = invoked[0].response_json_schema.properties.path_recommendations;
    expect(recs).toMatchObject({ minItems: 3, maxItems: 3 });
  });
});

describe('the retry hands the reasons back', () => {
  it('asks a second time with the rejection reasons, then saves', async () => {
    let n = 0;
    llmResponse = undefined;
    const { base44 } = await import('@/api/base44Client');
    vi.spyOn(base44.integrations.Core, 'InvokeLLM').mockImplementation((args) => {
      invoked.push(args);
      n += 1;
      return Promise.resolve(n === 1
        ? { ...goodResponse(), path_recommendations: [rec('A'), rec('B')] }
        : goodResponse());
    });

    const saved = await generatePathTest();
    expect(invoked).toHaveLength(2);
    expect(invoked[0].prompt).not.toMatch(/rejected for these reasons/);
    expect(invoked[1].prompt).toMatch(/rejected for these reasons/);
    expect(saved).toHaveLength(3);
    vi.restoreAllMocks();
  });

  it('fails with the validate stage after both attempts are rejected', async () => {
    llmResponse = { ...goodResponse(), path_recommendations: [] };
    await expect(generatePathTest()).rejects.toMatchObject({ stage: STAGES.VALIDATE });
    expect(invoked).toHaveLength(2);
  });

  it('reports the model call itself failing as a different stage', async () => {
    const { base44 } = await import('@/api/base44Client');
    vi.spyOn(base44.integrations.Core, 'InvokeLLM').mockRejectedValue(new Error('network down'));
    await expect(generatePathTest()).rejects.toMatchObject({ stage: STAGES.INVOKE_LLM });
    vi.restoreAllMocks();
  });

  it('never puts a raw message in front of the student', async () => {
    const { base44 } = await import('@/api/base44Client');
    vi.spyOn(base44.integrations.Core, 'InvokeLLM')
      .mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:443'));
    await expect(generatePathTest()).rejects.toThrow(/could not reach the model/i);
    vi.restoreAllMocks();
  });
});
