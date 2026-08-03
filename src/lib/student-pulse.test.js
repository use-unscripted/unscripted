import { describe, it, expect } from 'vitest';
import { readPulse, summarizePulse } from '@/lib/student-pulse';

// Every fixture is anchored to one signup so the day arithmetic is readable.
// Signup is midday on 1 July 2026 UTC; NOW is 20 days later.
const SIGNUP = '2026-07-01T12:00:00.000000';
const NOW = '2026-07-21T12:00:00.000Z';
const LATER = '2026-08-20T12:00:00.000Z';

const days = (n) => new Date(Date.parse('2026-07-01T12:00:00.000Z') + n * 86400000).toISOString();
// The Base44 read-back shape: same instant, no zone marker.
const naive = (n) => days(n).replace('Z', '000');

const user = (over = {}) => ({ id: 'u1', email: 'x@y.edu', full_name: 'Sam', created_date: SIGNUP, ...over });
const profile = (over = {}) => ({ id: 'sp1', name: 'Sam', college: 'Fairfield', major: 'Econ', created_date: SIGNUP, ...over });

const path = (over = {}) => ({
  id: 'p1', path_id: 'catalog-1', path_name: 'Product analyst',
  status: 'exploring', is_primary_focus: false, created_date: SIGNUP, ...over,
});
const experiment = (over = {}) => ({
  id: 'e1', title: 'Shadow a product analyst', path_id: 'catalog-1', path_name: 'Product analyst',
  status: 'planned', deletion_status: 'active', created_date: SIGNUP, ...over,
});
const guide = (over = {}) => ({
  id: 'g1', experiment_id: 'e1', guide_title: 'How to shadow an analyst',
  version_number: 1, status: 'active', created_date: SIGNUP, ...over,
});
const mission = (over = {}) => ({
  id: 'm1', experiment_id: 'e1', title: 'Email two analysts',
  status: 'planned', created_date: SIGNUP, ...over,
});
const proofRow = (over = {}) => ({
  id: 'pr1', experiment_id: 'e1', title: 'Call notes', category: 'interview_notes',
  created_date: SIGNUP, ...over,
});
const reflection = (over = {}) => ({ id: 'wr1', experiment_id: 'e1', week_start: '2026-07-06', created_date: SIGNUP, ...over });
const contact = (over = {}) => ({ id: 'c1', name: 'Ada Reyes', response_status: 'not_sent', created_date: SIGNUP, ...over });
const event = (over = {}) => ({ id: 'pe1', event_name: 'path_selected', occurred_at: SIGNUP, created_date: SIGNUP, ...over });

const kinds = (pulse) => pulse.stalls.map((s) => s.kind);

// A student who is genuinely doing the work: chose a path, has a guide, finished
// a mission yesterday, logged proof, wrote a reflection, contacted someone.
function activeStudent(now = NOW) {
  return {
    now,
    user: user(),
    profile: profile(),
    paths: [path({ is_primary_focus: true, started_at: days(1) })],
    experiments: [experiment({ status: 'in_progress', created_date: days(2), status_history: [{ to_status: 'in_progress', changed_at: days(2) }] })],
    guides: [guide({ created_date: days(3) })],
    missions: [mission({ status: 'completed', completed_at: days(19), created_date: days(3) })],
    proof: [proofRow({ completed_at: '2026-07-19', created_date: days(18) })],
    reflections: [reflection({ created_date: days(18) })],
    outreach: [contact({ response_status: 'responded', date_contacted: '2026-07-15', last_contacted_date: '2026-07-15' })],
    events: [event({ occurred_at: days(1) })],
  };
}

describe('readPulse: an account with nothing in it', () => {
  it('reads a blank account without throwing and without a NaN anywhere', () => {
    const pulse = readPulse({ now: NOW, user: user() });
    expect(pulse.state).toBe('never_started');
    expect(pulse.daysSinceSignup).toBe(20);
    expect(pulse.lastEvidenceAt).toBeNull();
    expect(pulse.daysSinceEvidence).toBeNull();
    expect(pulse.lastEvidenceKind).toBeNull();
    expect(Object.values(pulse.evidence).every(Number.isFinite)).toBe(true);
    expect(Object.values(pulse.claimed).every(Number.isFinite)).toBe(true);
    expect(Object.values(pulse.gap).every(Number.isFinite)).toBe(true);
    expect(pulse.stalls.every((s) => Number.isFinite(s.severity) && Number.isFinite(s.days))).toBe(true);
  });

  it('survives no arguments at all, a missing user and missing arrays', () => {
    const bare = readPulse();
    expect(bare.state).toBe('never_started');
    expect(bare.daysSinceSignup).toBeNull();
    expect(bare.stalls).toEqual([]);
    expect(readPulse({ now: NOW }).claimed.experiments).toBe(0);
  });

  it('says a blank account has gone quiet once it is more than 3 days old', () => {
    expect(kinds(readPulse({ now: days(2), user: user() }))).not.toContain('dormant_account');
    const quiet = readPulse({ now: NOW, user: user() });
    expect(kinds(quiet)).toContain('dormant_account');
    expect(quiet.topStall.subjectType).toBe('account');
    expect(quiet.topStall.days).toBe(20);
  });
});

