/**
 * ===========================================================================
 *  THIS FUNCTION SENDS REAL EMAIL TO REAL STUDENTS. READ THIS BEFORE EDITING.
 * ===========================================================================
 *
 * It reads every student's records, decides the one thing to ask each of them
 * this week, and emails it to them. Most of those students are 19 years old and
 * at a university we are trying to sell to. An email cannot be unsent.
 *
 * So it is built to be physically incapable of writing to anyone except one
 * address until a person changes it on purpose.
 *
 * SEND_MODE, one line below, has three legal values:
 *
 *   'off'        Nothing is written and nothing is sent, ever. The pass is
 *                computed and reported and that is all.
 *   'allowlist'  The current setting. Every student is read, planned and
 *                reported exactly as they would be in a real run, and the send
 *                is skipped for everybody whose address is not in ALLOWLIST.
 *                Their line in the response says `suppressed`.
 *   'all'        Sends to every student the pass picked. Requires the request
 *                to also pass confirm: 'SEND-TO-ALL-STUDENTS'.
 *
 * On top of that, no send of any kind happens unless the request passes BOTH
 * dryRun: false AND a confirm string from LIVE_CONFIRMATIONS. A request with no
 * body is a dry run. The scheduled workflow passes dryRun: true, so the job as
 * scheduled computes, logs, and sends nothing.
 *
 * THE ONE LINE CHANGE THAT TURNS SENDING ON:
 *
 *     const SEND_MODE = 'allowlist';   ->   const SEND_MODE = 'all';
 *
 * and then the caller has to pass { dryRun: false, confirm: 'SEND-TO-ALL-STUDENTS' }.
 * Changing the line alone still sends nothing. Both halves are needed on
 * purpose. MAX_SENDS_PER_RUN caps how far a mistake can get either way.
 *
 * To watch a real email arrive without touching anyone else, leave SEND_MODE
 * where it is and call it with { onlyUserId: '<the allowlisted student>',
 * dryRun: false, confirm: 'SEND-FOR-REAL' }.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { planPass, groupRowsByUser, DEFAULT_PASS_LIMIT } from '../../../src/lib/nudge-pass.js';
import { renderNudgeEmail } from '../../../src/lib/nudge-email.js';

/** 'off' | 'allowlist' | 'all'. See the block above before changing it. */
const SEND_MODE = 'allowlist';

/** The only addresses 'allowlist' mode will write to. Lower case. */
const ALLOWLIST = ['drew.lynch1@student.fairfield.edu'];

/**
 * The hardest limit in the file. Even with the mode flipped and both
 * confirmations passed, one run cannot write to more than this many people, so
 * a bug in the planner cannot fan out to the whole database in one pass.
 */
const MAX_SENDS_PER_RUN = 25;

/** A live run needs one of these in `confirm`. Without one it is a dry run. */
const LIVE_CONFIRMATIONS = ['SEND-FOR-REAL', 'SEND-TO-ALL-STUDENTS'];

/** 'all' mode needs this exact string as well as dryRun: false. */
const CONFIRM_ALL = 'SEND-TO-ALL-STUDENTS';

/** Where the links in the email point. */
const APP_ORIGIN = 'https://useunscripted.base44.app';

/** How many rows to pull per entity. Comfortably above the live row counts. */
const PAGE = 2000;

/**
 * Which entity feeds which argument of readPulse. `paths` is
 * PathRecommendations, not Paths: PathRecommendations is what the generator
 * writes and what an experiment's path_id points at.
 */
const SOURCES: Array<[string, string]> = [
  ['profiles', 'StudentProfile'],
  ['paths', 'PathRecommendations'],
  ['experiments', 'Experiments'],
  ['missions', 'Missions'],
  ['guides', 'MissionGuides'],
  ['proof', 'ProofOfWork'],
  ['reflections', 'WeeklyReflections'],
  ['outreach', 'OutreachContacts'],
  ['events', 'PilotEvent'],
  ['nudges', 'StudentNudge'],
];

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

/** May this address be written to, given the mode and the confirmation. */
function mayEmail(address: string, confirm: string): boolean {
  const to = str(address).toLowerCase();
  if (!to) return false;
  if (SEND_MODE === 'allowlist') return ALLOWLIST.includes(to);
  if (SEND_MODE === 'all') return confirm === CONFIRM_ALL;
  // 'off', and anything somebody typed that is not one of the three.
  return false;
}

