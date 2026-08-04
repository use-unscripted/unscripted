/**
 * The weekly nudge pass, tested by actually calling it.
 *
 * ## Why this file is shaped the way it is
 *
 * `base44/functions/campusEvents/entry.test.js` loads its function by cutting
 * `Deno.serve` off the end of the source, so the request handler in that file
 * is covered by nothing but a text match on how a variable is spelled. This one
 * does the opposite: it stubs `globalThis.Deno.serve`, catches the function the
 * module hands it, and calls that with a real `Request`. Every claim below
 * about what a request does was made by making the request.
 *
 * The module was written to make that possible: it exports `handleRequest` and
 * passes the export to `Deno.serve`, rather than serving an anonymous closure.
 * The first test asserts those are the same function, so the wiring cannot rot.
 *
 * ## How a Deno function loads under Node
 *
 * `entry.ts` imports the SDK by `npm:` specifier, which Node cannot resolve, and
 * imports three libraries by a path relative to itself, which does not survive
 * being written to a temp directory. The source is read, the SDK import is
 * swapped for a stub that reads a global, the relative specifiers are rewritten
 * to absolute file URLs, the TypeScript is stripped, and the result is imported.
 * Nothing in the deployed file changes to make this work.
 *
 * `loadEntry({ sendMode })` also rewrites the SEND_MODE constant, which is how
 * the 'all' mode behaviour is tested without ever shipping 'all'. There is a
 * test at the bottom that reads the file off disk and pins the value that
 * actually ships.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ENTRY_FILE = fileURLToPath(new URL('./entry.ts', import.meta.url));
const ENTRY_SOURCE = readFileSync(ENTRY_FILE, 'utf8');

let loads = 0;

async function loadEntry({ sendMode } = {}) {
  let source = ENTRY_SOURCE;

  source = source.replace(
    /^import \{ createClientFromRequest \}.*$/m,
    'const createClientFromRequest = (req) => globalThis.__nudgeTestClient(req);',
  );

  source = source.replace(
    /from '((?:\.\.\/)+src\/lib\/[\w.-]+\.js)'/g,
    (_, rel) => `from '${pathToFileURL(resolve(dirname(ENTRY_FILE), rel)).href}'`,
  );

  if (sendMode) {
    // Anchored to the start of a line on purpose. The block comment at the top
    // of entry.ts spells the constant out twice as the instruction for turning
    // sending on, and an unanchored replace edits the comment and leaves the
    // real declaration alone, which reads as every all-mode test passing.
    const before = source;
    source = source.replace(/^const SEND_MODE = '[a-z]+';/m, `const SEND_MODE = '${sendMode}';`);
    if (source === before) throw new Error('SEND_MODE is no longer a plain const, update this harness');
    if (!new RegExp(`^const SEND_MODE = '${sendMode}';`, 'm').test(source)) {
      throw new Error('SEND_MODE rewrite did not take, update this harness');
    }
  }

  if (!/\bDeno\.serve\(/.test(source)) throw new Error('entry.ts no longer calls Deno.serve, update this harness');

  const { code } = transformSync(source, { loader: 'ts', format: 'esm', target: 'node20' });
  const dir = mkdtempSync(join(tmpdir(), 'weekly-nudge-'));
  loads += 1;
  const out = join(dir, `entry-${loads}.mjs`);
  writeFileSync(out, code);

  let served = null;
  const realDeno = globalThis.Deno;
  globalThis.Deno = { serve: (fn) => { served = fn; return { finished: Promise.resolve() }; } };
  try {
    const mod = await import(pathToFileURL(out).href);
    return { served, handleRequest: mod.handleRequest };
  } finally {
    if (realDeno === undefined) delete globalThis.Deno;
    else globalThis.Deno = realDeno;
  }
}

const DAY = 86400000;
const at = (d) => new Date(Date.now() + d * DAY).toISOString();

const ALLOWED = 'drew.lynch1@student.fairfield.edu';

/**
 * A population where everybody has one experiment with no steps, which is the
 * 237-stall case and the one the live run is dominated by. `allowIndex` is the
 * student whose address is on the function's allowlist.
 */
