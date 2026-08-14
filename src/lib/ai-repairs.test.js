// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { toText, toTextList, STEP_TEXT_KEYS } from './ai-validation';

// These components pull in the whole app shell, so the parts under test are the
// pure repair functions and everything they import is stubbed out.
//
// The functions themselves are pure, but the import chain is not: the setup
// page now reaches a select control, and that reaches `lib/utils`, which reads
// `window.self` at module scope. Under the default node environment the file
// throws on load and the whole suite is reported as an unhandled error rather
// than a failure. jsdom is what the component suites already run under.
vi.mock('@/api/base44Client', () => ({ base44: {} }));
vi.mock('@/lib/llm', () => ({ unwrapLLM: (x) => x, PLAIN_PROSE_RULES: '' }));
vi.mock('@/lib/ai-generate', () => ({ generateValidated: () => Promise.resolve({ ok: true, data: null }) }));
vi.mock('@/lib/ai-failures', () => ({ reportAiFailure: () => Promise.resolve(null) }));
vi.mock('@/lib/career-cycle', () => ({
  ensureActiveCycle: () => Promise.resolve(null), assertNoActiveExperiment: () => Promise.resolve(),
  attachExperimentToCycle: () => Promise.resolve(), ActiveExperimentError: class extends Error {}, cycleLinks: () => ({}),
}));

const { repairMissionGuide, validateMissionGuide } = await import('@/pages/ExperimentSetup');
const { repairBlueprint } = await import('@/pages/BlueprintLibrary');
const { repairOutreachPlan, validateOutreachPlan } = await import('@/components/outreach/OutreachPlanModal');

describe('repairMissionGuide — what counts as a usable guide', () => {
  it('is usable with at least one step', () => {
    expect(repairMissionGuide({ mission_steps: ['Email three alumni'] }).usable).toBe(true);
  });

  it('is not usable with no steps, however full the rest is', () => {
    const r = repairMissionGuide({
      mission_objective: 'Find out what the job is like',
      proof_required: 'Your notes',
      completion_criteria: 'Both calls happened',
      mission_steps: [],
    });
    expect(r.usable).toBe(false);
    expect(r.guide.mission_objective).toBe('Find out what the job is like');
  });

  it('converts steps returned as objects into strings', () => {
    const r = repairMissionGuide({ mission_steps: [{ step: 'Find five analysts' }, { title: 'Send the email' }] });
    expect(r.guide.mission_steps).toEqual(['Find five analysts', 'Send the email']);
    expect(r.usable).toBe(true);
  });

  // The one input where trusting the model would produce a guide that looks
  // complete and holds a single wall of text.
  it('splits a newline-joined blob into separate steps', () => {
    const r = repairMissionGuide({ mission_steps: ['1. Find five analysts\n2. Send the email\n3. Book the call'] });
    expect(r.guide.mission_steps).toEqual(['Find five analysts', 'Send the email', 'Book the call']);
  });

  it('strips bullet markers when it splits', () => {
    const r = repairMissionGuide({ mission_steps: ['- One\n* Two\n• Three'] });
    expect(r.guide.mission_steps).toEqual(['One', 'Two', 'Three']);
  });

  it('survives a missing or wrongly-typed response', () => {
    for (const bad of [null, undefined, 'text', 42, []]) {
      expect(() => repairMissionGuide(bad)).not.toThrow();
      expect(repairMissionGuide(bad).usable).toBe(false);
    }
  });

  it('rejects with a reason the model can act on', () => {
    const v = validateMissionGuide({ mission_steps: [] });
    expect(v.ok).toBe(false);
    expect(v.codes).toEqual(['guide_no_steps']);
    expect(v.errors[0]).toMatch(/mission_steps/);
  });
});