describe('readPulse: exactly one of a thing is not the same as none', () => {
  it('counts a single proof row as evidence and dates the pulse from it', () => {
    const pulse = readPulse({
      now: NOW, user: user(),
      experiments: [experiment()],
      proof: [proofRow({ completed_at: '2026-07-18' })],
    });
    expect(pulse.evidence.proof).toBe(1);
    expect(pulse.lastEvidenceKind).toBe('proof');
    // ProofOfWork.completed_at is date-only, which is a calendar day anchored at
    // local noon, so 18 July sits 2 whole days before midday on the 21st.
    expect(pulse.daysSinceEvidence).toBe(2);
    expect(pulse.gap.experimentsWithoutProof).toBe(0);
  });

  it('counts a single completed mission and uses completed_at, not updated_date', () => {
    const pulse = readPulse({
      now: NOW, user: user(),
      missions: [mission({ status: 'completed', completed_at: days(17), updated_date: days(20) })],
    });
    expect(pulse.evidence.missionsCompleted).toBe(1);
    expect(pulse.gap.missionsNeverCompleted).toBe(0);
    expect(pulse.lastEvidenceKind).toBe('mission');
    expect(pulse.daysSinceEvidence).toBe(3);
  });

  it('counts a single guide as weak evidence and closes the guide gap for its experiment', () => {
    const pulse = readPulse({
      now: NOW, user: user(),
      experiments: [experiment()],
      guides: [guide({ created_date: days(4) })],
    });
    expect(pulse.evidence.guides).toBe(1);
    expect(pulse.gap.experimentsWithoutGuide).toBe(0);
    expect(pulse.lastEvidenceKind).toBe('guide');
    expect(kinds(pulse)).not.toContain('experiment_without_guide');
  });

  it('counts a single contact that was actually written to', () => {
    const pulse = readPulse({
      now: NOW, user: user(),
      outreach: [contact({ response_status: 'sent', date_contacted: '2026-07-19' })],
    });
    expect(pulse.evidence.outreachSent).toBe(1);
    expect(pulse.evidence.outreachResponded).toBe(0);
    expect(pulse.lastEvidenceKind).toBe('outreach');
  });

  it('does not count a saved contact that was never written to', () => {
    const pulse = readPulse({ now: NOW, user: user(), outreach: [contact({ response_status: 'planning' })] });
    expect(pulse.evidence.outreachSent).toBe(0);
    expect(pulse.lastEvidenceAt).toBeNull();
    expect(kinds(pulse)).toContain('outreach_never_sent');
  });

  it('counts a single reflection', () => {
    const pulse = readPulse({ now: NOW, user: user(), reflections: [reflection({ created_date: days(19) })] });
    expect(pulse.evidence.reflections).toBe(1);
    expect(pulse.lastEvidenceKind).toBe('reflection');
    expect(pulse.daysSinceEvidence).toBe(1);
  });

  it('reads the PilotEvent ledger as the weakest evidence there is', () => {
    const pulse = readPulse({ now: NOW, user: user(), events: [event({ occurred_at: days(10) })] });
    expect(pulse.lastEvidenceKind).toBe('event');
    expect(pulse.daysSinceEvidence).toBe(10);
  });
});

