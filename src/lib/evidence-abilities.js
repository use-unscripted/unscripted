/**
 * Demonstrated abilities, derived only from things the student actually did.
 *
 * An ability with no evidence is never listed. Each one carries its own sources,
 * which are graph nodes, so the profile can show exactly which experiment, proof
 * or performance review put it there.
 */
import { evidenceSource, summarizeEvidence, countSourceKinds } from '@/lib/evidence-graph';
import { depthOf, evidenceStrength } from '@/lib/experiment-depth';

export const ABILITIES = [
  { id: 'analytical_reasoning', label: 'Analytical Reasoning', keys: ['analytic', 'analysis', 'reasoning', 'evaluat', 'assess', 'diagnos'] },
  { id: 'quantitative_analysis', label: 'Quantitative Analysis', keys: ['quantitative', 'financial model', 'model', 'valuation', 'numbers', 'statistic', 'metrics', 'spreadsheet', 'forecast'] },
  { id: 'writing', label: 'Writing', keys: ['writ', 'memo', 'copy', 'editorial', 'documentation'] },
  { id: 'communication', label: 'Communication', keys: ['communicat', 'presenting', 'presentation', 'explain', 'interview', 'pitch'] },
  { id: 'prioritization', label: 'Prioritization', keys: ['prioriti', 'time management', 'planning', 'triage', 'scoping'] },
  { id: 'research', label: 'Research', keys: ['research', 'investigat', 'market study', 'due diligence', 'sourcing'] },
  { id: 'creativity', label: 'Creativity', keys: ['creativ', 'design', 'ideation', 'original', 'brand', 'content'] },
  { id: 'problem_solving', label: 'Problem Solving', keys: ['problem solving', 'problem-solving', 'troubleshoot', 'debug', 'root cause'] },
  { id: 'leadership', label: 'Leadership', keys: ['leader', 'managing', 'management', 'ownership', 'coordinat', 'delegat'] },
  { id: 'decision_making', label: 'Decision Making', keys: ['decision', 'judgement', 'judgment', 'tradeoff', 'trade-off', 'prioritis'] },
  { id: 'persuasion', label: 'Persuasion', keys: ['persuas', 'sales', 'negotiat', 'convince', 'fundrais', 'outreach'] },
  { id: 'attention_to_detail', label: 'Attention to Detail', keys: ['detail', 'accuracy', 'precision', 'proofread', 'quality control', 'compliance'] },
  { id: 'strategic_thinking', label: 'Strategic Thinking', keys: ['strateg', 'positioning', 'long-term', 'competitive', 'business case'] },
  { id: 'synthesis', label: 'Synthesis', keys: ['synthes', 'summar', 'insight', 'distill', 'conclusion'] },
  { id: 'collaboration', label: 'Collaboration', keys: ['collaborat', 'teamwork', 'team', 'cross-functional', 'stakeholder'] },
];

const splitTags = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') return value.split(/[,;\n·•]+/).map(s => s.trim()).filter(Boolean);
  return [];
};

const matchAbilities = (tag) => {
  const t = String(tag).toLowerCase();
  return ABILITIES.filter(a => a.keys.some(k => t.includes(k)) || t.includes(a.label.toLowerCase()));
};

/**
 * Build the ability list.
 *
 * Onboarding skills are included because discarding them would lose real
 * information, but they sit in the weakest tier and cannot on their own push an
 * ability past "preliminary".
 */
export function deriveAbilities({ experiments = [], measurements = {}, proof = [], profile = {} }) {
  const found = new Map();

  const add = (tag, source) => {
    matchAbilities(tag).forEach(a => {
      if (!found.has(a.id)) found.set(a.id, { ...a, sources: [] });
      found.get(a.id).sources.push(source);
    });
  };

  proof.filter(p => p.deletion_status !== 'deleted' && p.deletion_status !== 'permanently_deleted').forEach(p => {
    [...splitTags(p.skills_demonstrated), ...splitTags(p.approved_skills)].forEach(tag => add(tag, evidenceSource({
      depth_kind: 'proof',
      kind: 'proof',
      detail: p.title,
      date: p.completed_at || p.created_date,
      link: '/evidence?tab=proof',
      nodeId: `proof:${p.id}`,
    })));
  });

  experiments.filter(e => e.status === 'completed').forEach(e => {
    // Quick Test or Deep Dive is recorded alongside the source, so a conclusion
    // can say what it is actually built from.
    splitTags(e.work_characteristics_tested).forEach(tag => add(tag, evidenceSource({
      depth_kind: depthOf(e),
      kind: 'experiment',
      detail: e.title,
      date: e.updated_date || e.created_date,
      link: `/experiments?experimentId=${e.id}`,
      nodeId: `experiment:${e.id}`,
    })));

    const m = measurements[e.id];
    splitTags(m?.demonstrated_strengths).forEach(tag => add(tag, evidenceSource({
      depth_kind: 'system_evaluation',
      kind: 'system_evaluation',
      detail: `Reviewed performance on ${e.title}`,
      date: m.system_evaluated_at || m.post_completed_at,
      link: `/experiments?experimentId=${e.id}`,
      nodeId: `performance:${m.id}`,
    })));
  });

  splitTags(profile.current_skills).forEach(tag => add(tag, evidenceSource({
      depth_kind: 'onboarding',
      kind: 'onboarding',
    detail: `You described this as a current skill: ${tag}`,
    date: profile.created_date,
    link: '/profile',
    nodeId: 'user',
  })));

  return [...found.values()]
    .map(a => ({
      ...a,
      summary: summarizeEvidence(a.sources),
      // What this ability rests on, kept separate by level so several Quick
      // Tests are never presented as if they were one Deep Dive.
      sourceCounts: countSourceKinds(a.sources),
      strength: evidenceStrength(a.sources.map(s => ({ kind: s.depth_kind || s.kind, date: s.date }))),
    }))
    .sort((a, b) => b.summary.score - a.summary.score);
}

/** Attach ability conclusions to the graph, with an edge to every source. */
export function linkAbilities(graph, abilities) {
  abilities.forEach(a => {
    const id = graph.node(`ability:${a.id}`, 'demonstrated_skill', a.label, { summary: a.summary });
    a.sources.forEach(s => graph.link(s.nodeId, id, 'demonstrates'));
    graph.link('user', id, 'has_ability');
  });
  return graph;
}