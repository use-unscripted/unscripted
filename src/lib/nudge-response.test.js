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
  RESPONSE_FIELDS, rungForKey,
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

  it('degrades to the stored copy when the rung is gone, and says so', () => {
    const row = rowFor('experiment_without_guide', 0, {
      rung_key: 'experiment_without_guide.r99',
      ask_title: 'An ask from a ladder that no longer exists',
      ask_body: 'The body it was sent with.',
    });
    const ask = describeAsk(row);
    expect(ask.source).toBe('stored');
    expect(ask.rungKnown).toBe(false);
    expect(ask.title).toBe('An ask from a ladder that no longer exists');
    // And it offers nowhere to go, because the target came off the ladder too.
    expect(ask.target).toBe('');
  });

  it('does not throw on a row that is barely a row', () => {
    for (const bad of [null, undefined, 42, 'nudge', {}, { rung_key: 7, ask_title: {} }]) {
      expect(() => describeAsk(bad)).not.toThrow();
    }
    expect(describeAsk({}).source).toBe('none');
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
  const row = (extra = {}) => ({ user_id: 'student-1', deletion_status: 'active', ...extra });

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

  it('refuses a row one student wrote about another', () => {
    // Nothing in RLS stops a student creating a row naming somebody else, which
    // would silence our emails to that person. This is the check that does.
    expect(isOptedOut([row({ created_by_id: 'student-9' })], 'student-1')).toBe(false);
    expect(isOptedOut([row({ created_by_id: 'student-1' })], 'student-1')).toBe(true);
    // Unless an admin recorded it on their behalf, which says so.
    expect(isOptedOut([row({ created_by_id: 'admin-1', source: 'admin' })], 'student-1')).toBe(true);
  });

  it('sees the row the settings page builds, and stops seeing it after opting back in', () => {
    const created = buildOptOut({ userId: 'student-1', source: 'settings', now: NOW });
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
