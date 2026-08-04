import { describe, it, expect } from 'vitest';
import { planPass, groupRowsByUser, DEFAULT_PASS_LIMIT } from './nudge-pass.js';

const DAY = 86400000;
const BASE = Date.parse('2026-06-01T12:00:00.000Z');
const at = (d) => new Date(BASE + d * DAY).toISOString();
const NOW = at(0);

/**
 * A population of students who all look the same to the engine: signed up 40
 * days ago, one experiment with no steps, nothing else. They differ only in id,
 * so anything that changes which of them gets the email is the ordering rule
 * and nothing else.
 */
function population(count) {
  const users = [];
  const experiments = [];
  for (let i = 0; i < count; i += 1) {
    const id = `u${String(i).padStart(3, '0')}`;
    users.push({ id, email: `${id}@student.fairfield.edu`, full_name: `Student ${i}`, created_date: at(-40) });
    experiments.push({
      id: `e${id}`, user_id: id, title: `Shadow an analyst ${i}`,
      status: 'planned', created_date: at(-30),
    });
  }
  return { users, experiments };
}

function planFor(count, over = {}) {
  const { users, experiments } = population(count);
  const rowsByUser = groupRowsByUser(users, { experiments });
  return planPass({ users, rowsByUser, history: [], now: NOW, passNumber: 1, ...over });
}

/** The row a pass would have written, as it comes back off the API. */
const asStored = (ask, i, sentAt) => ({
  ...ask, id: `n${i}`, delivered_at: sentAt, delivered_channel: 'email', created_date: sentAt,
});

describe('the send cap', () => {
  it('never plans more than the limit, however many students qualify', () => {
    const plan = planFor(82, { limit: 25 });
    expect(plan.toCreate).toHaveLength(25);
    expect(plan.toEmail).toHaveLength(25);
    expect(plan.counts.asked).toBe(25);
  });

  it('holds the rest back by name instead of dropping them silently', () => {
    const plan = planFor(82, { limit: 25 });
    const held = plan.skipped.filter((s) => s.reason === 'held back by the send cap for this pass');
    expect(held).toHaveLength(57);
    expect(plan.counts.users).toBe(82);
    expect(plan.counts.asked + plan.counts.skipped + plan.counts.silent).toBe(82);
  });

  it('writes no row for a student it held back, so nothing expires on them later', () => {
    const plan = planFor(82, { limit: 25 });
    const asked = new Set(plan.toEmail.map((e) => e.userId));
    for (const row of plan.toCreate) expect(asked.has(row.user_id)).toBe(true);
  });

  it('uses a low default when the caller does not pass one', () => {
    expect(planFor(82).toCreate).toHaveLength(DEFAULT_PASS_LIMIT);
  });

  it('plans nothing at all at a limit of zero', () => {
    const plan = planFor(10, { limit: 0 });
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toEmail).toHaveLength(0);
  });
});

describe('who gets the email this week', () => {
  it('writes to different students next week rather than the same 25 forever', () => {
    const { users, experiments } = population(82);
    const rowsByUser = groupRowsByUser(users, { experiments });

    const first = planPass({ users, rowsByUser, history: [], now: at(0), passNumber: 1, limit: 25 });
    const history = first.toCreate.map((ask, i) => asStored(ask, i, at(0)));

    const second = planPass({ users, rowsByUser, history, now: at(8), passNumber: 2, limit: 25 });

    const week1 = new Set(first.toEmail.map((e) => e.userId));
    const week2 = second.toEmail.map((e) => e.userId);
    expect(week2).toHaveLength(25);
    for (const id of week2) expect(week1.has(id), `${id} was written to twice`).toBe(false);

    // And a third week reaches the last of them rather than starting over.
    const history2 = [
      ...history,
      ...second.toCreate.map((ask, i) => asStored(ask, 100 + i, at(8))),
    ];
    const third = planPass({ users, rowsByUser, history: history2, now: at(16), passNumber: 3, limit: 25 });
    for (const id of third.toEmail.map((e) => e.userId)) {
      expect(week1.has(id), `${id} came round again before everyone had a turn`).toBe(false);
      expect(week2.includes(id), `${id} came round again before everyone had a turn`).toBe(false);
    }
  });

  it('prefers the student who has gone longest without hearing from us', () => {
    const { users, experiments } = population(4);
    const rowsByUser = groupRowsByUser(users, { experiments });
    // Three of the four were written to, at different times, long enough ago
    // that none of them is blocked. The one never written to must go first, and
    // the rest in the order they were last contacted.
    const history = [
      { id: 'a', user_id: 'u000', stall_kind: 'dormant_account', status: 'expired', delivered_at: at(-10), rung: 0 },
      { id: 'b', user_id: 'u001', stall_kind: 'dormant_account', status: 'expired', delivered_at: at(-30), rung: 0 },
      { id: 'c', user_id: 'u003', stall_kind: 'dormant_account', status: 'expired', delivered_at: at(-20), rung: 0 },
    ];
    const plan = planPass({ users, rowsByUser, history, now: NOW, passNumber: 2, limit: 4 });
    expect(plan.toEmail.map((e) => e.userId)).toEqual(['u002', 'u001', 'u003', 'u000']);
  });

  it('gives the same answer twice for the same inputs', () => {
    const a = JSON.stringify(planFor(40, { limit: 7 }));
    const b = JSON.stringify(planFor(40, { limit: 7 }));
    expect(a).toBe(b);
  });
});

