import { describe, it, expect, vi, beforeEach } from 'vitest';

const created = [];
let meResult = { id: 'u_1' };
let createThrows = false;

vi.mock('@/api/base44Client', () => ({
  base44: {
    auth: { me: () => (meResult ? Promise.resolve(meResult) : Promise.reject(new Error('signed out'))) },
    entities: {
      AiFailure: {
        create: (row) => {
          if (createThrows) return Promise.reject(new Error('write refused'));
          created.push(row);
          return Promise.resolve({ id: 'f_1', ...row });
        },
      },
    },
  },
}));

const { logAiFailure, AI_FEATURES } = await import('./ai-failures');

beforeEach(() => {
  created.length = 0;
  meResult = { id: 'u_1' };
  createThrows = false;
});

describe('what the failure log is allowed to store', () => {
  it('writes the diagnostics it was given', async () => {
    await logAiFailure('path_generation', {
      stage: 'validate',
      codes: ['rec_missing_name', 'recs_wrong_count'],
      attempts: 2,
      recovered: false,
      model: 'gemini_3_1_pro',
      path_id: 'p_abc',
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      user_id: 'u_1',
      feature: 'path_generation',
      stage: 'validate',
      codes: ['rec_missing_name', 'recs_wrong_count'],
      attempts: 2,
      recovered: false,
      model: 'gemini_3_1_pro',
      path_id: 'p_abc',
      reviewed: false,
    });
  });

  // This is the guarantee the whole table rests on. If a call site one day
  // passes an error message or a generated path name, it must not land here.
  it('refuses any code that is not a slug, whatever the caller passes', async () => {
    await logAiFailure('path_generation', {
      stage: 'Failed to save: user Drew Lynch at Fairfield',
      codes: [
        'Digital Brand Strategist for Boutique Agencies',
        'ok_code',
        'Error: connect ECONNREFUSED 10.0.0.1:443',
        'student@fairfield.edu',
        'has spaces',
        'HasCapitals',
      ],
    });

    const row = created[0];
    expect(row.stage).toBe('unknown');
    expect(row.codes).toEqual([
      'unslugged_value', 'ok_code', 'unslugged_value',
      'unslugged_value', 'unslugged_value', 'unslugged_value',
    ]);

    const dumped = JSON.stringify(row);
    expect(dumped).not.toMatch(/Drew Lynch/);
    expect(dumped).not.toMatch(/Boutique Agencies/);
    expect(dumped).not.toMatch(/fairfield\.edu/);
    expect(dumped).not.toMatch(/ECONNREFUSED/);
  });

  it('caps how many codes one row can hold', async () => {
    await logAiFailure('path_generation', {
      codes: Array.from({ length: 200 }, (_, i) => `code_${i}`),
    });
    expect(created[0].codes).toHaveLength(8);
  });

  it('drops an id that does not look like an id', async () => {
    await logAiFailure('path_generation', {
      path_id: 'Digital Brand Strategist for Boutique Agencies',
      experiment_id: 'e_valid-1',
    });
    expect(created[0].path_id).toBeUndefined();
    expect(created[0].experiment_id).toBe('e_valid-1');
  });

  it('drops a nonsense attempt count rather than writing it', async () => {
    for (const bad of [NaN, Infinity, -1, 99999, 'two', null]) {
      created.length = 0;
      await logAiFailure('path_generation', { attempts: bad });
      expect(created[0].attempts).toBe(1);
    }
  });

  it('only records a known feature', async () => {
    await logAiFailure('something_we_made_up', { stage: 'validate' });
    expect(created).toHaveLength(0);
  });

  it('covers every feature in the exported list', async () => {
    for (const feature of AI_FEATURES) {
      created.length = 0;
      await logAiFailure(feature, {});
      expect(created).toHaveLength(1);
    }
  });
});

describe('logging never breaks the thing it is watching', () => {
  it('returns null instead of throwing when the write is refused', async () => {
    createThrows = true;
    await expect(logAiFailure('path_generation', { stage: 'validate' })).resolves.toBeNull();
  });

  it('records nothing for a signed-out visitor and does not throw', async () => {
    meResult = null;
    await expect(logAiFailure('path_generation', {})).resolves.toBeNull();
    expect(created).toHaveLength(0);
  });

  it('survives being called with nothing at all', async () => {
    await expect(logAiFailure()).resolves.toBeNull();
    await expect(logAiFailure('path_generation')).resolves.toBeTruthy();
  });
});
