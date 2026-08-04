import { describe, it, expect, vi, beforeEach } from 'vitest';

const logged = [];
vi.mock('@/lib/ai-failures', () => ({
  reportAiFailure: (feature, props) => { logged.push({ feature, ...props }); return Promise.resolve(null); },
}));

const { generateValidated, buildCorrection } = await import('./ai-generate');

const okResult = { ok: true, data: { fine: true }, errors: [], codes: [] };
const badResult = { ok: false, data: null, errors: ['Field X is required.'], codes: ['x_missing'] };

beforeEach(() => { logged.length = 0; });

describe('buildCorrection', () => {
  it('writes the reasons as instructions the model can act on', () => {
    const out = buildCorrection(['Field X is required.', 'Field Y must be a number.']);
    expect(out).toMatch(/rejected for these reasons/);
    expect(out).toMatch(/- Field X is required\./);
    expect(out).toMatch(/- Field Y must be a number\./);
    expect(out).toMatch(/Fix every one of them\./);
  });

  it('is empty when there is nothing to say, so a first attempt carries no noise', () => {
    expect(buildCorrection([])).toBe('');
    expect(buildCorrection()).toBe('');
  });

  it('caps the list so one bad response cannot flood the prompt', () => {
    const many = Array.from({ length: 500 }, (_, i) => `Problem ${i}`);
    const out = buildCorrection(many);
    expect(out.split('\n- ').length - 1).toBe(8);
  });
});

describe('generateValidated', () => {
  it('returns on the first attempt without a second call', async () => {
    const call = vi.fn().mockResolvedValue({});
    const r = await generateValidated({ feature: 'blueprint', model: 'm', call, validate: () => okResult });

    expect(call).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(1);
    expect(logged).toEqual([]);
  });

  it('hands the rejection reasons back on the retry', async () => {
    const call = vi.fn().mockResolvedValue({});
    let n = 0;
    await generateValidated({
      feature: 'blueprint', model: 'm', call,
      validate: () => (++n === 1 ? badResult : okResult),
    });

    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[0][0]).toBe('');
    expect(call.mock.calls[1][0]).toMatch(/Field X is required\./);
  });

  it('records a rejection that a retry then fixed, since the student never sees it', async () => {
    let n = 0;
    await generateValidated({
      feature: 'outreach_plan', model: 'gemini_3_1_pro',
      call: () => Promise.resolve({}),
      validate: () => (++n === 1 ? badResult : okResult),
    });

    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      feature: 'outreach_plan', stage: 'validate', recovered: true, attempts: 2,
    });
    expect(logged[0].codes).toEqual(['x_missing']);
  });

  it('gives up after the last attempt and records it as not recovered', async () => {
    const call = vi.fn().mockResolvedValue({});
    const r = await generateValidated({
      feature: 'blueprint', model: 'm', call, validate: () => badResult,
    });

    expect(call).toHaveBeenCalledTimes(2);
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(2);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ stage: 'validate', recovered: false, attempts: 2 });
  });

  it('honours a custom attempt count', async () => {
    const call = vi.fn().mockResolvedValue({});
    await generateValidated({ feature: 'blueprint', model: 'm', call, validate: () => badResult, attempts: 4 });
    expect(call).toHaveBeenCalledTimes(4);
  });

  it('separates a model call that threw from an answer that was rejected', async () => {
    const boom = new Error('network down');
    await expect(generateValidated({
      feature: 'blueprint', model: 'm',
      call: () => Promise.reject(boom),
      validate: () => okResult,
    })).rejects.toThrow('network down');

    expect(logged).toHaveLength(1);
    expect(logged[0].stage).toBe('invoke_llm');
    expect(logged[0].recovered).toBeUndefined();
  });

  it('never lets a rejection reason reach the log, only its code', async () => {
    await generateValidated({
      feature: 'blueprint', model: 'm',
      call: () => Promise.resolve({}),
      validate: () => ({
        ok: false,
        errors: ['"Digital Brand Strategist for Boutique Agencies" duplicates an earlier one.'],
        codes: ['rec_duplicate_name'],
      }),
    });

    const dumped = JSON.stringify(logged);
    expect(dumped).not.toMatch(/Digital Brand Strategist/);
    expect(dumped).toMatch(/rec_duplicate_name/);
  });

  it('survives a validator that returns nothing', async () => {
    const r = await generateValidated({
      feature: 'blueprint', model: 'm',
      call: () => Promise.resolve({}),
      validate: () => undefined,
    });
    expect(r.ok).toBe(false);
    expect(logged[0].codes).toEqual(['validator_returned_nothing']);
  });

  it('passes the ids through so a failure can be traced to a record', async () => {
    await generateValidated({
      feature: 'mission_guide_prefilled', model: 'm',
      context: { path_id: 'p_1', experiment_id: 'e_1' },
      call: () => Promise.resolve({}),
      validate: () => badResult,
    });
    expect(logged[0]).toMatchObject({ path_id: 'p_1', experiment_id: 'e_1' });
  });
});