export async function handleRequest(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // This endpoint reads every student's private records. An open route here
    // is a data breach, so the gate is the same one the purge job uses.
    let caller = null;
    try {
      caller = await base44.auth.me();
    } catch (_) {
      caller = null;
    }
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const isService = !!caller?.is_service;
    const isAdmin = caller?.role === 'admin';
    if (!isAdmin && !isService) return Response.json({ error: 'Forbidden' }, { status: 403 });

    let body: any = {};
    try {
      body = (await req.json()) || {};
    } catch (_) {
      body = {};
    }

    // Anything other than a literal false is a dry run, including a missing
    // body, a string 'false', and a typo.
    const dryRun = body.dryRun !== false;
    const confirm = str(body.confirm);
    const onlyUserId = str(body.onlyUserId);
    const writing = !dryRun && LIVE_CONFIRMATIONS.includes(confirm) && SEND_MODE !== 'off';

    const requested = Number.isFinite(body.limit) ? Math.floor(body.limit) : DEFAULT_PASS_LIMIT;
    const limit = Math.max(0, Math.min(MAX_SENDS_PER_RUN, requested));

    const now = new Date().toISOString();

    // One list call per entity for the whole population, then grouped in
    // memory. Per student it would be 86 times 10 round trips and would time
    // out long before it finished.
    //
    // `asServiceRole` acts AS an admin rather than bypassing the access rules,
    // and creator scoping is enforced in this app even for role admin. That is
    // why StudentNudge reads and updates on `data.user_id`: every row created
    // here has the service actor as its creator, not the student, so a
    // creator-scoped rule would hide a student's own nudge from them.
    const load = async (entity: string) => {
      try {
        return await base44.asServiceRole.entities[entity].list('-created_date', PAGE);
      } catch (err) {
        console.error(`weeklyNudgePass: failed to read ${entity}:`, err?.message);
        return [];
      }
    };

    let users = await load('User');
    if (onlyUserId) users = users.filter((u) => str(u?.id) === onlyUserId);

    const lists: Record<string, any[]> = {};
    for (const [key, entity] of SOURCES) lists[key] = await load(entity);

    const rowsByUser = groupRowsByUser(users, lists);

    // Pass numbers carry on from whatever the last run wrote, so the ledger
    // reads as one sequence rather than restarting at 1 every deploy.
    let passNumber = Number.isFinite(body.passNumber) ? Math.floor(body.passNumber) : null;
    if (passNumber === null) {
      let highest = 0;
      for (const row of lists.nudges || []) {
        const n = Number(row?.pass_number);
        if (Number.isFinite(n) && n > highest) highest = n;
      }
      passNumber = highest + 1;
    }

    const plan = planPass({ users, rowsByUser, history: lists.nudges, now, passNumber, limit });

    const lines: any[] = [];
    for (const s of plan.skipped) lines.push({ userId: s.userId, decision: 'skipped', reason: s.reason });
    for (const s of plan.silent) lines.push({ userId: s.userId, decision: 'silent' });

    let expired = 0;
    let created = 0;
    let emailed = 0;
    let suppressed = 0;
    let failed = 0;

    // Held by reference so the send loop below can fill in what happened
    // without having to search for its own line again.
    const askedLines = plan.toEmail.map(({ userId, ask }) => {
      const line = {
        userId,
        decision: 'asked',
        kind: ask.stall_kind,
        rung: ask.rung,
        rung_key: ask.rung_key,
        subject: ask.ask_title,
        delivery: writing ? 'pending' : 'dry_run',
      };
      lines.push(line);
      return line;
    });

    if (writing) {
      for (const id of plan.toExpire) {
        try {
          await base44.asServiceRole.entities.StudentNudge.update(id, { status: 'expired' });
          expired += 1;
        } catch (err) {
          console.error(`weeklyNudgePass: failed to expire ${id}:`, err?.message);
          failed += 1;
        }
      }

      let sends = 0;
      for (let i = 0; i < plan.toEmail.length; i += 1) {
        const { userId, email, ask } = plan.toEmail[i];
        const line = askedLines[i];

        let rowId = '';
        try {
          const row = await base44.asServiceRole.entities.StudentNudge.create(ask);
          rowId = str(row?.id);
          created += 1;
        } catch (err) {
          console.error(`weeklyNudgePass: failed to write a nudge for ${userId}:`, err?.message);
          failed += 1;
          if (line) line.delivery = 'failed';
          continue;
        }

        if (!mayEmail(email, confirm)) {
          suppressed += 1;
          if (line) line.delivery = 'suppressed';
          continue;
        }
        // The cap again, at the last possible moment. Everything above it could
        // be wrong and this would still hold.
        if (sends >= MAX_SENDS_PER_RUN) {
          suppressed += 1;
          if (line) line.delivery = 'suppressed';
          continue;
        }

        // Every send stands on its own. One bad address must not take the rest
        // of the pass down with it.
        try {
          const rendered = renderNudgeEmail({
            ask, user: (users.find((u) => str(u?.id) === userId) || null), appOrigin: APP_ORIGIN, now,
          });
          // SendEmail carries plain text only. The HTML body is rendered and
          // tested alongside it for the day the send path can take one.
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: rendered.subject,
            body: rendered.text,
          });
          sends += 1;
          emailed += 1;
          if (line) line.delivery = 'emailed';
          if (rowId) {
            try {
              await base44.asServiceRole.entities.StudentNudge.update(rowId, {
                delivered_channel: 'email',
                delivered_at: new Date().toISOString(),
              });
            } catch (err) {
              console.error(`weeklyNudgePass: sent but failed to mark ${rowId}:`, err?.message);
            }
          }
        } catch (err) {
          console.error(`weeklyNudgePass: failed to email ${userId}:`, err?.message);
          failed += 1;
          if (line) line.delivery = 'failed';
        }
      }
    }

    return Response.json({
      success: true,
      run_at: now,
      mode: SEND_MODE,
      dry_run: !writing,
      wrote_anything: writing,
      pass_number: plan.passNumber,
      send_cap: limit,
      counts: {
        ...plan.counts,
        expired_marked: expired,
        rows_created: created,
        emailed,
        suppressed,
        failed,
      },
      students: lines,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

Deno.serve(handleRequest);
