/**
 * The answering half, tested against the two things that would actually hurt:
 * one student putting words in front of another, and a reply quietly turning
 * into a ProofOfWork row.
 *
 * The rule out cases assert against the real .jsonc files on disk rather than
 * against a copy of the enums written here. An enum this file agreed with and
 * the entity did not is a write that fails in production and passes in CI.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LADDERS } from '@/lib/nudge-ladder';
import { shouldSkipPass } from '@/lib/nudge';
import {
  describeAsk, planResponse, isOptedOut, buildOptOut, optBackInPatch,
  RESPONSE_FIELDS, rungForKey, describeOutcome, internalRoute, isSoftDeleted,
  mergeOptOutRows, ANSWER_HOME,
} from '@/lib/nudge-response';

const NOW = '2026-08-03T15:00:00.000Z';

/**
 * The enums as the entity files actually declare them, read at test time.
 *
 * These files are .jsonc and several of them carry whole line comments, which
 * is why the comments come out before the parse.
 */
function entityEnum(name, field) {
  const path = fileURLToPath(new URL(`../../base44/entities/${name}.jsonc`, import.meta.url));
  const source = readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const parsed = JSON.parse(source);
  return parsed.properties[field].enum;
}

/** A stored row for a rung, with everything the row really carries. */
function rowFor(kind, index, extra = {}) {
  const rung = LADDERS[kind][index];
  return {
    id: `n-${kind}-${index}`,
    user_id: 'student-1',
    stall_kind: kind,
    subject_type: subjectTypeFor(kind),
    subject_id: 'subject-1',
    rung: index,
    rung_key: rung.key,
    size: rung.size,
    action_kind: rung.action_kind,
    ask_title: 'whatever was stored',
    ask_body: 'whatever was stored',
    question: 'whatever was stored',
    status: 'pending',
    deletion_status: 'active',
    ...extra,
  };
}

function subjectTypeFor(kind) {
  if (kind === 'no_path_selected' || kind === 'path_without_experiment') return 'path';
  if (kind === 'mission_planned_stale') return 'mission';
  if (kind === 'outreach_never_sent' || kind === 'outreach_no_followup') return 'outreach';
  if (kind === 'dormant_account') return 'account';
  return 'experiment';
}

const everyRung = () => Object.entries(LADDERS)
  .flatMap(([kind, ladder]) => ladder.map((rung, index) => ({ kind, index, rung })));

