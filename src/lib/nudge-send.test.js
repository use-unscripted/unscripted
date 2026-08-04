import { describe, it, expect, vi } from 'vitest';
import {
  ALLOWED_RECIPIENTS, isAllowedRecipient, assertAllowedRecipient, sendNudgeEmail,
} from '../../base44/shared/nudge-send.js';

const OK = 'drew.lynch1@student.fairfield.edu';

// Real addresses off live rows, plus the shapes an attacker or a typo produces.
const STUDENTS = [
  'student@fairfield.edu',
  'sam.rivera@student.fairfield.edu',
  'drew.lynch1@student.fairfield.edu.evil.com',
  'evil.com/drew.lynch1@student.fairfield.edu',
  'drew.lynch1@student.fairfield.edu@evil.com',
  'xdrew.lynch1@student.fairfield.edu',
  'drew.lynch1@student.fairfield.ed',
  'drew.lynch@student.fairfield.edu',
  '',
  '   ',
  null,
  undefined,
  0,
  [],
  {},
  ['drew.lynch1@student.fairfield.edu'],
  { toString: () => OK },
];

describe('who is allowed to receive one of these', () => {
  it('allows exactly one address and nobody else', () => {
    expect(ALLOWED_RECIPIENTS).toEqual([OK]);
    expect(isAllowedRecipient(OK)).toBe(true);
    for (const bad of STUDENTS) {
      expect(isAllowedRecipient(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('forgives case and whitespace on the allowed address, and nothing else', () => {
    expect(isAllowedRecipient('  ' + OK + '  ')).toBe(true);
    expect(isAllowedRecipient(OK.toUpperCase())).toBe(true);
    expect(isAllowedRecipient('Drew.Lynch1@Student.Fairfield.EDU')).toBe(true);
    // Inner whitespace is a different address, not a formatting variation.
    expect(isAllowedRecipient(OK.replace('@', ' @'))).toBe(false);
  });

  it('throws rather than returning false, so a caller cannot ignore it', () => {
    expect(() => assertAllowedRecipient(OK)).not.toThrow();
    for (const bad of STUDENTS) {
      expect(() => assertAllowedRecipient(bad), JSON.stringify(bad)).toThrow(/not on the allowed list/);
    }
  });

  it('does not name the allowed address in the error it throws', () => {
    // A stack trace in a log should not hand somebody the answer.
    let message = '';
    try { assertAllowedRecipient('someone@example.com'); } catch (e) { message = String(e.message); }
    expect(message).not.toContain(OK);
    expect(message).not.toContain('fairfield');
  });
});

describe('sending one', () => {
  const render = () => ({ subject: 'A subject', text: 'A body', html: '<p>A body</p>' });
  const clientWith = (sent) => ({ integrations: { Core: { SendEmail: vi.fn(async (p) => { sent.push(p); return { success: true }; }) } } });

  it('sends to the allowed address', async () => {
    const sent = [];
    await sendNudgeEmail({ client: clientWith(sent), render, to: OK, ask: {}, user: {}, appOrigin: 'https://x', now: new Date(0) });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(OK);
    expect(sent[0].subject).toBe('A subject');
    expect(sent[0].body).toBe('<p>A body</p>');
  });

  it('sends the html body, because the integration turned out to render it', async () => {
    // Verified against a real inbox on 2026-08-04. The types say body is plain
    // text and offer no html field, which is why this went unsent for a while.
    const sent = [];
    await sendNudgeEmail({ client: clientWith(sent), render, to: OK, ask: {}, user: {}, appOrigin: 'https://x', now: new Date(0) });
    expect(sent[0].body).toBe('<p>A body</p>');
  });

  it('still sends the plain version when a caller asks for it', async () => {
    const sent = [];
    await sendNudgeEmail({ client: clientWith(sent), render, to: OK, ask: {}, user: {}, appOrigin: 'https://x', now: new Date(0), format: 'text' });
    expect(sent[0].body).toBe('A body');
  });

  it('refuses every other address, and does not render or send anything first', async () => {
    for (const bad of STUDENTS) {
      const sent = [];
      const client = clientWith(sent);
      const spy = vi.fn(render);
      await expect(
        sendNudgeEmail({ client, render: spy, to: bad, ask: {}, user: {}, appOrigin: 'https://x', now: new Date(0) }),
      ).rejects.toThrow(/not on the allowed list/);
      expect(sent, JSON.stringify(bad)).toHaveLength(0);
      expect(client.integrations.Core.SendEmail).not.toHaveBeenCalled();
      // The refusal comes before any work, so a bad address cannot even build a message.
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe('the backend job carries the same lock', () => {
  it('calls the shared check on its send path, not just its own gate', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      new URL('../../base44/functions/weeklyNudgePass/entry.ts', import.meta.url), 'utf8',
    );
    expect(src).toContain("from '../../shared/nudge-send.js'");
    // The check has to sit above the send, or it is decoration.
    const check = src.indexOf('assertAllowedRecipient(email)');
    const send = src.indexOf('integrations.Core.SendEmail');
    expect(check).toBeGreaterThan(-1);
    expect(send).toBeGreaterThan(-1);
    expect(check).toBeLessThan(send);
  });
});
