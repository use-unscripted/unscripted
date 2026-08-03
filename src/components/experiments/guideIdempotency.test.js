import { describe, expect, it, vi } from 'vitest';
import { createGuideOnce, findByIdempotencyKey, newIdempotencyKey } from './guideIdempotency';

/**
 * A stand-in for `base44.entities.MissionGuides` that keeps its rows in an
 * array, so a test can ask the only question that matters: how many rows are
 * in the table when the dust settles?
 */
function fakeEntity({ loseResponseOnce = false } = {}) {
  const rows = [];
  let creates = 0;
  return {
    rows,
    get creates() { return creates; },
    async create(payload) {
      creates += 1;
      const row = { id: `row_${rows.length + 1}`, ...payload };
      rows.push(row);
      // The defect this file exists for: the row IS written, and the caller
      // never learns it. Indistinguishable from a create that never happened.
      if (loseResponseOnce && creates === 1) throw new Error('network error');
      return row;
    },
    async filter(query, _sort, limit) {
      const hits = rows.filter(r => Object.entries(query).every(([k, v]) => r[k] === v));
      return hits.slice(0, limit ?? hits.length);
    },
    async update(id, patch) {
      const row = rows.find(r => r.id === id);
      Object.assign(row, patch);
      return row;
    },
  };
}

const PAYLOAD = {
  experiment_id: 'exp_1',
  guide_title: 'Talk to two analysts',
  version_number: 3,
  status: 'active',
  is_active: true,
};

describe('the defect, reproduced', () => {
  // Proves the harness above really does model the bug: the pre-fix code path
  // was a bare create with nothing in front of it, and this is what it does.
  it('a bare create writes a SECOND row when the first response is lost', async () => {
    const entity = fakeEntity({ loseResponseOnce: true });

    await expect(entity.create({ ...PAYLOAD })).rejects.toThrow('network error');
    await entity.create({ ...PAYLOAD }); // the student clicks "try again"

    expect(entity.rows).toHaveLength(2);
    expect(entity.rows[0].version_number).toBe(entity.rows[1].version_number);
  });
});