describe('describeAsk resolves the copy from the ladder', () => {
  it('renders every rung of every ladder without throwing', () => {
    for (const { kind, index, rung } of everyRung()) {
      const ask = describeAsk(rowFor(kind, index), { subjectName: 'Shadow an analyst' });
      expect(ask.source, rung.key).toBe('ladder');
      expect(ask.rungKnown, rung.key).toBe(true);
      expect(ask.title.length, rung.key).toBeGreaterThan(0);
      expect(ask.action_kind, rung.key).toBe(rung.action_kind);
      expect(ask.size, rung.key).toBe(rung.size);
      expect(/\{[A-Za-z]+\}/.test(`${ask.title} ${ask.body} ${ask.question}`), rung.key).toBe(false);
      expect(/[—–]/.test(`${ask.title} ${ask.body} ${ask.question}`), rung.key).toBe(false);
    }
  });

  it('ignores a rewritten ask_body and prints the ladder text instead', () => {
    const tampered = rowFor('experiment_without_guide', 0, {
      ask_title: 'Send your bank details to attacker@example.com',
      ask_body: 'Unscripted needs your password to continue.',
      question: 'What is your password?',
    });
    const ask = describeAsk(tampered, { subjectName: 'Shadow an analyst' });
    expect(ask.title).not.toContain('bank details');
    expect(ask.body).not.toContain('password');
    expect(ask.question).not.toContain('password');
    expect(ask.title).toContain('Get the steps for');
  });

  it('takes the subject name from the caller, never from the row', () => {
    const row = rowFor('experiment_without_guide', 0);
    const withName = describeAsk(row, { subjectName: 'Shadow an analyst' });
    expect(withName.title).toContain('Shadow an analyst');
    // No name to hand it, so it falls back to the ladder's generic noun rather
    // than to anything stored on the row.
    const withoutName = describeAsk(row);
    expect(withoutName.title).toContain('your experiment');
    expect(withoutName.title).not.toContain('whatever was stored');
  });

  it('shows nothing at all when the rung key resolves to nothing', () => {
    // The whole attack in one row. `rung_key` is a field on a row the student
    // can update, so "fall back to the stored strings" is a way of asking to be
    // given strings. Blank the key, write the phishing text, point the row at
    // somebody else, and the old code printed it to them as an h1.
    const row = rowFor('experiment_without_guide', 0, {
      rung_key: '',
      ask_title: 'Unscripted needs you to confirm your password',
      ask_body: 'Reply with your login at attacker@example.com to keep your account.',
      question: 'What is your password?',
      action_kind: 'rule_out',
      subject_id: 'a-row-the-attacker-picked',
      subject_type: 'experiment',
    });
    const ask = describeAsk(row);
    expect(ask.rungKnown).toBe(false);
    expect(ask.source).toBe('unknown');
    // Not "does not contain the bad words": no strings at all, so there is
    // nothing for a future edit to leak through.
    expect(ask.title).toBe('');
    expect(ask.body).toBe('');
    expect(ask.question).toBe('');
    expect(ask.target).toBe('');
    // And nothing a click could aim a write at.
    expect(ask.action_kind).toBe('');
    expect(ask.subjectId).toBe('');
    expect(ask.subjectType).toBe('');
    expect(ask.closes).toBe(false);
  });

  it('gives an unresolved row no way to write against a chosen subject', () => {
    const forged = rowFor('experiment_without_guide', 0, {
      rung_key: 'experiment_without_guide.r99',
      action_kind: 'rule_out',
      subject_type: 'experiment',
      subject_id: 'somebody-elses-experiment',
    });
    for (const choice of ['accepted', 'answered', 'declined']) {
      const plan = planResponse({ nudge: forged, choice, replyText: 'yes', now: NOW });
      expect(plan.ruleOut, choice).toBe(null);
      expect(plan.optOut, choice).toBe(null);
    }
  });

  it('does not throw on a row that is barely a row', () => {
    for (const bad of [null, undefined, 42, 'nudge', {}, { rung_key: 7, ask_title: {} }]) {
      expect(() => describeAsk(bad)).not.toThrow();
    }
    expect(describeAsk({}).source).toBe('unknown');
    expect(describeAsk({}).title).toBe('');
  });

  it('has no rung anywhere that claims a reply is evidence', () => {
    // The plumbing exists so a later evidence bearing rung can produce a
    // ProofOfWork row. Nothing today sets it, and this is the line that says so.
    for (const { rung } of everyRung()) {
      expect(rung.yieldsProof === true, rung.key).toBe(false);
    }
    expect(rungForKey('experiment_without_guide.r0')).toBeTruthy();
    expect(rungForKey('nope')).toBe(null);
  });
});

