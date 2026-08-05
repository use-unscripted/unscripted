import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The point of this file is one line in pilot-access: which field decides that
 * somebody is an admin.
 *
 * `access_source` is written by the account itself. Measured against the real
 * backend on 2026-08-04 as a signed-in non-admin student, both the auth
 * endpoint and a direct update to the account's own row accepted
 * `internal_admin` and it stuck. `role` was refused by the platform from both.
 * So a test that only checks "an admin gets in" would have stayed green through
 * the entire window where any student could let themselves in, and that is the
 * test this file exists to not be.
 */

let currentUser;
let cycles;

vi.mock('@/api/base44Client', () => ({
  base44: {
    auth: { me: () => Promise.resolve(currentUser) },
    entities: {
      CareerCycle: { filter: () => Promise.resolve(cycles) },
      ContinuationInterest: { list: () => Promise.resolve([]) },
    },
  },
}));

const { loadPilotAccess } = await import('@/lib/pilot-access');

beforeEach(() => {
  currentUser = null;
  cycles = [];
});

describe('who counts as an admin', () => {
  it('lets the platform role in', async () => {
    currentUser = { id: 'u_admin', role: 'admin', access_source: 'independent_beta' };

    expect((await loadPilotAccess()).isAdmin).toBe(true);
  });

  it('refuses internal_admin without the role, because the account writes that field', async () => {
    currentUser = { id: 'u_student', role: 'user', access_source: 'internal_admin' };

    expect((await loadPilotAccess()).isAdmin).toBe(false);
  });

  it('refuses a sponsored student', async () => {
    currentUser = { id: 'u_sponsored', role: 'user', access_source: 'institution_sponsored' };

    expect((await loadPilotAccess()).isAdmin).toBe(false);
  });

  it('refuses a plain student', async () => {
    currentUser = { id: 'u_plain', role: 'user', access_source: 'independent_beta' };

    expect((await loadPilotAccess()).isAdmin).toBe(false);
  });

  it('refuses a signed out visitor rather than throwing', async () => {
    currentUser = null;

    expect((await loadPilotAccess()).isAdmin).toBe(false);
  });

  it('keeps the role when the account also carries the label', async () => {
    currentUser = { id: 'u_ops', role: 'admin', access_source: 'internal_admin' };

    expect((await loadPilotAccess()).isAdmin).toBe(true);
  });
});

describe('what internal_admin still buys, which is cycles and nothing else', () => {
  it('still lifts the cycle limit', async () => {
    currentUser = { id: 'u_student', role: 'user', access_source: 'internal_admin' };
    cycles = [{ id: 'c1', status: 'completed' }, { id: 'c2', status: 'completed' }];

    const access = await loadPilotAccess();

    expect(access.unlimitedCycles).toBe(true);
    expect(access.canStartNewCycle).toBe(true);
    expect(access.isAdmin).toBe(false);
  });

  it('stops an independent student at one cycle', async () => {
    currentUser = { id: 'u_plain', role: 'user', access_source: 'independent_beta' };
    cycles = [{ id: 'c1', status: 'completed' }];

    const access = await loadPilotAccess();

    expect(access.canStartNewCycle).toBe(false);
  });

  it('treats an unknown access source as independent rather than trusting it', async () => {
    currentUser = { id: 'u_odd', role: 'user', access_source: 'staff' };

    const access = await loadPilotAccess();

    expect(access.accessSource).toBe('independent_beta');
    expect(access.isAdmin).toBe(false);
    expect(access.unlimitedCycles).toBe(false);
  });
});