describe('readPulse: soft-deleted rows never count', () => {
  it('drops deleted and permanently_deleted rows from every count', () => {
    const pulse = readPulse({
      now: NOW,
      user: user(),
      paths: [path({ status: 'archived' })],
      experiments: [experiment({ deletion_status: 'deleted' }), experiment({ id: 'e2', deletion_status: 'permanently_deleted' })],
      missions: [mission({ status: 'completed', completed_at: days(19), deletion_status: 'deleted' })],
      guides: [guide({ deletion_status: 'deleted' })],
      proof: [proofRow({ deletion_status: 'deleted' })],
      reflections: [reflection({ deletion_status: 'permanently_deleted' })],
      outreach: [contact({ response_status: 'sent', date_contacted: '2026-07-19', deletion_status: 'deleted' })],
    });
    expect(pulse.evidence).toEqual({
      proof: 0, missionsCompleted: 0, outreachSent: 0, outreachResponded: 0, reflections: 0, guides: 0,
    });
    expect(pulse.claimed).toEqual({
      paths: 0, experiments: 0, experimentsInProgress: 0, experimentsCompleted: 0, missionsPlanned: 0,
    });
    expect(pulse.lastEvidenceAt).toBeNull();
  });

  it('drops a guide that carries its deletion in the status enum instead', () => {
    // 8 live of 14 ever: six of them are hidden this way, not by deletion_status.
    const pulse = readPulse({
      now: NOW, user: user(),
      experiments: [experiment({ created_date: days(0) })],
      guides: [guide({ status: 'deleted' })],
    });
    expect(pulse.evidence.guides).toBe(0);
    expect(pulse.gap.experimentsWithoutGuide).toBe(1);
    expect(kinds(pulse)).toContain('experiment_without_guide');
  });

  it('does not let a deleted proof row hide a stall the live rows deserve', () => {
    const pulse = readPulse({
      now: NOW, user: user(),
      experiments: [experiment({ status: 'in_progress', created_date: days(0) })],
      guides: [guide({ created_date: days(0) })],
      proof: [proofRow({ deletion_status: 'deleted', created_date: days(1) })],
    });
    expect(kinds(pulse)).toContain('experiment_no_proof');
    expect(kinds(pulse)).toContain('guide_never_acted_on');
  });
});

describe('readPulse: the status field lies', () => {
  it('treats in_progress with nothing behind it as a stall, never as evidence', () => {
    const pulse = readPulse({
      now: NOW,
      user: user(),
      paths: [path({ is_primary_focus: true })],
      experiments: [experiment({ status: 'in_progress', created_date: days(0) })],
    });
    expect(pulse.claimed.experimentsInProgress).toBe(1);
    expect(pulse.lastEvidenceAt).toBeNull();
    expect(pulse.daysSinceEvidence).toBeNull();
    expect(pulse.evidence.proof).toBe(0);
    expect(kinds(pulse)).toContain('experiment_no_proof');
    expect(pulse.state).toBe('dormant');
  });

  it('dates experiment_no_proof from the status change, not from row creation', () => {
    const withHistory = readPulse({
      now: NOW,
      user: user(),
      experiments: [experiment({
        status: 'in_progress',
        created_date: days(0),
        status_history: [{ from_status: 'planned', to_status: 'in_progress', changed_at: days(18) }],
      })],
    });
    // Started two days ago, so it has not been open long enough to be a stall.
    expect(kinds(withHistory)).not.toContain('experiment_no_proof');
  });

  it('ignores a mission marked planned when asking what was completed', () => {
    const pulse = readPulse({ now: NOW, user: user(), missions: [mission({ status: 'planned', created_date: days(0) })] });
    expect(pulse.evidence.missionsCompleted).toBe(0);
    expect(pulse.claimed.missionsPlanned).toBe(1);
    expect(pulse.gap.missionsNeverCompleted).toBe(1);
    expect(kinds(pulse)).toContain('mission_planned_stale');
  });
});

describe('readPulse: never came back', () => {
  it('is true when everything on the account happened the day they signed up', () => {
    const pulse = readPulse({
      now: NOW, user: user(),
      experiments: [experiment()],
      guides: [guide()],
      events: [event()],
    });
    expect(pulse.neverReturned).toBe(true);
  });

  it('is true for an account with literally no evidence at all', () => {
    expect(readPulse({ now: NOW, user: user() }).neverReturned).toBe(true);
  });

  it('is false as soon as one piece of evidence lands on a later calendar day', () => {
    const pulse = readPulse({
      now: NOW, user: user(),
      guides: [guide()],
      proof: [proofRow({ completed_at: '2026-07-04' })],
    });
    expect(pulse.neverReturned).toBe(false);
  });

  it('is not fooled by a zoneless timestamp four hours after a local midnight', () => {
    // 20:00 on 1 July in New York, handed back by Base44 without its Z. Read as
    // local time this would land on 2 July and look like a second day.
    const sameNight = readPulse({
      now: NOW, user: user({ created_date: '2026-07-01T18:00:00.000000' }),
      guides: [guide({ created_date: '2026-07-02T00:30:00.000000' })],
    });
    expect(sameNight.neverReturned).toBe(true);
  });

  it('stays false when there is no signup date to compare against', () => {
    expect(readPulse({ now: NOW, user: null, guides: [guide()] }).neverReturned).toBe(false);
  });
});