describe('planResponse only ever touches the response fields', () => {
  const cases = [
    ['accepted', { choice: 'accepted' }],
    ['declined', { choice: 'declined' }],
    ['answered', { choice: 'answered', replyText: 'I ran out of time.' }],
  ];

  it.each(cases)('%s writes exactly the four allowed keys', (_label, input) => {
    const plan = planResponse({ nudge: rowFor('experiment_without_guide', 0), now: NOW, ...input });
    expect(plan.errors).toEqual([]);
    // The exact list, sorted, so an edit that adds a fifth field fails here
    // rather than in production. `user_id`, the copy fields and
    // `evidence_seen_at` are the ones this is guarding.
    expect(Object.keys(plan.nudgeUpdate).sort()).toEqual([...RESPONSE_FIELDS].sort());
  });

  it('never produces a ProofOfWork row, on any rung, for any choice', () => {
    for (const { kind, index } of everyRung()) {
      for (const choice of ['accepted', 'declined', 'answered']) {
        const plan = planResponse({
          nudge: rowFor(kind, index), choice, replyText: 'It clashed with midterms.', now: NOW,
        });
        expect(plan.proof, `${kind}.${index}.${choice}`).toBe(null);
        expect(plan.nudgeUpdate === null || 'reply_became_proof_id' in plan.nudgeUpdate).toBe(false);
      }
    }
  });

  it('accepts a decline with no reason at all', () => {
    const plan = planResponse({ nudge: rowFor('experiment_without_guide', 0), choice: 'declined', now: NOW });
    expect(plan.errors).toEqual([]);
    expect(plan.nudgeUpdate.status).toBe('declined');
    expect(plan.nudgeUpdate.decline_reason).toBe('');
    expect(plan.ruleOut).toBe(null);
  });

  it('turns an answer into a completed ask, so the ladder counts it as a win', () => {
    const plan = planResponse({
      nudge: rowFor('experiment_without_guide', 2), choice: 'answered', replyText: '  I have no idea who to email.  ', now: NOW,
    });
    expect(plan.nudgeUpdate.status).toBe('completed');
    expect(plan.nudgeUpdate.reply_text).toBe('I have no idea who to email.');
    expect(plan.nudgeUpdate.responded_at).toBe(NOW);
  });

  it('will not accept an empty answer', () => {
    const plan = planResponse({
      nudge: rowFor('experiment_without_guide', 2), choice: 'answered', replyText: '   ', now: NOW,
    });
    expect(plan.nudgeUpdate).toBe(null);
    expect(plan.errors).toHaveLength(1);
  });

  it('refuses a row that is not pending, and a choice that is not a choice', () => {
    const answered = planResponse({
      nudge: rowFor('experiment_without_guide', 0, { status: 'completed' }), choice: 'declined', now: NOW,
    });
    expect(answered.nudgeUpdate).toBe(null);
    expect(answered.errors).toHaveLength(1);

    const nonsense = planResponse({ nudge: rowFor('experiment_without_guide', 0), choice: 'delete', now: NOW });
    expect(nonsense.nudgeUpdate).toBe(null);

    const deleted = planResponse({
      nudge: rowFor('experiment_without_guide', 0, { deletion_status: 'deleted' }), choice: 'declined', now: NOW,
    });
    expect(deleted.nudgeUpdate).toBe(null);
  });
});