describe('who never gets one', () => {
  it('never plans an email to an account with no address on it', () => {
    const { users, experiments } = population(3);
    users[1] = { ...users[1], email: '' };
    const rowsByUser = groupRowsByUser(users, { experiments });
    const plan = planPass({ users, rowsByUser, history: [], now: NOW, passNumber: 1, limit: 25 });

    expect(plan.toEmail.map((e) => e.userId)).not.toContain('u001');
    expect(plan.toCreate.map((r) => r.user_id)).not.toContain('u001');
    expect(plan.skipped).toContainEqual({ userId: 'u001', reason: 'no email address on the account' });
    for (const entry of plan.toEmail) expect(entry.email.length).toBeGreaterThan(0);
  });

  it('lets a skip reason beat an ask that was there for the taking', () => {
    const { users, experiments } = population(2);
    const rowsByUser = groupRowsByUser(users, { experiments });

    // With no history both students are asked.
    const open = planPass({ users, rowsByUser, history: [], now: NOW, passNumber: 1, limit: 25 });
    expect(open.toEmail.map((e) => e.userId)).toEqual(['u000', 'u001']);

    // One of them has an ask from three days ago still open. Same stall, same
    // ladder, same everything else: the only difference is that we are already
    // waiting on an answer, and that has to win.
    const history = [{
      id: 'n1', user_id: 'u001', stall_kind: 'experiment_without_guide', subject_id: 'eu001',
      rung: 0, rung_key: 'experiment_without_guide.r0', size: 'large', action_kind: 'generate_guide',
      status: 'pending', delivered_at: at(-3), delivered_channel: 'email', deletion_status: 'active',
    }];
    const plan = planPass({ users, rowsByUser, history, now: NOW, passNumber: 2, limit: 25 });
    expect(plan.toEmail.map((e) => e.userId)).toEqual(['u000']);
    expect(plan.skipped).toContainEqual({
      userId: 'u001', reason: 'an ask from an earlier pass is still open',
    });
  });

  it('counts a student with nothing wrong as silent, not as an ask', () => {
    const users = [{ id: 'u1', email: 'a@b.edu', created_date: at(-1) }];
    const plan = planPass({ users, rowsByUser: {}, history: [], now: NOW, passNumber: 1, limit: 25 });
    expect(plan.toEmail).toHaveLength(0);
    expect(plan.silent).toEqual([{ userId: 'u1' }]);
  });

  it('refuses to plan anything at all without a usable clock', () => {
    const { users, experiments } = population(5);
    const rowsByUser = groupRowsByUser(users, { experiments });
    const plan = planPass({ users, rowsByUser, history: [], now: 'not a date', passNumber: 1 });
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toEmail).toHaveLength(0);
    expect(plan.skipped).toHaveLength(5);
  });
});

