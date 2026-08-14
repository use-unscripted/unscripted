/**
 * The nightly purge, tested by actually calling it.
 *
 * Loaded the same way `base44/functions/weeklyNudgePass/entry.test.js` loads
 * its function: the source is read off disk, the `npm:` SDK import is swapped
 * for a stub that reads a global, the TypeScript is stripped, and the module is
 * imported with `Deno.serve` replaced by a collector that keeps the handler.
 * The handler is then called with a real `Request`. Nothing in the deployed
 * file changes to make this work.
 *
 * The test that matters most is the last one. The bug this file was written for
 * was not a broken purge, it was a correct purge pointed at five of the six
 * tables a student can delete from, so MissionGuides rows sat past their purge
 * date with nothing scheduled to ever look at them. A behaviour test would not
 * have caught that, because the code was right for every table it was given.
 * So the list is derived from the frontend instead: every entity that gets
 * `softDeletePayload` written to it has to appear in ENTITY_NAMES.
 *
 * No test here touches real data. The client is a stub and every "delete" is a
 * push onto an array.
 */
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ENTRY_FILE = fileURLToPath(new URL('./entry.ts', import.meta.url));
const ENTRY_SOURCE = readFileSync(ENTRY_FILE, 'utf8');
const SRC_DIR = resolve(ENTRY_FILE, '../../../../src');

let loads = 0;