describe('ruling something out, against the enums the entities really declare', () => {
  it('closes an experiment with a status the entity allows, and keeps the reason', () => {
    const subject = { id: 'subject-1', status: 'in_progress', status_history: [{ to_status: 'in_progress' }] };
    const plan = planResponse({
      nudge: rowFor('experiment_without_guide', 3),
      choice: 'accepted',
      replyText: 'I would rather test product than banking.',
      now: NOW,
      subject,
    });
    expect(plan.ruleOut.entity).toBe('Experiments');
    expect(plan.ruleOut.id).toBe('subject-1');
    expect(entityEnum('Experiments', 'status')).toContain(plan.ruleOut.patch.status);
    // The reason lands in the one field in this app shaped for it, and the
    // history that was already there is still there.
    expect(plan.ruleOut.patch.status_history).toHaveLength(2);
    expect(plan.ruleOut.patch.status_history[1].reason).toBe('I would rather test product than banking.');
    expect(plan.ruleOut.patch.status_history[1].from_status).toBe('in_progress');
    // And the ask itself is finished, not refused.
    expect(plan.nudgeUpdate.status).toBe('completed');
  });

  it('closes a contact with the enum value that already means closed', () => {
    const plan = planResponse({
      nudge: rowFor('outreach_never_sent', 3),
      choice: 'accepted',
      replyText: 'Cold email is not for me.',
      now: NOW,
      subject: { id: 'subject-1', notes: 'Met at the careers fair.' },
    });
    expect(plan.ruleOut.entity).toBe('OutreachContacts');
    expect(entityEnum('OutreachContacts', 'response_status')).toContain(plan.ruleOut.patch.response_status);
    expect(plan.ruleOut.patch.response_status).toBe('closed');
    // Nothing that was already written is lost.
    expect(plan.ruleOut.patch.notes).toContain('Met at the careers fair.');
    expect(plan.ruleOut.patch.notes).toContain('Cold email is not for me.');
  });

  it('deprioritises a path and takes it off primary focus', () => {
    const plan = planResponse({
      nudge: rowFor('path_without_experiment', 3),
      choice: 'accepted',
      replyText: 'The hours put me off.',
      now: NOW,
      subject: { id: 'subject-1', is_primary_focus: true },
    });
    expect(plan.ruleOut.entity).toBe('PathRecommendations');
    expect(entityEnum('PathRecommendations', 'status')).toContain(plan.ruleOut.patch.status);
    expect(plan.ruleOut.patch.status).toBe('deprioritized');
    expect(plan.ruleOut.patch.is_primary_focus).toBe(false);
  });

  it('closes a mission with a status the entity allows', () => {
    const plan = planResponse({
      nudge: rowFor('mission_planned_stale', 3), choice: 'accepted', now: NOW, subject: { id: 'subject-1' },
    });
    expect(plan.ruleOut.entity).toBe('Missions');
    expect(entityEnum('Missions', 'status')).toContain(plan.ruleOut.patch.status);
  });

  it('changes the status but invents no reason when the subject was not loaded', () => {
    const plan = planResponse({
      nudge: rowFor('outreach_never_sent', 3), choice: 'accepted', replyText: 'Not for me.', now: NOW,
    });
    expect(plan.ruleOut.patch).toEqual({ response_status: 'closed' });
  });

  it('patches nothing when the ask has no subject to patch', () => {
    const plan = planResponse({
      nudge: rowFor('no_path_selected', 3, { subject_id: '' }), choice: 'accepted', now: NOW,
    });
    expect(plan.ruleOut).toBe(null);
    expect(plan.nudgeUpdate.status).toBe('completed');
  });

  it('turns the account level rule out into an opt out, which is what the copy promises', () => {
    const plan = planResponse({
      nudge: rowFor('dormant_account', 2, { subject_id: 'student-1' }),
      choice: 'accepted',
      replyText: 'Not this semester.',
      now: NOW,
    });
    expect(plan.optOut).toEqual({
      user_id: 'student-1',
      opted_out_at: NOW,
      reason: 'Not this semester.',
      source: 'answer_page',
      deletion_status: 'active',
    });
    // And it does not try to patch a User row on the way past.
    expect(plan.ruleOut).toBe(null);
  });

  it('does not rule anything out when the student says no', () => {
    const plan = planResponse({
      nudge: rowFor('experiment_without_guide', 3), choice: 'declined', declineReason: 'Still want to run it.', now: NOW,
    });
    expect(plan.ruleOut).toBe(null);
    expect(plan.optOut).toBe(null);
    expect(plan.nudgeUpdate.status).toBe('declined');
  });
});