describe('readPulse: the stall list', () => {
  it('flags paths that were generated and never chosen', () => {
    const pulse = readPulse({
      now: NOW, user: user(),
      paths: [path(), path({ id: 'p2', path_name: 'UX research' })],
    });
    expect(pulse.topStall.kind).toBe('no_path_selected');
    expect(pulse.topStall.subjectType).toBe('path');
    expect(pulse.state).toBe('dormant');
  });

  it('stops flagging it once one path is the primary focus or is active', () => {
    const focus = readPulse({ now: NOW, user: user(), paths: [path({ is_primary_focus: true })] });
    const active = readPulse({ now: NOW, user: user(), paths: [path({ status: 'active' })] });
    expect(kinds(focus)).not.toContain('no_path_selected');
    expect(kinds(active)).not.toContain('no_path_selected');
    expect(kinds(focus)).toContain('path_without_experiment');
  });

  it('does not call a path empty when an experiment sits under it', () => {
    const pulse = readPulse({
      now: NOW, user: user(),
      paths: [path({ is_primary_focus: true })],
      experiments: [experiment()],
    });
    expect(kinds(pulse)).not.toContain('path_without_experiment');
  });

  it('waits 3 days before calling an experiment guideless', () => {
    const fresh = readPulse({ now: days(2), user: user(), experiments: [experiment({ created_date: days(0) })] });
    const stale = readPulse({ now: days(9), user: user(), experiments: [experiment({ created_date: days(0) })] });
    expect(kinds(fresh)).not.toContain('experiment_without_guide');
    expect(kinds(stale)).toContain('experiment_without_guide');
  });

  it('leaves a finished experiment alone', () => {
    const pulse = readPulse({ now: NOW, user: user(), experiments: [experiment({ status: 'completed', created_date: days(0) })] });
    expect(kinds(pulse)).not.toContain('experiment_without_guide');
  });

  it('flags a guide that produced nothing after 5 days, and clears once a mission lands', () => {
    const ignored = readPulse({ now: NOW, user: user(), experiments: [experiment()], guides: [guide({ created_date: days(0) })] });
    expect(kinds(ignored)).toContain('guide_never_acted_on');

    const acted = readPulse({
      now: NOW, user: user(),
      experiments: [experiment()],
      guides: [guide({ created_date: days(0) })],
      missions: [mission({ status: 'completed', completed_at: days(15) })],
    });
    expect(kinds(acted)).not.toContain('guide_never_acted_on');
  });

  it('flags a contact saved and never written to after 5 days', () => {
    const fresh = readPulse({ now: days(4), user: user(), outreach: [contact({ created_date: days(0) })] });
    expect(kinds(fresh)).not.toContain('outreach_never_sent');
    const stale = readPulse({ now: NOW, user: user(), outreach: [contact({ created_date: days(0) })] });
    expect(kinds(stale)).toContain('outreach_never_sent');
  });

  it('flags a sent email with no reply once the followup date has passed', () => {
    const due = readPulse({
      now: days(6), user: user(),
      outreach: [contact({ response_status: 'sent', date_contacted: '2026-07-03', followup_date: '2026-07-06' })],
    });
    expect(kinds(due)).toContain('outreach_no_followup');

    const notYet = readPulse({
      now: days(4), user: user(),
      outreach: [contact({ response_status: 'sent', date_contacted: '2026-07-03', followup_date: '2026-07-10' })],
    });
    expect(kinds(notYet)).not.toContain('outreach_no_followup');
  });

  it('leaves a contact who replied out of the followup list', () => {
    const pulse = readPulse({
      now: NOW, user: user(),
      outreach: [contact({ response_status: 'responded', date_contacted: '2026-07-02' })],
    });
    expect(kinds(pulse)).not.toContain('outreach_no_followup');
    expect(pulse.evidence.outreachResponded).toBe(1);
  });

  it('asks for a write-up when an experiment has been running over a week without one', () => {
    const pulse = readPulse({
      now: NOW, user: user(),
      paths: [path({ is_primary_focus: true })],
      experiments: [experiment({ status: 'in_progress', created_date: days(0) })],
      guides: [guide({ created_date: days(0) })],
      missions: [mission({ status: 'completed', completed_at: days(19) })],
    });
    expect(kinds(pulse)).toContain('reflection_overdue');

    const wrote = readPulse({
      now: NOW, user: user(),
      paths: [path({ is_primary_focus: true })],
      experiments: [experiment({ status: 'in_progress', created_date: days(0) })],
      guides: [guide({ created_date: days(0) })],
      missions: [mission({ status: 'completed', completed_at: days(19) })],
      reflections: [reflection({ created_date: days(19) })],
    });
    expect(kinds(wrote)).not.toContain('reflection_overdue');
  });

  it('sorts the most urgent stall first and keeps every severity inside 1 to 100', () => {
    const pulse = readPulse({
      now: LATER, user: user(),
      paths: [path(), path({ id: 'p2' })],
      experiments: [experiment({ status: 'in_progress', created_date: days(0) })],
      missions: [mission({ created_date: days(0) })],
      outreach: [contact({ created_date: days(0) })],
    });
    expect(pulse.stalls.length).toBeGreaterThan(3);
    expect(pulse.topStall).toBe(pulse.stalls[0]);
    expect(pulse.topStall.kind).toBe('no_path_selected');
    const severities = pulse.stalls.map((s) => s.severity);
    expect([...severities].sort((a, b) => b - a)).toEqual(severities);
    expect(severities.every((s) => Number.isInteger(s) && s >= 1 && s <= 100)).toBe(true);
    expect(pulse.stalls.every((s) => s.days >= 0 && Number.isInteger(s.days))).toBe(true);
  });

  it('writes every stall label in words a student would use', () => {
    const pulse = readPulse({
      now: LATER, user: user(),
      paths: [path()],
      experiments: [experiment({ status: 'in_progress', created_date: days(0) })],
      missions: [mission({ created_date: days(0) })],
      outreach: [contact({ created_date: days(0) })],
    });
    for (const s of pulse.stalls) {
      expect(s.label).toBeTruthy();
      expect(s.label).not.toMatch(/[—–]/);
      expect(s.label).not.toMatch(/deletion_status|response_status|in_progress|mission_guide/);
      expect(s.label).not.toMatch(/\b(leverage|unlock|journey|seamless|robust)\b/i);
      expect(['experiment', 'mission', 'outreach', 'path', 'account']).toContain(s.subjectType);
    }
  });
});