function fixture(count, { allowIndex = 0 } = {}) {
  const User = [];
  const Experiments = [];
  for (let i = 0; i < count; i += 1) {
    const id = `u${String(i).padStart(3, '0')}`;
    User.push({
      id,
      email: i === allowIndex ? ALLOWED : `${id}@student.fairfield.edu`,
      full_name: `Student ${i}`,
      created_date: at(-40),
    });
    Experiments.push({
      id: `e${id}`, user_id: id, title: `Shadow an analyst ${i}`, status: 'planned', created_date: at(-30),
    });
  }
  return { User, Experiments };
}

const ADMIN = { id: 'admin1', role: 'admin', email: 'drew@useunscripted.com' };
const SERVICE = { id: 'svc', is_service: true };
const STUDENT = { id: 'u000', role: 'user', email: 'u000@student.fairfield.edu' };

/**
 * A stand in for the SDK client, recording everything the handler asks it to
 * do. `onSend` lets one address fail without touching the others.
 */
function stubClient({ caller = ADMIN, entities = {}, onSend } = {}) {
  const store = { created: [], updated: [], sent: [], listed: [] };
  const forEntity = (name) => ({
    list: async () => {
      store.listed.push(name);
      return entities[name] ? entities[name].map((r) => ({ ...r })) : [];
    },
    create: async (data) => {
      store.created.push({ entity: name, data });
      return { ...data, id: `created-${store.created.length}` };
    },
    update: async (id, data) => {
      store.updated.push({ entity: name, id, data });
      return { id, ...data };
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
      integrations: {
        Core: {
          SendEmail: async (params) => {
            if (onSend) await onSend(params);
            store.sent.push(params);
            return { success: true };
          },
        },
      },
    },
  };
  return { base44, store };
}

function request(body) {
  return body === undefined
    ? new Request('https://x.test/weeklyNudgePass', { method: 'POST' })
    : new Request('https://x.test/weeklyNudgePass', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
}

/** Load, call, and hand back the parsed body along with what the client saw. */
async function call(body, { sendMode, ...clientOptions } = {}) {
  const { served } = await loadEntry({ sendMode });
  const { base44, store } = stubClient(clientOptions);
  globalThis.__nudgeTestClient = () => base44;
  const response = await served(request(body));
  const json = await response.json();
  return { response, json, store };
}

beforeEach(() => {
  delete globalThis.__nudgeTestClient;
});

afterEach(() => {
  delete globalThis.__nudgeTestClient;
});

describe('the handler this file tests is the one that gets served', () => {
  it('hands Deno.serve the same function it exports', async () => {
    const { served, handleRequest } = await loadEntry();
    expect(typeof served).toBe('function');
    expect(served).toBe(handleRequest);
  });
});

describe('who is allowed to run a pass', () => {
  it('turns away a request with no session', async () => {
    const { response, json } = await call(undefined, { caller: null });
    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('turns away a signed in student', async () => {
    const { response, json, store } = await call(undefined, {
      caller: STUDENT, entities: fixture(3),
    });
    expect(response.status).toBe(403);
    expect(json.error).toBe('Forbidden');
    // And it read nobody's records on the way to saying no.
    expect(store.listed).toEqual([]);
  });

  it('lets an admin through', async () => {
    const { response } = await call(undefined, { entities: fixture(3) });
    expect(response.status).toBe(200);
  });

  it('lets the scheduled service caller through', async () => {
    const { response, json } = await call({ dryRun: true }, { caller: SERVICE, entities: fixture(3) });
    expect(response.status).toBe(200);
    expect(json.counts.asked).toBe(3);
  });
});

describe('a request with nothing in it changes nothing', () => {
  it('writes no row, sends no email, and says so', async () => {
    const { json, store } = await call(undefined, { entities: fixture(5) });
    expect(json.dry_run).toBe(true);
    expect(json.mode).toBe('allowlist');
    expect(store.created).toEqual([]);
    expect(store.updated).toEqual([]);
    expect(store.sent).toEqual([]);
    expect(json.counts.asked).toBe(5);
    expect(json.students.every((l) => l.decision !== 'asked' || l.delivery === 'dry_run')).toBe(true);
  });

  it('still does the whole read and the whole plan, so a dry run is worth reading', async () => {
    const { json, store } = await call(undefined, { entities: fixture(5) });
    expect(store.listed).toContain('User');
    expect(store.listed).toContain('StudentNudge');
    expect(store.listed).toContain('PathRecommendations');
    const asked = json.students.filter((l) => l.decision === 'asked');
    expect(asked).toHaveLength(5);
    expect(asked[0].kind).toBe('experiment_without_guide');
    expect(asked[0].rung).toBe(0);
    expect(asked[0].subject.length).toBeGreaterThan(0);
  });

  it('treats dryRun false with no confirmation as a dry run', async () => {
    // The safety property that does not depend on the mode at all: leaving dry
    // run takes a literal string, not a boolean somebody flipped in a hurry.
    const { json, store } = await call({ dryRun: false }, { entities: fixture(5) });
    expect(json.dry_run).toBe(true);
    expect(store.created).toEqual([]);
    expect(store.sent).toEqual([]);
  });

  it('treats a wrong confirmation string as a dry run', async () => {
    const { json, store } = await call({ dryRun: false, confirm: 'yes' }, { entities: fixture(5) });
    expect(json.dry_run).toBe(true);
    expect(store.sent).toEqual([]);
  });

  it('treats the string "false" as a dry run, because it is not false', async () => {
    const { json, store } = await call(
      { dryRun: 'false', confirm: 'SEND-FOR-REAL' }, { entities: fixture(5) },
    );
    expect(json.dry_run).toBe(true);
    expect(store.sent).toEqual([]);
  });
});

describe('allowlist mode, on a live run', () => {
  const live = { dryRun: false, confirm: 'SEND-FOR-REAL' };

  it('emails the one allowed address and suppresses every other student', async () => {
    const { json, store } = await call(live, { entities: fixture(6) });

    expect(json.dry_run).toBe(false);
    expect(store.sent).toHaveLength(1);
    expect(store.sent[0].to).toBe(ALLOWED);
    expect(json.counts.emailed).toBe(1);
    expect(json.counts.suppressed).toBe(5);

    const emailed = json.students.filter((l) => l.delivery === 'emailed');
    expect(emailed).toHaveLength(1);
    expect(emailed[0].userId).toBe('u000');
    expect(json.students.filter((l) => l.delivery === 'suppressed')).toHaveLength(5);
  });

  it('sends a real subject and a real body, not a placeholder', async () => {
    const { store } = await call(live, { entities: fixture(2) });
    const [mail] = store.sent;
    expect(mail.subject).toContain('Get the steps for');
    expect(mail.body.startsWith('Hi Student,')).toBe(true);
    expect(mail.body).toContain('https://useunscripted.base44.app/experiment?experimentId=eu000');
    expect(mail.body).toContain('reply with the word stop');
  });

  it('writes a nudge row for everybody it planned, emailed or not', async () => {
    const { store } = await call(live, { entities: fixture(6) });
    const nudges = store.created.filter((c) => c.entity === 'StudentNudge');
    expect(nudges).toHaveLength(6);
    expect(nudges.every((n) => n.data.status === 'pending')).toBe(true);
    expect(nudges.every((n) => n.data.delivered_channel === 'none')).toBe(true);
  });

  it('marks the row it actually delivered, and only that one', async () => {
    const { store } = await call(live, { entities: fixture(6) });
    const delivered = store.updated.filter((u) => u.data.delivered_channel === 'email');
    expect(delivered).toHaveLength(1);
    expect(delivered[0].data.delivered_at.length).toBeGreaterThan(0);
  });

  it('expires the asks that were never answered', async () => {
    const entities = fixture(2);
    entities.StudentNudge = [{
      id: 'stale1', user_id: 'u001', stall_kind: 'experiment_without_guide', subject_id: 'eu001',
      rung: 0, rung_key: 'experiment_without_guide.r0', size: 'large', action_kind: 'generate_guide',
      status: 'pending', delivered_at: at(-30), deletion_status: 'active',
    }];
    const { json, store } = await call(live, { entities });
    expect(store.updated).toContainEqual({ entity: 'StudentNudge', id: 'stale1', data: { status: 'expired' } });
    expect(json.counts.expired_marked).toBe(1);
  });

  it('reaches only the named student when onlyUserId is used', async () => {
    const { json, store } = await call({ ...live, onlyUserId: 'u003' }, { entities: fixture(6) });
    expect(json.counts.users).toBe(1);
    expect(store.created).toHaveLength(1);
    expect(store.created[0].data.user_id).toBe('u003');
    // u003 is not the allowlisted address, so nothing left the building.
    expect(store.sent).toEqual([]);
  });
});

describe('all mode', () => {
  const asAll = { sendMode: 'all' };

  it('sends nothing without the confirmation string, even with the mode flipped', async () => {
    const { json, store } = await call(
      { dryRun: false, confirm: 'SEND-FOR-REAL' },
      { ...asAll, entities: fixture(6) },
    );
    expect(json.mode).toBe('all');
    expect(json.dry_run).toBe(false);
    expect(store.sent).toEqual([]);
    expect(json.counts.suppressed).toBe(6);
  });

  it('sends to everybody once both halves are given', async () => {
    const { json, store } = await call(
      { dryRun: false, confirm: 'SEND-TO-ALL-STUDENTS' },
      { ...asAll, entities: fixture(6) },
    );
    expect(store.sent).toHaveLength(6);
    expect(json.counts.emailed).toBe(6);
    expect(new Set(store.sent.map((m) => m.to)).size).toBe(6);
  });

  it('stops at the per run cap however many students qualify', async () => {
    const { json, store } = await call(
      { dryRun: false, confirm: 'SEND-TO-ALL-STUDENTS' },
      { ...asAll, entities: fixture(82) },
    );
    expect(json.counts.users).toBe(82);
    expect(store.sent).toHaveLength(25);
    expect(json.send_cap).toBe(25);
  });

  it('will not let a caller raise the cap', async () => {
    const { json, store } = await call(
      { dryRun: false, confirm: 'SEND-TO-ALL-STUDENTS', limit: 500 },
      { ...asAll, entities: fixture(82) },
    );
    expect(json.send_cap).toBe(25);
    expect(store.sent).toHaveLength(25);
  });

  it('lets a caller lower it', async () => {
    const { store } = await call(
      { dryRun: false, confirm: 'SEND-TO-ALL-STUDENTS', limit: 3 },
      { ...asAll, entities: fixture(82) },
    );
    expect(store.sent).toHaveLength(3);
  });

  it('carries on when one address blows up', async () => {
    const { json, store } = await call(
      { dryRun: false, confirm: 'SEND-TO-ALL-STUDENTS' },
      {
        ...asAll,
        entities: fixture(4),
        onSend: async ({ to }) => {
          if (to === 'u002@student.fairfield.edu') throw new Error('550 mailbox unavailable');
        },
      },
    );
    expect(store.sent).toHaveLength(3);
    expect(json.counts.emailed).toBe(3);
    expect(json.counts.failed).toBe(1);
    expect(json.students.find((l) => l.userId === 'u002').delivery).toBe('failed');
    expect(json.success).toBe(true);
  });
});

describe('off mode', () => {
  it('writes and sends nothing even on a fully confirmed live request', async () => {
    const { json, store } = await call(
      { dryRun: false, confirm: 'SEND-TO-ALL-STUDENTS' },
      { sendMode: 'off', entities: fixture(6) },
    );
    expect(json.mode).toBe('off');
    expect(json.dry_run).toBe(true);
    expect(store.created).toEqual([]);
    expect(store.sent).toEqual([]);
  });
});

describe('the state this function is shipping in', () => {
  it('ships in allowlist mode with one address on the list', () => {
    // Behaviour above is tested against a rewritten copy, so this is the line
    // that pins what a merge actually deploys.
    expect(ENTRY_SOURCE).toContain("const SEND_MODE = 'allowlist';");
    expect(ENTRY_SOURCE).toContain("const ALLOWLIST = ['drew.lynch1@student.fairfield.edu'];");
    expect(ENTRY_SOURCE).toContain('const MAX_SENDS_PER_RUN = 25;');
  });

  it('is scheduled with dryRun true', () => {
    const workflow = readFileSync(
      fileURLToPath(new URL('../../workflows/WeeklyNudgePass.jsonc', import.meta.url)),
      'utf8',
    );
    const parsed = JSON.parse(workflow);
    const step = parsed.definition.do[0].run_pass;
    expect(step.with.function_name).toBe('weeklyNudgePass');
    expect(step.with.args).toEqual({ dryRun: true });
  });
});