describe('isOptedOut', () => {
  // The creator is what the server stamps on a row a student created about
  // themselves, and it is the only thing here a student cannot choose.
  const row = (extra = {}) => ({
    user_id: 'student-1', created_by_id: 'student-1', deletion_status: 'active', ...extra,
  });

  it('sees a live opt out and ignores a soft deleted one', () => {
    expect(isOptedOut([row()], 'student-1')).toBe(true);
    expect(isOptedOut([row({ deletion_status: 'deleted' })], 'student-1')).toBe(false);
    expect(isOptedOut([row({ deletion_status: 'permanently_deleted' })], 'student-1')).toBe(false);
  });

  it('answers no for everybody else, and for nonsense', () => {
    expect(isOptedOut([row()], 'student-2')).toBe(false);
    expect(isOptedOut([], 'student-1')).toBe(false);
    expect(isOptedOut(null, 'student-1')).toBe(false);
    expect(isOptedOut([null, 7, 'x', {}], 'student-1')).toBe(false);
    expect(isOptedOut([row()], '')).toBe(false);
  });

  it('refuses every row a student could write about another student', () => {
    // RLS satisfies `create` with created_by_id == {{user.id}}, which the
    // server fills in for everybody, so any signed in student can write a row
    // naming any other student and silence our emails to them. Victim ids are
    // not secret. This check is the only thing standing in the way, so every
    // shape of the forgery is pinned here.
    expect(isOptedOut([row({ created_by_id: 'student-9' })], 'student-1')).toBe(false);
    // `source` is a field on the row the attacker writes, so it can never be
    // the thing that grants an exemption.
    expect(isOptedOut([row({ created_by_id: 'student-9', source: 'admin' })], 'student-1')).toBe(false);
    // And a row with no creator at all is a row we cannot attribute. The old
    // check short circuited on the empty string and honoured it.
    expect(isOptedOut([row({ created_by_id: '' })], 'student-1')).toBe(false);
    expect(isOptedOut([row({ created_by_id: undefined })], 'student-1')).toBe(false);
    expect(isOptedOut([{ user_id: 'student-1', deletion_status: 'active' }], 'student-1')).toBe(false);
    // Their own row still works, which is the whole point of the entity.
    expect(isOptedOut([row({ created_by_id: 'student-1' })], 'student-1')).toBe(true);
  });

  it('sees the row the settings page builds, and stops seeing it after opting back in', () => {
    // buildOptOut does not set created_by_id, because the server does. The
    // stamped row is what comes back and what gets read on the next pass.
    const created = { ...buildOptOut({ userId: 'student-1', source: 'settings', now: NOW }), created_by_id: 'student-1' };
    expect(isOptedOut([created], 'student-1')).toBe(true);
    const off = { ...created, ...optBackInPatch(NOW) };
    expect(isOptedOut([off], 'student-1')).toBe(false);
    expect(off.purge_at > off.deleted_at).toBe(true);
  });

  it('falls back to a legal source rather than writing one the entity rejects', () => {
    const sources = entityEnum('NudgeOptOut', 'source');
    expect(sources).toContain(buildOptOut({ userId: 'u', source: 'nonsense' }).source);
    expect(sources).toContain(buildOptOut({ userId: 'u', source: 'answer_page' }).source);
  });
});

describe('the last rung of no_path_selected promises only what happens', () => {
  const rung = LADDERS.no_path_selected[3];

  it('does not say we will build a new set from the reply, because nothing does', () => {
    // The copy used to say "we will throw the set out and build a new one from
    // what you tell us". No code anywhere read a reply and built anything.
    const copy = `${rung.title} ${rung.body} ${rung.question}`.toLowerCase();
    expect(copy).not.toContain('we will throw');
    expect(copy).not.toMatch(/we will (build|make|generate|create)/);
    // What is true is that settings builds one from personal context, and that
    // is where it now sends them.
    expect(rung.target).toBe('/settings');
    expect(rung.body).toContain('personal context');
  });

  it('closes nothing, so the page cannot offer to close something', () => {
    // This stall carries no subject id, so there is no path row to rule out.
    const ask = describeAsk(rowFor('no_path_selected', 3, { subject_id: '' }));
    expect(ask.action_kind).toBe('rule_out');
    expect(ask.closes).toBe(false);
    const plan = planResponse({
      nudge: rowFor('no_path_selected', 3, { subject_id: '' }),
      choice: 'answered',
      replyText: 'They are all finance and I want none of it.',
      now: NOW,
    });
    expect(plan.ruleOut).toBe(null);
    expect(plan.optOut).toBe(null);
    expect(plan.nudgeUpdate.reply_text).toBe('They are all finance and I want none of it.');
  });
});