describe('readPulse: a student who is actually doing the work', () => {
  it('reads as working, with no stalls', () => {
    const pulse = readPulse(activeStudent());
    expect(pulse.state).toBe('working');
    expect(pulse.stalls).toEqual([]);
    expect(pulse.topStall).toBeNull();
    expect(pulse.neverReturned).toBe(false);
    expect(pulse.evidence.proof).toBe(1);
    expect(pulse.evidence.missionsCompleted).toBe(1);
    expect(pulse.gap.experimentsWithoutGuide).toBe(0);
    expect(pulse.gap.experimentsWithoutProof).toBe(0);
  });

  it('reads as decided once the student concludes the experiment', () => {
    const base = activeStudent();
    const decided = readPulse({
      ...base,
      reflections: [reflection({ created_date: days(19), is_experiment_conclusion: true })],
    });
    expect(decided.state).toBe('decided');
  });

  it('goes quiet when the same student is looked at a month later', () => {
    const pulse = readPulse(activeStudent(LATER));
    expect(pulse.state).toBe('dormant');
    expect(kinds(pulse)).toContain('dormant_account');
  });
});

describe('readPulse: now is an input, not the wall clock', () => {
  it('gives the same fixture different day counts at two different now values', () => {
    const early = readPulse({ ...activeStudent(), now: days(19) });
    const late = readPulse({ ...activeStudent(), now: days(40) });
    expect(early.daysSinceSignup).toBe(19);
    expect(late.daysSinceSignup).toBe(40);
    expect(early.daysSinceEvidence).toBe(0);
    expect(late.daysSinceEvidence).toBe(21);
    expect(early.state).toBe('working');
    expect(late.state).toBe('dormant');
  });

  it('clamps a future created_date at zero rather than reporting negative days', () => {
    const pulse = readPulse({
      now: SIGNUP,
      user: user({ created_date: days(30) }),
      proof: [proofRow({ completed_at: days(30) })],
    });
    expect(pulse.daysSinceSignup).toBe(0);
    expect(pulse.daysSinceEvidence).toBe(0);
    expect(pulse.stalls.every((s) => s.days >= 0)).toBe(true);
  });

  it('degrades to null day counts instead of throwing when now is unusable', () => {
    const pulse = readPulse({ now: 'not a date', user: user(), experiments: [experiment()] });
    expect(pulse.daysSinceSignup).toBeNull();
    expect(pulse.claimed.experiments).toBe(1);
    expect(pulse.stalls.every((s) => Number.isInteger(s.days))).toBe(true);
  });
});

