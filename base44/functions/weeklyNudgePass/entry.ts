/**
 * ===========================================================================
 *  THIS FUNCTION SENDS REAL EMAIL TO REAL STUDENTS. READ THIS BEFORE EDITING.
 * ===========================================================================
 *
 * It reads every student's records, decides the one thing to ask each of them
 * this week, and emails it to them. Most of those students are 19 years old and
 * at a university we are trying to sell to. An email cannot be unsent.
 *
 * So until a person changes it on purpose, one address is the only one this
 * writes to, and that covers both halves of writing: no email, and no
 * StudentNudge row either.
 *
 * The row half matters as much as the email half. A row is the record of an ask
 * that was made, so one written for a student we did not write to invents an
 * ask they never saw: it sits pending, expires a week later, and the ladder
 * reads that expiry as them ignoring us and drops them a rung. Six of those
 * retire the whole stall kind for them. The only thing this function touches
 * for everybody is marking already delivered asks as expired, which is
 * bookkeeping on rows that already exist.
 *
 * SEND_MODE, one line below, has three legal values:
 *
 *   'off'        Nothing is written and nothing is sent, ever. The pass is
 *                computed and reported and that is all.
 *   'allowlist'  The current setting. Every student is read, planned and
 *                reported exactly as they would be in a real run. Anybody whose
 *                address is not in ALLOWLIST gets no mail and no row, and their
 *                line in the response says `suppressed`.
 *   'all'        Sends to every student the pass picked. Requires the request
 *                to also pass confirm: 'SEND-TO-ALL-STUDENTS'.
 *
 * On top of that, no send of any kind happens unless the request passes BOTH
 * dryRun: false AND a confirm string from LIVE_CONFIRMATIONS. A request with no
 * body is a dry run. The scheduled workflow passes dryRun: true, so the job as
 * scheduled computes, logs, and sends nothing.
 *
 * A student with a live NudgeOptOut row gets nothing in any mode, including
 * 'all' with every confirmation given. That is checked twice, once in the
 * planner and once again at the send, because it is the only rule here that is
 * a promise we printed at the bottom of an email rather than a judgement we
 * made.
 *
 * A run whose entity reads did not all come back whole sends nothing either. It
 * still reports, and names the entity, under `failed_reads` and
 * `truncated_reads`. A missing entity reads exactly like a student who has done
 * nothing, which is the ask we would then send them.
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
// base44/shared is the only directory outside this one that ships with the
// function, so everything imported here lives there. src/lib holds a one line
// re-export of each file for the frontend and the tests.
import { planPass, groupRowsByUser, DEFAULT_PASS_LIMIT } from '../../shared/nudge-pass.js';
import { renderNudgeEmail } from '../../shared/nudge-email.js';
import { isOptedOut } from '../../shared/nudge-response.js';

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

/**
 * How many rows to pull per entity, in one page.
 *
 * Comfortably above every live row count today: the largest entity holds a few
 * hundred rows. There is no second page fetched, so a read that comes back with
 * a full page is assumed to be partial and the run refuses to send. Raising
 * this is the wrong fix past a certain size; paging is.
 */
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
  // Every email we send ends with a sentence promising these can be turned
  // off. This is the table that makes it true, so a failed read of it is a
  // failed read like any other and stops the run from sending.
  ['optOuts', 'NudgeOptOut'],
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
    const requestedWrite = !dryRun && LIVE_CONFIRMATIONS.includes(confirm) && SEND_MODE !== 'off';

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

    // Both of these are the reasons a pass cannot be trusted. A read that threw
    // returns an empty array, and an empty array reads exactly like a student
    // who has done nothing, which is the ask we would then send them. A read
    // that filled its page has an unknown number of rows behind it. Either way
    // the counts below are wrong, so they are named in the response and a live
    // run refuses to start.
    const failedReads: string[] = [];
    const truncatedReads: string[] = [];

    const load = async (entity: string) => {
      try {
        const page = await base44.asServiceRole.entities[entity].list('-created_date', PAGE);
        const list = Array.isArray(page) ? page : [];
        if (list.length >= PAGE) {
          console.error(`weeklyNudgePass: ${entity} filled a page of ${PAGE}, so this read is partial`);
          truncatedReads.push(entity);
        }
        return list;
      } catch (err) {
        console.error(`weeklyNudgePass: failed to read ${entity}:`, err?.message);
        failedReads.push(entity);
        return [];
      }
    };

    let users = await load('User');
    if (onlyUserId) users = users.filter((u) => str(u?.id) === onlyUserId);

    const lists: Record<string, any[]> = {};
    for (const [key, entity] of SOURCES) lists[key] = await load(entity);

    // A dry run on a partial read is still worth reading, as long as it says so.
    // A live one is not: it would email the wrong ask to the wrong people and
    // leave a row behind that costs them a rung.
    const readComplete = failedReads.length === 0 && truncatedReads.length === 0;
    const writing = requestedWrite && readComplete;

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

    const plan = planPass({
      users, rowsByUser, history: lists.nudges, now, passNumber, limit, optOuts: lists.optOuts,
    });

    // The planner already drops these students, so this set exists only to be
    // checked again at the send. An opt out is a promise, and a promise that
    // depends on one caller remembering to pass one argument is not one.
    const optedOut = new Set<string>();
    for (const user of users) {
      const id = str(user?.id);
      if (id && isOptedOut(lists.optOuts, id)) optedOut.add(id);
    }

    // The cap, checked against what the planner actually returned rather than
    // against the number it was handed. planPass applies `limit` itself, so
    // this only fires if that stops being true, and if it stops being true the
    // right answer is to send nothing and have somebody look at it. Trimming
    // quietly would mean a planner bug ships as a slightly shorter mailing.
    if (plan.toEmail.length > limit) {
      console.error(
        `weeklyNudgePass: the planner returned ${plan.toEmail.length} sends against a cap of ${limit}`,
      );
      return Response.json({
        error: 'the planner returned more sends than the cap allows, so nothing was sent',
        planned: plan.toEmail.length,
        send_cap: limit,
      }, { status: 500 });
    }

    const lines: any[] = [];
    for (const s of plan.skipped) lines.push({ userId: s.userId, decision: 'skipped', reason: s.reason });
    for (const s of plan.silent) lines.push({ userId: s.userId, decision: 'silent' });

    let expired = 0;
    let created = 0;
    let emailed = 0;
    let suppressed = 0;
    let refusedOptOut = 0;
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

      for (let i = 0; i < plan.toEmail.length; i += 1) {
        const { userId, email, ask } = plan.toEmail[i];
        const line = askedLines[i];

        // The second half of the opt out check. The planner will not put an
        // opted out student in this list, so reaching here means the planner
        // changed or the rows were not handed to it, and either way the answer
        // is the same: write nothing, send nothing.
        if (optedOut.has(userId)) {
          refusedOptOut += 1;
          if (line) line.delivery = 'opted_out';
          continue;
        }

        // Suppressed means nothing happens to this student, row included. The
        // check has to come first for that to be true. Behind it: a pending row
        // for an ask we never sent expires on its own, and `rungFor` reads that
        // expiry as the student ignoring us, so it drops them a rung. Six of
        // those retire the stall kind for them permanently, and none of it was
        // ever in front of them.
        if (!mayEmail(email, confirm)) {
          suppressed += 1;
          if (line) line.delivery = 'suppressed';
          continue;
        }

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

        // Every send stands on its own. One bad address must not take the rest
        // of the pass down with it.
        try {
          const rendered = renderNudgeEmail({
            ask,
            user: (users.find((u) => str(u?.id) === userId) || null),
            appOrigin: APP_ORIGIN,
            now,
            // So the answer page opens on this question rather than guessing.
            nudgeId: rowId,
          });
          // `rendered.html` IS NOT SENT AND CANNOT BE. SendEmail takes
          // {to, subject, body, from_name}, `body` is plain text, and there is
          // no argument an HTML body could go in. It is rendered and tested so
          // the copy and the escaping are already right on the day the send
          // path can carry one. `rendered.text` is the entire email.
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: rendered.subject,
            body: rendered.text,
          });
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
      // False the moment any entity read is in doubt. A pass computed on a
      // partial read still reports, because the report is how somebody finds
      // out, but it does not get to call itself a success.
      success: readComplete,
      read_complete: readComplete,
      failed_reads: failedReads,
      truncated_reads: truncatedReads,
      refused_to_send: requestedWrite && !writing
        ? `an entity read was incomplete (${[...failedReads, ...truncatedReads].join(', ')}), `
          + 'so no row was written and no email was sent'
        : '',
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
        refused_opted_out: refusedOptOut,
        failed,
      },
      students: lines,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

Deno.serve(handleRequest);