describe('what the page says once the writes have been attempted', () => {
  const ruleOut = (saved, wroteText = true) => describeOutcome({
    choice: 'accepted',
    actionKind: 'rule_out',
    target: '/experiments',
    ruleOutPlanned: true,
    ruleOutSaved: saved,
    wroteText,
  });

  it('says it is closed out only when the subject write actually landed', () => {
    expect(ruleOut(true).line).toBe('Closed out. It is off your list, and what you wrote is saved with it.');
  });

  it('does not claim a thing was closed when the write refused', () => {
    // The whole point of this function. The page used to read the plan rather
    // than the result, so a student whose experiment row refused the update was
    // told it was off their list while it sat there unchanged.
    const out = ruleOut(false);
    expect(out.line).toBe('We saved what you wrote, but it is still on your list.');
    expect(out.body).toContain('did not save');
    expect(out.line).not.toContain('Closed out');
    // Their words really were saved, so the wording must not read as a failure.
    expect(out.line).toContain('We saved what you wrote');
  });

  it('does not claim it saved words on a rule out that was pressed with an empty box', () => {
    // The text box on a rule out is optional, so "we saved what you wrote" is a
    // claim about something that may not exist. Both branches have to hold.
    const failed = ruleOut(false, false);
    expect(failed.line).toBe('That did not go through: it is still on your list.');
    expect(failed.line).not.toContain('what you wrote');
    const saved = ruleOut(true, false);
    expect(saved.line).toBe('Closed out. It is off your list.');
    expect(saved.line).not.toContain('what you wrote');
    // And with words in the box it still says so.
    expect(ruleOut(true, true).line).toContain('what you wrote is saved with it');
  });

  it('tells the truth about the emails when the opt out did not save', () => {
    const on = describeOutcome({ choice: 'accepted', actionKind: 'rule_out', optOutPlanned: true, optOutSaved: true });
    expect(on.line).toContain('These are off now');
    const off = describeOutcome({ choice: 'accepted', actionKind: 'rule_out', optOutPlanned: true, optOutSaved: false, wroteText: true });
    expect(off.line).toBe('We saved what you wrote, but the emails are still on.');
    expect(off.to).toBe('/settings');
    expect(off.cta).toBe('Open settings');
    // Nobody has to type anything to ask us to stop, so the empty case is the
    // common one and it must not claim words were kept.
    const bare = describeOutcome({ choice: 'accepted', actionKind: 'rule_out', optOutPlanned: true, optOutSaved: false });
    expect(bare.line).toBe('That did not go through: the emails are still on.');
    expect(bare.line).not.toContain('what you wrote');
  });

  it('sends an accepted action rung straight to the thing, with a link left behind', () => {
    const out = describeOutcome({ choice: 'accepted', actionKind: 'generate_guide', target: '/experiment?experimentId=e1' });
    expect(out.goTo).toBe('/experiment?experimentId=e1');
    // The fallback is what a student sees if the navigation does not happen.
    expect(out.to).toBe('/experiment?experimentId=e1');
    expect(out.cta).toBe('Open it');
  });

  it('never navigates away from a question or a rule out', () => {
    // Both put their whole content on this screen, so leaving it is losing it.
    for (const actionKind of ['answer_question', 'rule_out']) {
      for (const choice of ['accepted', 'answered', 'declined']) {
        const out = describeOutcome({ choice, actionKind, target: '/experiments' });
        expect(out.goTo, `${actionKind}.${choice}`).toBe('');
      }
    }
  });

  it('goes nowhere when the rung has no target, and still offers a way out', () => {
    const out = describeOutcome({ choice: 'accepted', actionKind: 'log_proof', target: '' });
    expect(out.goTo).toBe('');
    expect(out.to).toBe(ANSWER_HOME);
    expect(out.cta).toBe('Go to My Journey');
  });

  it('refuses to send a student off this site', () => {
    for (const target of ['//evil.example.com', 'https://evil.example.com', 'javascript:alert(1)', '', null, 7]) {
      const out = describeOutcome({ choice: 'accepted', actionKind: 'send_outreach', target });
      expect(out.goTo, String(target)).toBe('');
      expect(out.to, String(target)).toBe(ANSWER_HOME);
    }
    expect(internalRoute('/paths')).toBe('/paths');
    expect(internalRoute('//evil.example.com')).toBe('');
    expect(internalRoute('https://evil.example.com')).toBe('');
  });

  it('refuses the shapes that only look internal until a url parser reads them', () => {
    // A backslash opens an authority exactly like a slash does, and tab, newline
    // and carriage return are stripped before parsing, so each of these resolves
    // to a different host. Every one is asserted against real url resolution
    // below rather than against a hand written expectation.
    const attacks = [
      '/\\evil.example.com',
      '/\\\\evil.example.com',
      '/\\/evil.example.com',
      '/\t/evil.example.com',
      '/\n/evil.example.com',
      '/\r/evil.example.com',
      '/\t\\evil.example.com',
      '/\t\t/evil.example.com',
      '/\\\tevil.example.com',
      ' /\\evil.example.com',
    ];
    const base = 'https://useunscripted.base44.app/answer';
    for (const target of attacks) {
      expect(new URL(target, base).host, JSON.stringify(target)).toBe('evil.example.com');
      expect(internalRoute(target), JSON.stringify(target)).toBe('');
      const out = describeOutcome({ choice: 'accepted', actionKind: 'send_outreach', target });
      expect(out.goTo, JSON.stringify(target)).toBe('');
    }
    // Same origin routes with odd but harmless characters still work.
    expect(internalRoute('/experiment?experimentId=a%09b')).toBe('/experiment?experimentId=a%09b');
    expect(internalRoute('/paths?q=a b')).toBe('/paths?q=a b');
  });

  it('has a plain sentence for a declined and an answered ask, and for nonsense', () => {
    expect(describeOutcome({ choice: 'declined' }).line).toBe('Noted. The next one we send will be smaller.');
    expect(describeOutcome({ choice: 'answered' }).line).toContain('That is on your account');
    expect(describeOutcome({}).line).toBe('Saved. Thanks.');
    expect(describeOutcome().line).toBe('Saved. Thanks.');
  });

  it('writes every sentence without a dash we ban', () => {
    const shapes = [
      { choice: 'accepted', actionKind: 'rule_out', ruleOutPlanned: true, ruleOutSaved: true },
      { choice: 'accepted', actionKind: 'rule_out', ruleOutPlanned: true, ruleOutSaved: false },
      { choice: 'accepted', actionKind: 'rule_out', optOutPlanned: true, optOutSaved: true },
      { choice: 'accepted', actionKind: 'rule_out', optOutPlanned: true, optOutSaved: false },
      { choice: 'accepted', actionKind: 'open_guide', target: '/journey' },
      { choice: 'accepted', actionKind: 'open_guide', target: '' },
      { choice: 'declined' }, { choice: 'answered' }, {},
    ];
    for (const shape of shapes) {
      const out = describeOutcome(shape);
      expect(/[—–]/.test(`${out.line} ${out.body} ${out.cta}`), out.line).toBe(false);
    }
  });
});