async function loadEntry() {
  let source = ENTRY_SOURCE;

  source = source.replace(
    /^import \{ createClientFromRequest \}.*$/m,
    'const createClientFromRequest = (req) => globalThis.__purgeTestClient(req);',
  );

  if (!/\bDeno\.serve\(/.test(source)) throw new Error('entry.ts no longer calls Deno.serve, update this harness');

  const { code } = transformSync(source, { loader: 'ts', format: 'esm', target: 'node20' });
  const dir = mkdtempSync(join(tmpdir(), 'purge-deleted-'));
  loads += 1;
  const out = join(dir, `entry-${loads}.mjs`);
  writeFileSync(out, code);

  let served = null;
  const realDeno = globalThis.Deno;
  globalThis.Deno = { serve: (fn) => { served = fn; return { finished: Promise.resolve() }; } };
  try {
    await import(pathToFileURL(out).href);
    return served;
  } finally {
    if (realDeno === undefined) delete globalThis.Deno;
    else globalThis.Deno = realDeno;
  }
}

const DAY = 86400000;
const at = (d) => new Date(Date.now() + d * DAY).toISOString();

const ADMIN = { id: 'admin1', role: 'admin', email: 'drew@useunscripted.com' };
const SERVICE = { id: 'svc', is_service: true };
const STUDENT = { id: 'u000', role: 'user', email: 'u000@student.fairfield.edu' };

/** A row that is past its purge date and should not survive a run. */
const expired = (id) => ({ id, deletion_status: 'deleted', deleted_at: at(-31), purge_at: at(-1) });
/** Soft deleted yesterday, so it has 29 days of restore left. */
const stillRestorable = (id) => ({ id, deletion_status: 'deleted', deleted_at: at(-1), purge_at: at(29) });

/**
 * A stand in for the SDK client, recording every write. `failWrites` lets one
 * record fail without touching the others, `failReads` lets one table fail.
 */
function stubClient({ caller = ADMIN, entities = {}, failReads = [], failWrites = [] } = {}) {
  const store = { filtered: [], updated: [], deleted: [] };
  const forEntity = (name) => ({
    filter: async (query, sort, limit) => {
      store.filtered.push({ entity: name, query, sort, limit });
      if (failReads.includes(name)) throw new Error(`503 reading ${name}`);
      return (entities[name] || []).map((r) => ({ ...r }));
    },
    update: async (id, data) => {
      if (failWrites.includes(id)) throw new Error(`503 updating ${id}`);
      store.updated.push({ entity: name, id, data });
      return { id, ...data };
    },
    delete: async (id) => {
      if (failWrites.includes(id)) throw new Error(`503 deleting ${id}`);
      store.deleted.push({ entity: name, id });
      return { id };
    },
  });

  const base44 = {
    auth: {
      me: async () => {
        if (!caller) throw new Error('no session on this request');
        return caller;
      },
    },
    asServiceRole: {
      entities: new Proxy({}, { get: (_t, name) => forEntity(String(name)) }),
    },
  };
  return { base44, store };
}

async function call(clientOptions = {}) {
  const served = await loadEntry();
  const { base44, store } = stubClient(clientOptions);
  globalThis.__purgeTestClient = () => base44;
  const response = await served(new Request('https://x.test/purgeDeletedRecords', { method: 'POST' }));
  const json = await response.json();
  return { response, json, store };
}

beforeEach(() => { delete globalThis.__purgeTestClient; });
afterEach(() => { delete globalThis.__purgeTestClient; });

describe('who is allowed to run a purge', () => {
  it('turns away a request with no session', async () => {
    const { response, json, store } = await call({ caller: null });
    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
    expect(store.filtered).toEqual([]);
  });

  it('turns away a signed in student without reading a single table', async () => {
    const { response, json, store } = await call({
      caller: STUDENT,
      entities: { MissionGuides: [expired('g1')] },
    });
    expect(response.status).toBe(403);
    expect(json.error).toBe('Forbidden');
    expect(store.filtered).toEqual([]);
    expect(store.deleted).toEqual([]);
  });

  it('lets the scheduled service caller through', async () => {
    const { response } = await call({ caller: SERVICE });
    expect(response.status).toBe(200);
  });
});

describe('mission guides', () => {
  it('purges a soft deleted guide whose purge date has passed', async () => {
    const { json, store } = await call({ entities: { MissionGuides: [expired('g1')] } });

    expect(store.updated).toContainEqual({
      entity: 'MissionGuides', id: 'g1', data: { deletion_status: 'permanently_deleted' },
    });
    expect(store.deleted).toContainEqual({ entity: 'MissionGuides', id: 'g1' });
    expect(json.details).toContainEqual({ entity: 'MissionGuides', deleted: 1, failed: 0 });
    expect(json.total_deleted).toBe(1);
  });

  it('leaves a guide that is still inside its restore window alone', async () => {
    const { json, store } = await call({ entities: { MissionGuides: [stillRestorable('g2')] } });

    expect(store.updated).toEqual([]);
    expect(store.deleted).toEqual([]);
    expect(json.details).toContainEqual({ entity: 'MissionGuides', deleted: 0, failed: 0 });
  });

  it('reads guides with the same query and the same cap as every other table', async () => {
    const { store } = await call({ entities: { MissionGuides: [expired('g1')] } });
    const reads = store.filtered.filter((r) => r.entity === 'MissionGuides');
    expect(reads).toHaveLength(1);
    const others = store.filtered.filter((r) => r.entity !== 'MissionGuides');
    expect(others.length).toBeGreaterThan(0);
    for (const other of others) {
      expect(reads[0].query).toEqual(other.query);
      expect(reads[0].sort).toEqual(other.sort);
      expect(reads[0].limit).toEqual(other.limit);
    }
    expect(reads[0].query).toEqual({ deletion_status: 'deleted' });
  });

  it('keeps going when a guide fails, and reports it', async () => {
    const { json, store } = await call({
      entities: { MissionGuides: [expired('g1'), expired('g2')] },
      failWrites: ['g1'],
    });
    expect(store.deleted).toEqual([{ entity: 'MissionGuides', id: 'g2' }]);
    expect(json.details).toContainEqual({ entity: 'MissionGuides', deleted: 1, failed: 1 });
    expect(json.total_failed).toBe(1);
  });

  it('does not stop the other tables when the guides table cannot be read', async () => {
    const { json } = await call({
      entities: { MissionGuides: [expired('g1')], Experiments: [expired('e1')] },
      failReads: ['MissionGuides'],
    });
    expect(json.details).toContainEqual({ entity: 'MissionGuides', deleted: 0, failed: 1 });
    expect(json.details).toContainEqual({ entity: 'Experiments', deleted: 1, failed: 0 });
  });
});

/**
 * Walks src/ and returns every entity name that has softDeletePayload written
 * into it, by finding each `base44.entities.X.update(` and looking at the call
 * that follows it. Both shapes in the app are covered: the payload passed on
 * its own, and the payload spread into an object with a field beside it.
 */
function entitiesTheAppSoftDeletes() {
  const found = new Set();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.jsx?$/.test(name) || /\.test\.jsx?$/.test(name)) continue;
      const source = readFileSync(full, 'utf8');
      if (!source.includes('softDeletePayload(')) continue;
      for (const match of source.matchAll(/base44\.entities\.(\w+)\.update\(/g)) {
        if (source.slice(match.index, match.index + 250).includes('softDeletePayload(')) {
          found.add(match[1]);
        }
      }
    }
  };
  walk(SRC_DIR);
  return found;
}

describe('the list of tables the purge opens', () => {
  it('found the frontend soft deletes at all', () => {
    // If this drops to nothing the check below passes for the wrong reason.
    expect(entitiesTheAppSoftDeletes().size).toBeGreaterThanOrEqual(6);
  });

  it('covers every entity the app soft deletes', async () => {
    const soft = entitiesTheAppSoftDeletes();
    const { store } = await call({ caller: SERVICE });
    const opened = new Set(store.filtered.map((r) => r.entity));
    const missing = [...soft].filter((name) => !opened.has(name));
    expect(missing).toEqual([]);
  });

  it('opens MissionGuides, which it did not until this was fixed', async () => {
    const { store } = await call({ caller: SERVICE });
    expect(store.filtered.map((r) => r.entity)).toContain('MissionGuides');
  });
});