describe('the plan is internally consistent', () => {
  it('keeps toCreate and toEmail in step, row for row', () => {
    const plan = planFor(30, { limit: 12 });
    expect(plan.toEmail).toHaveLength(plan.toCreate.length);
    for (let i = 0; i < plan.toCreate.length; i += 1) {
      expect(plan.toEmail[i].ask).toBe(plan.toCreate[i]);
      expect(plan.toEmail[i].userId).toBe(plan.toCreate[i].user_id);
      expect(plan.toEmail[i].email).toBe(`${plan.toCreate[i].user_id}@student.fairfield.edu`);
    }
  });

  it('writes rows the entity will accept', () => {
    const plan = planFor(5, { limit: 5, passNumber: 4 });
    for (const rowData of plan.toCreate) {
      for (const field of ['user_id', 'stall_kind', 'status']) {
        expect(String(rowData[field] || '').length, field).toBeGreaterThan(0);
      }
      expect(rowData.pass_number).toBe(4);
      expect(rowData.generated_at).toBe(NOW);
      expect(rowData.delivered_channel).toBe('none');
      expect(rowData.pulse_summary.length).toBeGreaterThan(0);
      for (const [key, value] of Object.entries(rowData)) {
        expect(value === undefined, key).toBe(false);
        expect(typeof value === 'number' && !Number.isFinite(value), key).toBe(false);
      }
    }
  });

  it('expires the pending rows that ran out of time and leaves the rest', () => {
    const { users, experiments } = population(3);
    const rowsByUser = groupRowsByUser(users, { experiments });
    const pending = (id, user, sentAt) => ({
      id, user_id: user, stall_kind: 'experiment_without_guide', status: 'pending',
      delivered_at: sentAt, rung: 0, rung_key: 'experiment_without_guide.r0', deletion_status: 'active',
    });
    const history = [
      pending('old', 'u000', at(-9)),       // past the window
      pending('edge', 'u001', at(-7)),      // exactly on it, so not yet
      pending('fresh', 'u002', at(-1)),     // well inside it
    ];
    const plan = planPass({ users, rowsByUser, history, now: NOW, passNumber: 2, limit: 25 });
    expect(plan.toExpire).toEqual(['old']);
    expect(plan.counts.expired).toBe(1);
  });

  it('expires rows for students this pass is not going to write to', () => {
    // The cap holds 1 of the 2 back. Bookkeeping still has to happen for both,
    // or a held back student's ask never expires and never costs a rung.
    const { users, experiments } = population(2);
    const rowsByUser = groupRowsByUser(users, { experiments });
    const history = [0, 1].map((i) => ({
      id: `n${i}`, user_id: `u00${i}`, stall_kind: 'experiment_without_guide', status: 'pending',
      delivered_at: at(-30), rung: 0, rung_key: 'experiment_without_guide.r0', deletion_status: 'active',
    }));
    const plan = planPass({ users, rowsByUser, history, now: NOW, passNumber: 2, limit: 1 });
    expect(plan.toExpire.sort()).toEqual(['n0', 'n1']);
  });
});

describe('turning ten flat lists back into one per student', () => {
  const users = [
    { id: 'u1', email: 'Sam@Fairfield.edu' },
    { id: 'u2', email: 'ada@fairfield.edu' },
  ];

  it('reads the owner off user_id, then created_by_id, then the email', () => {
    const grouped = groupRowsByUser(users, {
      experiments: [
        { id: 'e1', user_id: 'u1' },
        { id: 'e2', created_by_id: 'u2' },
        { id: 'e3', created_by: 'sam@fairfield.edu' },
      ],
    });
    expect(grouped.u1.experiments.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(grouped.u2.experiments.map((e) => e.id)).toEqual(['e2']);
  });

  it('drops a row whose owner is nobody we have, rather than guessing', () => {
    const grouped = groupRowsByUser(users, {
      experiments: [{ id: 'e1', user_id: 'someone-who-left' }, { id: 'e2' }],
    });
    expect(grouped.u1.experiments).toHaveLength(0);
    expect(grouped.u2.experiments).toHaveLength(0);
  });

  it('takes the newest profile when a student has more than one', () => {
    const grouped = groupRowsByUser(users, {
      profiles: [
        { id: 'p1', created_by_id: 'u1', created_date: at(-10) },
        { id: 'p2', created_by_id: 'u1', created_date: at(-1) },
      ],
    });
    expect(grouped.u1.profile.id).toBe('p2');
  });

  it('gives every student every bucket, so a caller never checks for undefined', () => {
    const grouped = groupRowsByUser(users, {});
    for (const key of ['paths', 'experiments', 'missions', 'guides', 'proof', 'reflections', 'outreach', 'events', 'nudges']) {
      expect(Array.isArray(grouped.u1[key]), key).toBe(true);
    }
    expect(grouped.u1.profile).toBe(null);
  });

  it('does not fall over on the shapes this database actually holds', () => {
    const grouped = groupRowsByUser(
      [null, { id: '' }, ...users],
      { experiments: [null, 'nonsense', { id: 'e1', user_id: 'u1' }], paths: undefined },
    );
    expect(grouped.u1.experiments).toHaveLength(1);
  });
});
