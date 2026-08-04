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
 * imports two shared libraries by a path relative to itself, which does not
 * survive being written to a temp directory. The source is read, the SDK import
 * is swapped for a stub that reads a global, the relative specifiers are
 * rewritten to absolute file URLs, the TypeScript is stripped, and the result is
 * imported. Nothing in the deployed file changes to make this work.
 *
 * Those two libraries live in `base44/shared/`, which is the only directory
 * besides its own that ships with a function. `src/lib` holds a re-export of
 * each one for the frontend.
 *
 * `loadEntry` also rewrites three things in the source, each so a behaviour can
 * be reached that the shipping constants put out of reach:
 *
 *   sendMode   the SEND_MODE constant, which is how 'all' mode is tested
 *              without ever shipping 'all'
 *   page       the PAGE size, so a three row fixture can fill a page and prove
 *              the partial read guard fires
 *   planStub   the planner itself, so the guard that checks the plan against
 *              the send cap can be made to fire, which a correct planner never
 *              does
 *
 * There are tests at the bottom that read the file off disk and pin the values
 * that actually ship.
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

async function loadEntry({ sendMode, page, planStub } = {}) {
  let source = ENTRY_SOURCE;

  source = source.replace(
    /^import \{ createClientFromRequest \}.*$/m,
    'const createClientFromRequest = (req) => globalThis.__nudgeTestClient(req);',
  );

  source = source.replace(
    /from '((?:\.\.\/)+shared\/[\w.-]+\.js)'/g,
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

  if (page) {
    const before = source;
    source = source.replace(/^const PAGE = \d+;/m, `const PAGE = ${page};`);
    if (source === before) throw new Error('PAGE is no longer a plain const, update this harness');
  }

  if (planStub) {
    // The planner applies the cap itself, so the only way to reach the line
    // that checks its answer against the cap is to hand the function a planner
    // that gets it wrong. Everything else in the module stays as written.
    const before = source;
    source = source.replace(
      /^import \{ planPass, (.*) \} from '([^']+)';$/m,
      (_, rest, spec) => `import { ${rest} } from '${spec}';\n`
        + 'const planPass = (...args) => globalThis.__nudgeTestPlan(...args);',
    );
    if (source === before) throw new Error('the planner import moved, update this harness');
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
function stubClient({
  caller = ADMIN, entities = {}, onSend, failReads = [],
} = {}) {
  const store = { created: [], updated: [], sent: [], listed: [] };
  const forEntity = (name) => ({
    list: async () => {
      store.listed.push(name);
      if (failReads.includes(name)) throw new Error(`503 reading ${name}`);
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
  if (body === undefined) return new Request('https://x.test/weeklyNudgePass', { method: 'POST' });
  // A string is sent as it stands, so a test can post something that is not
  // JSON at all. Anything else is stringified.
  return new Request('https://x.test/weeklyNudgePass', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Load, call, and hand back the parsed body along with what the client saw. */
async function call(body, {
  sendMode, page, plan, ...clientOptions
} = {}) {
  const { served } = await loadEntry({ sendMode, page, planStub: !!plan });
  const { base44, store } = stubClient(clientOptions);
  globalThis.__nudgeTestClient = () => base44;
  if (plan) globalThis.__nudgeTestPlan = plan;
  const response = await served(request(body));
  const json = await response.json();
  return { response, json, store };
}

beforeEach(() => {
  delete globalThis.__nudgeTestClient;
  delete globalThis.__nudgeTestPlan;
});

afterEach(() => {
  delete globalThis.__nudgeTestClient;
  delete globalThis.__nudgeTestPlan;
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
    expect(mail.body).toContain('To stop these emails, turn them off in your settings:');
    expect(mail.body).toContain('https://useunscripted.base44.app/settings');
  });

  it('asks nobody to reply, because nothing reads replies', async () => {
    const { store } = await call(live, { entities: fixture(2) });
    const [mail] = store.sent;
    expect(/repl(y|ies)/i.test(mail.body)).toBe(false);
    expect(/repl(y|ies)/i.test(mail.subject)).toBe(false);
  });

  it('points a question rung at the answer page, carrying the row it just wrote', async () => {
    // A rung whose ask is a sentence has nowhere to send it except a page in
    // the app, and the page needs to know which ask it is answering.
    const entities = fixture(1);
    entities.StudentNudge = [0, 1, 2].map((n) => ({
      id: `old${n}`,
      user_id: 'u000',
      stall_kind: 'experiment_without_guide',
      subject_id: 'eu000',
      rung: n,
      rung_key: `experiment_without_guide.r${n}`,
      size: 'large',
      action_kind: 'generate_guide',
      status: 'expired',
      generated_at: at(-30 + n),
      delivered_at: at(-30 + n),
      delivered_channel: 'email',
      deletion_status: 'active',
    }));
    const { store } = await call(live, { entities });
    const [mail] = store.sent;
    const [row] = store.created;
    expect(row.data.size).toBe('one_line');
    expect(mail.body).toContain(row.data.question);
    expect(mail.body).toContain('Answer in one sentence:');
    expect(mail.body).toContain('https://useunscripted.base44.app/answer?nudgeId=created-1');
  });

  it('writes a nudge row only for the student it actually emailed', async () => {
    // A row is the record of an ask that was made. One written for a student we
    // suppressed sits pending, expires on its own, and the ladder reads that
    // expiry as them ignoring us, so it drops them a rung for an email that was
    // never sent. Six passes of that retires the stall kind for them.
    const { json, store } = await call(live, { entities: fixture(6) });
    const nudges = store.created.filter((c) => c.entity === 'StudentNudge');
    expect(nudges).toHaveLength(1);
    expect(nudges[0].data.user_id).toBe('u000');
    expect(nudges[0].data.status).toBe('pending');
    expect(nudges[0].data.delivered_channel).toBe('none');
    // Nothing else was created for anybody, under any entity name.
    expect(store.created).toHaveLength(1);
    expect(json.counts.rows_created).toBe(1);
    expect(json.counts.suppressed).toBe(5);
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
    // u003 is not the allowlisted address, so nothing left the building and
    // nothing was written down about an ask they never got.
    expect(store.sent).toEqual([]);
    expect(store.created).toEqual([]);
    expect(json.counts.suppressed).toBe(1);
  });

  it('reads the whole population even when it may write to one person', async () => {
    // The suppression is at the send, not at the read. A pass that only looked
    // at the allowlisted student would report a plan nobody could check.
    const { json } = await call(live, { entities: fixture(6) });
    expect(json.counts.users).toBe(6);
    expect(json.counts.asked).toBe(6);
    expect(json.students.filter((l) => l.decision === 'asked')).toHaveLength(6);
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
    expect(store.created).toEqual([]);
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

describe('a student who turned these emails off', () => {
  const live = { dryRun: false, confirm: 'SEND-FOR-REAL' };

  /** The row the settings page and the answer page both write. */
  const optOut = (userId) => ({
    id: `opt-${userId}`,
    user_id: userId,
    created_by_id: userId,
    opted_out_at: at(-2),
    source: 'settings',
    deletion_status: 'active',
  });

  it('gets no email and no row on a fully confirmed live run', () => {
    // u000 is the one address this function is allowed to write to, so if the
    // opt out did not hold, this is the student it would reach.
    const entities = fixture(6);
    entities.NudgeOptOut = [optOut('u000')];
    return call(live, { entities }).then(({ json, store }) => {
      expect(json.dry_run).toBe(false);
      expect(store.sent).toEqual([]);
      expect(store.created).toEqual([]);
      const line = json.students.find((l) => l.userId === 'u000');
      expect(line.decision).toBe('skipped');
      expect(line.reason).toBe('the student turned these emails off');
    });
  });

  it('gets nothing in all mode either, with every confirmation given', async () => {
    const entities = fixture(4);
    entities.NudgeOptOut = [optOut('u001'), optOut('u003')];
    const { json, store } = await call(
      { dryRun: false, confirm: 'SEND-TO-ALL-STUDENTS' },
      { sendMode: 'all', entities },
    );
    expect(store.sent.map((m) => m.to).sort()).toEqual([
      'drew.lynch1@student.fairfield.edu', 'u002@student.fairfield.edu',
    ]);
    expect(json.counts.emailed).toBe(2);
    expect(json.students.filter((l) => l.reason === 'the student turned these emails off')).toHaveLength(2);
  });

  it('is checked again at the send, not only in the planner', async () => {
    // The planner will not hand an opted out student to the send loop, so the
    // only way to reach the second check is to replace the planner. An opt out
    // is a promise we printed in an email, and a promise that rests on one
    // caller remembering one argument is not one.
    const entities = fixture(2);
    entities.NudgeOptOut = [optOut('u000')];
    const { json, store } = await call(live, {
      entities,
      plan: () => ({
        passNumber: 1,
        generatedAt: new Date().toISOString(),
        toExpire: [],
        toCreate: [],
        toEmail: [{
          userId: 'u000',
          email: ALLOWED,
          ask: { user_id: 'u000', ask_title: 'x', ask_body: 'y', size: 'large', action_kind: 'generate_guide' },
        }],
        skipped: [],
        silent: [],
        counts: { users: 2, asked: 1, skipped: 0, silent: 0, expired: 0 },
      }),
    });
    expect(store.sent).toEqual([]);
    expect(store.created).toEqual([]);
    expect(json.counts.refused_opted_out).toBe(1);
    expect(json.students.find((l) => l.userId === 'u000').delivery).toBe('opted_out');
  });

  it('carries on writing to everybody who did not opt out', async () => {
    const entities = fixture(6);
    entities.NudgeOptOut = [optOut('u004')];
    const { json, store } = await call(live, { entities });
    expect(store.sent).toHaveLength(1);
    expect(store.sent[0].to).toBe(ALLOWED);
    expect(json.counts.asked).toBe(5);
  });

  it('ignores an opt out that was turned back off again', async () => {
    const entities = fixture(2);
    entities.NudgeOptOut = [{ ...optOut('u000'), deletion_status: 'deleted', deleted_at: at(-1) }];
    const { store } = await call(live, { entities });
    expect(store.sent).toHaveLength(1);
    expect(store.sent[0].to).toBe(ALLOWED);
  });

  it('ignores a row one student wrote about another', async () => {
    const entities = fixture(2);
    entities.NudgeOptOut = [{ ...optOut('u000'), created_by_id: 'u001' }];
    const { store } = await call(live, { entities });
    expect(store.sent).toHaveLength(1);
  });

  it('refuses to send at all when the opt out table would not load', async () => {
    // A failed read of this table looks exactly like nobody having opted out,
    // which is the one misreading that emails somebody who told us to stop.
    const { json, store } = await call(live, {
      entities: fixture(4), failReads: ['NudgeOptOut'],
    });
    expect(json.failed_reads).toEqual(['NudgeOptOut']);
    expect(json.read_complete).toBe(false);
    expect(store.sent).toEqual([]);
    expect(store.created).toEqual([]);
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

describe('a read that did not come back whole', () => {
  const live = { dryRun: false, confirm: 'SEND-FOR-REAL' };

  it('names the entity that threw, and sends nothing at all', async () => {
    // An entity read that fails returns an empty array, and an empty array is
    // indistinguishable from a student who has done nothing. Sending on that is
    // how somebody with a finished experiment gets told to start one.
    const { json, store } = await call(live, {
      entities: fixture(6), failReads: ['MissionGuides'],
    });
    expect(json.success).toBe(false);
    expect(json.read_complete).toBe(false);
    expect(json.failed_reads).toEqual(['MissionGuides']);
    expect(json.refused_to_send).toContain('MissionGuides');
    expect(json.dry_run).toBe(true);
    expect(store.sent).toEqual([]);
    expect(store.created).toEqual([]);
    expect(store.updated).toEqual([]);
  });

  it('names every entity that threw, not just the first', async () => {
    const { json } = await call(live, {
      entities: fixture(3), failReads: ['User', 'ProofOfWork'],
    });
    expect(json.failed_reads).toEqual(['User', 'ProofOfWork']);
    expect(json.success).toBe(false);
  });

  it('still reports on a dry run, because the report is how anybody finds out', async () => {
    const { json } = await call(undefined, {
      entities: fixture(4), failReads: ['WeeklyReflections'],
    });
    expect(json.failed_reads).toEqual(['WeeklyReflections']);
    expect(json.success).toBe(false);
    expect(json.counts.asked).toBe(4);
    // Nothing was refused, because a dry run was not going to send anyway.
    expect(json.refused_to_send).toBe('');
  });

  it('calls a clean read a success and says nothing about failures', async () => {
    const { json } = await call(undefined, { entities: fixture(4) });
    expect(json.success).toBe(true);
    expect(json.read_complete).toBe(true);
    expect(json.failed_reads).toEqual([]);
    expect(json.truncated_reads).toEqual([]);
  });
});

describe('an entity that filled its page', () => {
  const live = { dryRun: false, confirm: 'SEND-FOR-REAL' };

  it('treats a full page as a partial read and refuses to send', async () => {
    // One list call per entity and no second page. 86 users fits in 2000 today.
    // The day one does not, this is what stops a pass being planned on half a
    // population instead of quietly emailing the wrong half.
    const { json, store } = await call(live, { entities: fixture(3), page: 3 });
    expect(json.truncated_reads).toContain('User');
    expect(json.read_complete).toBe(false);
    expect(json.success).toBe(false);
    expect(json.refused_to_send).toContain('User');
    expect(store.sent).toEqual([]);
    expect(store.created).toEqual([]);
  });

  it('is happy with a page that is not full', async () => {
    const { json, store } = await call(live, { entities: fixture(3), page: 4 });
    expect(json.truncated_reads).toEqual([]);
    expect(json.success).toBe(true);
    expect(store.sent).toHaveLength(1);
  });
});

describe('the send cap, checked against what the planner returned', () => {
  const live = { dryRun: false, confirm: 'SEND-FOR-REAL' };

  /** A plan that ignores the cap it was handed, which a correct planner cannot. */
  const overCap = (count) => () => ({
    passNumber: 1,
    generatedAt: new Date().toISOString(),
    toExpire: [],
    toCreate: [],
    toEmail: Array.from({ length: count }, (_, i) => ({
      userId: `u${i}`,
      email: ALLOWED,
      ask: { user_id: `u${i}`, ask_title: 'x', ask_body: 'y', size: 'large', action_kind: 'generate_guide' },
    })),
    skipped: [],
    silent: [],
    counts: { users: count, asked: count, skipped: 0, silent: 0, expired: 0 },
  });

  it('aborts the run rather than send a plan that is longer than the cap', async () => {
    const { response, json, store } = await call(live, {
      entities: fixture(3), plan: overCap(26),
    });
    expect(response.status).toBe(500);
    expect(json.error).toContain('more sends than the cap allows');
    expect(json.planned).toBe(26);
    expect(json.send_cap).toBe(25);
    // Every one of those 26 was the allowlisted address, so the abort is the
    // only thing that stopped them.
    expect(store.sent).toEqual([]);
    expect(store.created).toEqual([]);
  });

  it('lets a plan inside the cap through, so the guard is not simply always on', async () => {
    const { response, store } = await call(live, {
      entities: fixture(3), plan: overCap(25),
    });
    expect(response.status).toBe(200);
    expect(store.sent).toHaveLength(25);
  });

  it('measures against the caller lowered cap, not just the hard one', async () => {
    const { response, json } = await call({ ...live, limit: 2 }, {
      entities: fixture(3), plan: overCap(3),
    });
    expect(response.status).toBe(500);
    expect(json.send_cap).toBe(2);
  });
});

/**
 * The safety rule, attacked from the request body.
 *
 * Every case below runs against the file exactly as it ships: no rewritten
 * SEND_MODE, no rewritten page size, the real planner. The population is 40
 * students, one of whom is the allowlisted address. The only thing that varies
 * is what a caller can put in the body, which is the only surface an operator,
 * a script, or a mistake actually has.
 *
 * The assertion is the same for all of them and it is the whole point of the
 * file: no address other than the allowlisted one is ever written to, and no
 * StudentNudge row is written for anybody else either.
 */
describe('hostile requests, none of which may reach a student', () => {
  const HOSTILE = [
    ['no body at all', undefined],
    ['an empty object', {}],
    ['JSON that does not parse', '{'],
    ['a form encoded body', 'dryRun=false&confirm=SEND-FOR-REAL'],
    ['a JSON array', '[1,2,3]'],
    ['a JSON null', 'null'],
    ['dryRun false and no confirmation', { dryRun: false }],
    ['dryRun as the number 0', { dryRun: 0, confirm: 'SEND-FOR-REAL' }],
    ['dryRun as the string no', { dryRun: 'no', confirm: 'SEND-FOR-REAL' }],
    ['dryRun as null', { dryRun: null, confirm: 'SEND-FOR-REAL' }],
    ['dryRun as the string false', { dryRun: 'false', confirm: 'SEND-FOR-REAL' }],
    ['the confirmation in the wrong case', { dryRun: false, confirm: 'send-for-real' }],
    ['the confirmation padded with spaces', { dryRun: false, confirm: '  SEND-FOR-REAL  ' }],
    ['the all-mode confirmation while the mode is allowlist', { dryRun: false, confirm: 'SEND-TO-ALL-STUDENTS' }],
    ['the cap raised to 500', { dryRun: false, confirm: 'SEND-FOR-REAL', limit: 500 }],
    ['the cap raised past any population', { dryRun: false, confirm: 'SEND-FOR-REAL', limit: 99999999 }],
    ['a negative cap', { dryRun: false, confirm: 'SEND-FOR-REAL', limit: -5 }],
    ['the cap as a string', { dryRun: false, confirm: 'SEND-FOR-REAL', limit: '500' }],
    ['the mode injected as SEND_MODE', { dryRun: false, confirm: 'SEND-FOR-REAL', SEND_MODE: 'all' }],
    ['the mode injected under two other spellings', { dryRun: false, confirm: 'SEND-FOR-REAL', sendMode: 'all', mode: 'all' }],
    ['an allowlist injected', { dryRun: false, confirm: 'SEND-FOR-REAL', ALLOWLIST: ['x@y.edu'], allowlist: ['x@y.edu'] }],
    ['the mode injected through the prototype', '{"dryRun":false,"confirm":"SEND-FOR-REAL","__proto__":{"SEND_MODE":"all"}}'],
    ['one student named who is not the allowed one', { dryRun: false, confirm: 'SEND-FOR-REAL', onlyUserId: 'u007' }],
    ['a live run exactly as an operator would type it', { dryRun: false, confirm: 'SEND-FOR-REAL' }],
  ];

  it('throws 24 of them at the shipping file and reaches nobody else', async () => {
    expect(HOSTILE).toHaveLength(24);
    const strangers = [];
    let reachedTheAllowedOne = 0;
    for (const [what, body] of HOSTILE) {
      // eslint-disable-next-line no-await-in-loop
      const { response, store } = await call(body, { entities: fixture(40, { allowIndex: 3 }) });
      expect(response.status, what).toBe(200);
      for (const mail of store.sent) {
        if (mail.to === ALLOWED) reachedTheAllowedOne += 1;
        else strangers.push({ what, to: mail.to });
      }
      for (const row of store.created) {
        if (row.data.user_id !== 'u003') strangers.push({ what, row: row.data.user_id });
      }
    }
    expect(strangers).toEqual([]);
    // And the run is not vacuously safe. Several of those bodies are genuine
    // live requests, and each of them did send, to the one address.
    expect(reachedTheAllowedOne).toBeGreaterThan(5);
  });
});

describe('the state this function is shipping in', () => {
  it('ships in allowlist mode with one address on the list', () => {
    // Behaviour above is tested against a rewritten copy, so this is the line
    // that pins what a merge actually deploys.
    expect(ENTRY_SOURCE).toContain("const SEND_MODE = 'allowlist';");
    expect(ENTRY_SOURCE).toContain("const ALLOWLIST = ['drew.lynch1@student.fairfield.edu'];");
    expect(ENTRY_SOURCE).toContain('const MAX_SENDS_PER_RUN = 25;');
    expect(ENTRY_SOURCE).toContain('const PAGE = 2000;');
  });

  it('imports only from base44/shared, which is what deploys with it', () => {
    // A function upload is its own directory plus base44/shared. An import that
    // reaches into src/lib resolves here and fails to resolve in Deno, which
    // means a scheduled job calling a function that cannot boot.
    const specifiers = [...ENTRY_SOURCE.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const spec of specifiers) {
      if (spec.startsWith('npm:')) continue;
      expect(spec.startsWith('../../shared/'), spec).toBe(true);
      expect(spec.endsWith('.js'), spec).toBe(true);
    }
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