describe('a removed ask is a dead end before a student types, not after', () => {
  it('knows a soft deleted row when it sees one', () => {
    expect(isSoftDeleted({ deletion_status: 'deleted' })).toBe(true);
    expect(isSoftDeleted({ deletion_status: 'permanently_deleted' })).toBe(true);
    expect(isSoftDeleted({ deletion_status: 'active' })).toBe(false);
    expect(isSoftDeleted({})).toBe(false);
    for (const bad of [null, undefined, 7, 'row']) expect(isSoftDeleted(bad)).toBe(false);
  });

  it('agrees with the answer planner, which refuses the same row', () => {
    // The page reads it on load and the planner reads it on send. Before this,
    // only the planner did, so the student got the whole ask, typed a sentence,
    // pressed send, and then read "This ask has been removed."
    const row = rowFor('experiment_without_guide', 0, { deletion_status: 'deleted' });
    expect(isSoftDeleted(row)).toBe(true);
    expect(planResponse({ nudge: row, choice: 'declined', now: NOW }).nudgeUpdate).toBe(null);
  });
});

describe('the opt out rows a settings page should believe', () => {
  const live = { id: 'o1', user_id: 'student-1', created_by_id: 'student-1', deletion_status: 'active' };

  it('keeps a row the server has not caught up with yet', () => {
    // The read straight after the create can come back without it, and the
    // control would say the emails are still on a second after the student
    // turned them off.
    expect(isOptedOut(mergeOptOutRows([], [live]), 'student-1')).toBe(true);
  });

  it('lets this session win over a stale read of the same row', () => {
    const off = { ...live, ...optBackInPatch(NOW) };
    const merged = mergeOptOutRows([live], [off]);
    expect(merged).toHaveLength(1);
    expect(isOptedOut(merged, 'student-1')).toBe(false);
  });

  it('keeps everything the read returned that this session did not touch', () => {
    const other = { id: 'o2', user_id: 'student-1', created_by_id: 'student-1', deletion_status: 'active' };
    const merged = mergeOptOutRows([other], [{ ...live, deletion_status: 'deleted' }]);
    expect(merged.map(r => r.id).sort()).toEqual(['o1', 'o2']);
    expect(isOptedOut(merged, 'student-1')).toBe(true);
  });

  it('survives anything either side hands it', () => {
    expect(mergeOptOutRows(null)).toEqual([]);
    expect(mergeOptOutRows(undefined, null)).toEqual([]);
    expect(mergeOptOutRows([null, 7, 'x'], [null])).toEqual([]);
    expect(mergeOptOutRows([live])).toEqual([live]);
  });

  it('sees the row the settings page builds the moment the button is pressed', () => {
    // buildOptOut leaves created_by_id to the server, and isOptedOut requires
    // it, so the page fills its own id in on the row it just created. Without
    // that the button reads "Stop these emails" straight after it was pressed.
    const built = buildOptOut({ userId: 'student-1', source: 'settings', now: NOW });
    expect(isOptedOut([built], 'student-1')).toBe(false);
    const seen = { ...built, id: 'o9', created_by_id: 'student-1' };
    expect(isOptedOut(mergeOptOutRows([], [seen]), 'student-1')).toBe(true);
  });
});