describe('repairBlueprint', () => {
  it('forces every list the view maps over into an array of strings', () => {
    const r = repairBlueprint({
      skills_required: 'SQL',
      weekly_actions: [{ step: 'Post once' }, null, 42],
      monetization_paths: null,
      thirty_day_plan: 'not a plan',
    });
    expect(r.skills_required).toEqual(['SQL']);
    expect(r.weekly_actions).toEqual(['Post once', '42']);
    expect(r.monetization_paths).toEqual([]);
    expect(r.thirty_day_plan).toEqual([]);
  });

  it('coerces the nested actions inside the 30-day plan', () => {
    const r = repairBlueprint({
      thirty_day_plan: [{ week: 'Week 1', focus: 'Ship', actions: [{ step: 'Write one post' }] }, 'junk'],
    });
    expect(r.thirty_day_plan).toEqual([{ week: 'Week 1', focus: 'Ship', actions: ['Write one post'] }]);
  });

  it('returns null only for a non-object', () => {
    expect(repairBlueprint('nope')).toBeNull();
    expect(repairBlueprint({})).not.toBeNull();
  });
});

describe('repairOutreachPlan — the drop rules', () => {
  const full = () => ({
    outreach_experiments: [{ title: 'Interview three analysts', objective: 'Learn the job' }],
    contact_archetypes: [{ title: 'Analyst', why_useful: 'Does the work', where_to_find: ['LinkedIn'] }],
    contact_suggestions: [{ name: 'A Person', role: 'Analyst' }],
    message_templates: [{ label: 'Cold note', body: 'Hello [Name]' }],
  });

  it('keeps a complete plan intact', () => {
    const p = repairOutreachPlan(full());
    expect(validateOutreachPlan(full()).ok).toBe(true);
    expect(p.message_templates[0].body).toBe('Hello [Name]');
  });

  it('drops an item with nothing to act on and keeps the rest', () => {
    const raw = full();
    raw.message_templates = [{ label: 'Empty' }, { label: 'Real', body: 'Hello' }];
    expect(repairOutreachPlan(raw).message_templates).toEqual([{ label: 'Real', body: 'Hello' }]);
  });

  it('keeps an archetype suggestion, which has no name by design', () => {
    const raw = full();
    raw.contact_suggestions = [{ is_archetype: true, archetype_title: 'A hiring manager' }];
    expect(repairOutreachPlan(raw).contact_suggestions).toHaveLength(1);
  });

  it('names each empty section so one retry can fill them all', () => {
    const raw = full();
    raw.message_templates = [];
    raw.contact_archetypes = [];
    const v = validateOutreachPlan(raw);
    expect(v.ok).toBe(false);
    expect(v.codes.sort()).toEqual(['contact_archetypes_empty', 'message_templates_empty']);
    expect(v.errors.join(' ')).toMatch(/message_templates/);
  });

  it('never throws on a hostile plan', () => {
    for (const bad of [null, 'text', 42, [], { outreach_experiments: 'nope' }]) {
      expect(() => validateOutreachPlan(bad)).not.toThrow();
    }
  });
});

describe('reading a saved mission step', () => {
  // The regression this locks: the generic key order puts title first, which
  // would shorten every step on 265 existing experiments to its label.
  it('prefers the description over the short title', () => {
    const step = {
      title: 'Draft outreach email',
      description: 'Write a four-sentence note to three alumni, naming the specific work you saw',
    };
    expect(toText(step, STEP_TEXT_KEYS)).toMatch(/four-sentence/);
  });

  it('still prefers an explicit step field over both', () => {
    expect(toText({ step: 'The step', title: 'T', description: 'D' }, STEP_TEXT_KEYS)).toBe('The step');
  });

  it('falls back to the title when there is no description', () => {
    expect(toText({ title: 'Draft outreach email' }, STEP_TEXT_KEYS)).toBe('Draft outreach email');
  });

  it('leaves the default order alone for everything else', () => {
    expect(toText({ title: 'T', description: 'D' })).toBe('T');
  });

  // A narrower list would blank a step saved under an older shape instead of
  // just shortening it, which is worse than the bug it was fixing.
  it('reads every key the default order reads', () => {
    const { toText: t } = { toText };
    for (const key of ['step', 'description', 'title', 'text', 'name', 'label', 'content', 'value', 'question']) {
      expect(t({ [key]: 'the text' }, STEP_TEXT_KEYS)).toBe('the text');
    }
  });

  it('only splits lines when asked', () => {
    expect(toTextList(['a\nb'])).toEqual(['a\nb']);
    expect(toTextList(['a\nb'], { splitLines: true })).toEqual(['a', 'b']);
  });
});