describe('readPulse: rows written by a model can be any shape', () => {
  it('skips nulls, non-objects and missing timestamps without crashing', () => {
    const pulse = readPulse({
      now: NOW,
      user: user(),
      paths: [null, 'nope', path()],
      experiments: [undefined, experiment({ created_date: null }), { id: 'e9' }],
      missions: [null, mission({ completed_at: 'yesterday', status: 'completed' })],
      guides: [0, guide({ created_date: undefined })],
      proof: [proofRow({ completed_at: {}, created_date: 'soon' })],
      reflections: [[], reflection({ created_date: 12345 })],
      outreach: [contact({ name: null, response_status: 42 })],
      events: [event({ occurred_at: false, created_date: null }), null],
    });
    expect(pulse.claimed.paths).toBe(1);
    expect(pulse.claimed.experiments).toBe(2);
    expect(pulse.evidence.missionsCompleted).toBe(1);
    expect(Number.isFinite(pulse.evidence.proof)).toBe(true);
    expect(pulse.stalls.every((s) => Number.isFinite(s.severity))).toBe(true);
    expect(typeof summarizePulse(pulse)).toBe('string');
  });

  it('does not read a numeric response_status as a sent email', () => {
    const pulse = readPulse({ now: NOW, user: user(), outreach: [contact({ response_status: 42 })] });
    expect(pulse.evidence.outreachSent).toBe(0);
  });
});

describe('summarizePulse', () => {
  it('describes a dead account in plain sentences', () => {
    const line = summarizePulse(readPulse({
      now: NOW, user: user(),
      paths: [path()],
      experiments: [experiment()],
    }));
    expect(line).toContain('Signed up 20 days ago');
    expect(line).toContain('Nothing real has ever been logged');
    expect(line.split('. ').length).toBeGreaterThanOrEqual(3);
  });

  it('describes an active account by what the student actually did', () => {
    const line = summarizePulse(readPulse(activeStudent()));
    expect(line).toContain('is doing the work');
    expect(line).toContain('1 piece of proof');
    expect(line).toContain('1 mission finished');
    expect(line).toContain('1 person written to');
  });

  it('never uses a dash a person would not type, or a field name', () => {
    for (const pulse of [
      readPulse({ now: NOW, user: user() }),
      readPulse(activeStudent()),
      readPulse({ now: LATER, user: user(), paths: [path()], experiments: [experiment()], outreach: [contact()] }),
    ]) {
      const line = summarizePulse(pulse);
      expect(line).not.toMatch(/[—–]/);
      expect(line).not.toMatch(/deletion_status|response_status|created_date|is_primary_focus/);
      expect(line).not.toMatch(/undefined|NaN|null/);
    }
  });

  it('says something rather than nothing when handed junk', () => {
    expect(summarizePulse(null)).toBe('There is nothing to read yet.');
    expect(typeof summarizePulse({})).toBe('string');
  });
});

describe('readPulse: zoneless Base44 timestamps', () => {
  it('gets the same answer with and without the Z on every evidence row', () => {
    const zulu = readPulse({
      now: NOW, user: user(),
      proof: [proofRow({ completed_at: days(15) })],
      missions: [mission({ status: 'completed', completed_at: days(14) })],
    });
    const zoneless = readPulse({
      now: NOW, user: user({ created_date: naive(0) }),
      proof: [proofRow({ completed_at: naive(15) })],
      missions: [mission({ status: 'completed', completed_at: naive(14) })],
    });
    expect(zoneless.lastEvidenceAt).toBe(zulu.lastEvidenceAt);
    expect(zoneless.daysSinceEvidence).toBe(zulu.daysSinceEvidence);
    expect(zoneless.daysSinceSignup).toBe(zulu.daysSinceSignup);
  });
});
