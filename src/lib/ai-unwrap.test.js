import { describe, it, expect, vi } from 'vitest';
import { unwrapLLM } from './llm';

// The retry loop reaches the Base44 client through the failure log; nothing in
// this file is about either.
vi.mock('@/lib/ai-failures', () => ({ reportAiFailure: () => Promise.resolve(null) }));

const { generateValidated } = await import('./ai-generate');

/**
 * The bug this file exists for: converting a call site to the retry loop moved
 * the `await` outside `unwrapLLM(...)`, so it received a Promise. A Promise is
 * truthy and typeof 'object', and `promise.response` is undefined, so it fell
 * straight through and returned the Promise unchanged. The unwrap silently
 * stopped happening at four call sites while still reading as present in the
 * source, and every other test mocked at a level above it.
 *
 * Only one pinned model in this app wraps its replies, so nothing broke that
 * day. The next person to change a pinned model is who it would have cost.
 */

const WRAPPED = { response: { mission_steps: ['Email three alumni'] } };

describe('unwrapLLM must not be handed a promise', () => {
  it('does nothing useful when given one, which is why the call order matters', async () => {
    const passedThrough = unwrapLLM(Promise.resolve(WRAPPED));
    expect(await passedThrough).toEqual(WRAPPED);
    expect((await passedThrough).mission_steps).toBeUndefined();
  });

  it('unwraps when the value is awaited first', async () => {
    const unwrapped = unwrapLLM(await Promise.resolve(WRAPPED));
    expect(unwrapped.mission_steps).toEqual(['Email three alumni']);
  });
});

describe('a call closure shaped like the real ones', () => {
  // This is the shape every converted site uses. If the `await` is dropped, the
  // validator sees the wrapper and rejects, and this test fails.
  const call = async () => unwrapLLM(await Promise.resolve(WRAPPED));

  it('delivers the unwrapped payload to the validator', async () => {
    let seen = null;
    const r = await generateValidated({
      feature: 'mission_guide_prefilled',
      model: 'claude_sonnet_4_6',
      call,
      validate: (raw) => {
        seen = raw;
        return Array.isArray(raw?.mission_steps)
          ? { ok: true, data: raw, errors: [], codes: [] }
          : { ok: false, data: null, errors: ['no steps'], codes: ['guide_no_steps'] };
      },
    });

    expect(seen.mission_steps).toEqual(['Email three alumni']);
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(1);
  });

  it('fails the way the outage did when the await is missing', async () => {
    const broken = () => unwrapLLM(Promise.resolve(WRAPPED));
    const r = await generateValidated({
      feature: 'mission_guide_prefilled',
      model: 'claude_sonnet_4_6',
      call: broken,
      validate: (raw) => (Array.isArray(raw?.mission_steps)
        ? { ok: true, data: raw, errors: [], codes: [] }
        : { ok: false, data: null, errors: ['no steps'], codes: ['guide_no_steps'] }),
    });

    // Both attempts rejected, identically. The student would be told the guide
    // came back empty every single time.
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(2);
  });
});

describe('every converted call site awaits before unwrapping', async () => {
  const fs = await import('node:fs');
  const files = [
    'src/pages/ExperimentSetup.jsx',
    'src/pages/BlueprintLibrary.jsx',
    'src/components/outreach/OutreachPlanModal.jsx',
    'src/lib/risk-assessor.js',
  ];

  it.each(files)('%s', (file) => {
    const src = fs.readFileSync(file, 'utf8');
    // The failing form: unwrapLLM applied directly to the client call.
    expect(src).not.toMatch(/unwrapLLM\(\s*base44\.integrations/);
    expect(src).toMatch(/unwrapLLM\(await base44\.integrations/);
  });
});