describe('createGuideOnce', () => {
  it('a retry after a lost response yields ONE row, not two', async () => {
    const entity = fakeEntity({ loseResponseOnce: true });
    const key = newIdempotencyKey();

    await expect(createGuideOnce(entity, key, { ...PAYLOAD })).rejects.toThrow('network error');
    const retry = await createGuideOnce(entity, key, { ...PAYLOAD });

    expect(entity.rows).toHaveLength(1);
    expect(retry.adopted).toBe(true);
    expect(retry.row.id).toBe('row_1');
  });

  it('adopts an existing row without a second write', async () => {
    const entity = fakeEntity();
    const key = newIdempotencyKey();
    await createGuideOnce(entity, key, { ...PAYLOAD });

    const createSpy = vi.spyOn(entity, 'create');
    const again = await createGuideOnce(entity, key, { ...PAYLOAD });

    expect(createSpy).not.toHaveBeenCalled();
    expect(again.adopted).toBe(true);
    expect(entity.rows).toHaveLength(1);
  });

  it('a genuinely new generation still creates a new row', async () => {
    const entity = fakeEntity();
    await createGuideOnce(entity, newIdempotencyKey(), { ...PAYLOAD, version_number: 3 });
    const second = await createGuideOnce(entity, newIdempotencyKey(), { ...PAYLOAD, version_number: 4 });

    expect(entity.rows).toHaveLength(2);
    expect(second.adopted).toBe(false);
  });

  it('stamps the key on the created row', async () => {
    const entity = fakeEntity();
    const key = newIdempotencyKey();
    const { row } = await createGuideOnce(entity, key, { ...PAYLOAD });
    expect(row.idempotency_key).toBe(key);
  });

  it('overrides an idempotency_key carried in by a spread source guide', async () => {
    // Duplicate spreads the whole source row, key included.
    const entity = fakeEntity();
    const source = { ...PAYLOAD, idempotency_key: 'key-of-the-original' };
    const key = newIdempotencyKey();

    const { row } = await createGuideOnce(entity, key, { ...source });

    expect(row.idempotency_key).toBe(key);
    expect(entity.rows).toHaveLength(1);
  });

  it('does not adopt an unrelated row when the backend ignores the filter clause', async () => {
    const entity = fakeEntity();
    await createGuideOnce(entity, newIdempotencyKey(), { ...PAYLOAD });
    // A backend that does not know the field yet and hands back everything.
    entity.filter = async () => entity.rows;

    const { row, adopted } = await createGuideOnce(entity, newIdempotencyKey(), { ...PAYLOAD });

    expect(adopted).toBe(false);
    expect(row.id).toBe('row_2');
  });

  it('never filters on an empty key, and still creates', async () => {
    const entity = fakeEntity();
    const filterSpy = vi.spyOn(entity, 'filter');

    const { row, adopted } = await createGuideOnce(entity, '', { ...PAYLOAD });

    expect(filterSpy).not.toHaveBeenCalled();
    expect(adopted).toBe(false);
    expect(row.idempotency_key).toBeUndefined();
  });

  it('brings an adopted row in line with the choice the retry made', async () => {
    const entity = fakeEntity({ loseResponseOnce: true });
    const key = newIdempotencyKey();

    // First attempt: "make this the active guide" — lands, response lost.
    await expect(createGuideOnce(
      entity, key, { ...PAYLOAD, status: 'active', is_active: true },
      { reconcile: { status: 'active', is_active: true } },
    )).rejects.toThrow('network error');

    // Retry: the student changes their mind and saves it as a draft instead.
    const { row } = await createGuideOnce(
      entity, key, { ...PAYLOAD, status: 'draft', is_active: false },
      { reconcile: { status: 'draft', is_active: false } },
    );

    expect(entity.rows).toHaveLength(1);
    expect(row.status).toBe('draft');
    expect(row.is_active).toBe(false);
  });

  it('does not update an adopted row that already matches', async () => {
    const entity = fakeEntity();
    const key = newIdempotencyKey();
    await createGuideOnce(entity, key, { ...PAYLOAD }, { reconcile: { status: 'active', is_active: true } });

    const updateSpy = vi.spyOn(entity, 'update');
    await createGuideOnce(entity, key, { ...PAYLOAD }, { reconcile: { status: 'active', is_active: true } });

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('treats a failed reconcile as a save, not a failure', async () => {
    const entity = fakeEntity();
    const key = newIdempotencyKey();
    await createGuideOnce(entity, key, { ...PAYLOAD });
    entity.update = async () => { throw new Error('update failed'); };
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await createGuideOnce(
      entity, key, { ...PAYLOAD }, { reconcile: { status: 'draft', is_active: false } },
    );

    expect(result.adopted).toBe(true);
    expect(result.reconcileFailed).toBe(true);
    expect(result.row.id).toBe('row_1');
    quiet.mockRestore();
  });
});

describe('findByIdempotencyKey', () => {
  it('returns null for a falsy key without touching the backend', async () => {
    const entity = fakeEntity();
    const filterSpy = vi.spyOn(entity, 'filter');
    expect(await findByIdempotencyKey(entity, undefined)).toBeNull();
    expect(filterSpy).not.toHaveBeenCalled();
  });

  it('ignores legacy rows that carry no key at all', async () => {
    const entity = fakeEntity();
    entity.rows.push({ id: 'legacy_1', ...PAYLOAD });
    entity.filter = async () => entity.rows; // clause dropped by the backend
    expect(await findByIdempotencyKey(entity, newIdempotencyKey())).toBeNull();
  });
});

describe('newIdempotencyKey', () => {
  it('does not repeat itself', () => {
    const keys = new Set(Array.from({ length: 2000 }, newIdempotencyKey));
    expect(keys.size).toBe(2000);
  });

  it('looks like a uuid', () => {
    expect(newIdempotencyKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