describe('shouldSkipPass, once a student has opted out', () => {
  // A pulse with a real stall on it, so the only thing that can produce a skip
  // reason here is the opt out itself.
  const pulse = {
    state: 'stalled',
    stalls: [{
      kind: 'experiment_without_guide',
      severity: 70,
      subjectId: 'e1',
      subjectName: 'Shadow an analyst',
      subjectType: 'experiment',
      label: 'x',
      sinceISO: NOW,
      days: 20,
    }],
  };
  const user = { id: 'student-1', email: 'student@fairfield.edu' };

  it('has nothing to skip for when nobody opted out', () => {
    expect(shouldSkipPass({ pulse, history: [], now: NOW, user })).toBe(null);
  });

  it('skips a student with a live opt out row', () => {
    const rows = [{ user_id: 'student-1', created_by_id: 'student-1', deletion_status: 'active' }];
    expect(shouldSkipPass({
      pulse, history: [], now: NOW, user, optOuts: rows,
    })).toBe('the student turned these emails off');
  });

  it('takes the answer already worked out, for a caller that did it in bulk', () => {
    expect(shouldSkipPass({
      pulse, history: [], now: NOW, user, optedOut: true,
    })).toBe('the student turned these emails off');
  });

  it('leaves everybody else alone, including the owner of a soft deleted row', () => {
    const someoneElse = [{ user_id: 'student-9', created_by_id: 'student-9', deletion_status: 'active' }];
    expect(shouldSkipPass({
      pulse, history: [], now: NOW, user, optOuts: someoneElse,
    })).toBe(null);
    const turnedBackOn = [{ user_id: 'student-1', created_by_id: 'student-1', deletion_status: 'deleted' }];
    expect(shouldSkipPass({
      pulse, history: [], now: NOW, user, optOuts: turnedBackOn,
    })).toBe(null);
  });
});