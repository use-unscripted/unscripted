/**
 * The four things a student can choose to generate out of their decision record.
 *
 * Every line is copied from a stored record. Nothing is generated, inferred or
 * embellished, and private reflection writing is EXCLUDED unless the student
 * explicitly opts in — a brief a student hands to an advisor must never leak
 * what they wrote for themselves.
 */
const bullet = (lines = []) => lines.filter(Boolean).map(l => `- ${l}`).join('\n');
const heading = (t) => `\n## ${t}\n`;
const date = (v) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

export const EXPORTS = [
  { key: 'advisor', label: 'Advisor conversation brief', sub: 'One page an advisor can read before meeting you.' },
  { key: 'summary', label: 'Career evidence summary', sub: 'What you have tested and what the evidence says.' },
  { key: 'resume', label: 'Resume-ready evidence', sub: 'Only the work you approved for your resume.' },
  { key: 'portfolio', label: 'Portfolio export', sub: 'The full chronological record, hypothesis by hypothesis.' },
];

const openLine = (h) => (h.current.openUnknowns || []).slice(0, 3).map(q => `${h.pathName}: ${q}`);

function crossLines(cross) {
  return [
    ...cross.confirmed.map(d => `${d.levelLabel} for ${d.label} (${d.count} observation${d.count === 1 ? '' : 's'}).`),
    ...cross.conflicting.map(d => `Conflicting evidence for ${d.label}.`),
    ...cross.suspected.map(d => `${d.levelLabel} for ${d.label}, from one experience so far.`),
    ...cross.open.map(d => `Limited evidence about ${d.label}.`),
  ];
}

/** An advisor brief: position, what was tested, evidence, open questions. */
export function advisorBrief(record, { includeReflections = false } = {}) {
  const { hypotheses, cross, counts, origin } = record;
  return [
    '# Advisor conversation brief',
    `Generated ${date(new Date())} from my own records. Private by default; I chose to share this.`,
    heading('Where I started'),
    bullet([
      origin?.clarity != null && `Career clarity when I started: ${origin.clarity}/10.`,
      origin?.considered?.length && `Careers I was considering: ${origin.considered.join(', ')}.`,
      origin?.uncertainties?.length && `What I was most unsure about: ${origin.uncertainties.join('; ')}.`,
    ]) || '- Not recorded.',
    heading('What I have tested'),
    hypotheses.map(h => bullet([
      `${h.pathName}: ${h.current.decisionLabel || h.status.replace(/_/g, ' ')}${h.current.confidence ? `, ${h.current.confidence} confidence` : ''}.`,
      h.experimentCount && `${h.experimentCount} experiment${h.experimentCount === 1 ? '' : 's'} run.`,
      ...(includeReflections ? [] : []),
    ])).join('\n'),
    heading('What the evidence says about how I work'),
    bullet(crossLines(cross)) || '- Not enough evidence yet.',
    heading('What I still cannot answer'),
    bullet(hypotheses.flatMap(openLine)) || '- Nothing recorded as open.',
    heading('Activity behind this'),
    bullet([
      `${counts.experiments} experiment${counts.experiments === 1 ? '' : 's'}`,
      `${counts.evidence} piece${counts.evidence === 1 ? '' : 's'} of evidence`,
    ]),
  ].join('\n');
}

/** The evidence summary: hypotheses, movement, and cross-career patterns. */
export function evidenceSummary(record, { includeReflections = false } = {}) {
  const { hypotheses, cross } = record;
  return [
    '# Career evidence summary',
    `Generated ${date(new Date())}.`,
    ...hypotheses.map(h => [
      heading(h.pathName),
      bullet([
        h.nodes[0]?.statement && `Why it seemed worth testing: ${h.nodes[0].statement}`,
        h.nodes[0]?.confidence != null && `Confidence at the start: ${h.nodes[0].confidence}%`,
        `Position now: ${h.current.decisionLabel || h.status.replace(/_/g, ' ')}${h.current.confidence ? ` (${h.current.confidence})` : ''}`,
      ]),
      ...h.nodes.filter(n => n.kind === 'update').map(u => bullet([
        `${date(u.at)}: ${u.direction}${u.experimentTitle ? ` after ${u.experimentTitle}` : ''}.`,
        u.strengthened[0] && `Strengthened by: ${u.strengthened[0]}`,
        u.weakened[0] && `Weakened by: ${u.weakened[0]}`,
        u.resolved[0] && `Question answered: ${u.resolved[0]}`,
        u.newUnknowns[0] && `New question: ${u.newUnknowns[0]}`,
        includeReflections && u.correction && `My note: “${u.correction}”`,
      ])),
    ].join('\n')),
    heading('Across every hypothesis'),
    bullet(crossLines(cross)) || '- Not enough evidence yet.',
  ].join('\n');
}

/** Only proof the student explicitly approved for a resume. */
export function resumeEvidence(record, { proof = [] } = {}) {
  const approved = proof.filter(p => p.resume_status === 'approved');
  return [
    '# Resume-ready evidence',
    approved.length
      ? approved.map(p => [
        `## ${p.approved_title || p.title}`,
        bullet([
          p.approved_bullet || p.description,
          p.approved_deliverable && `Deliverable: ${p.approved_deliverable}`,
          p.approved_skills?.length && `Skills: ${p.approved_skills.join(', ')}`,
          p.approved_tools?.length && `Tools: ${p.approved_tools.join(', ')}`,
          p.approved_link && `Link: ${p.approved_link}`,
        ]),
      ].join('\n')).join('\n\n')
      : 'Nothing approved for your resume yet. Approve a piece of evidence in your library first.',
  ].join('\n');
}

/** The full chain. Still excludes private reflection writing unless opted in. */
export function portfolioExport(record, { includeReflections = false } = {}) {
  const sections = record.hypotheses.map(h => [
    heading(h.pathName),
    ...h.nodes.map(n => {
      if (n.kind === 'initial') {
        return [`### Initial hypothesis (${date(n.at)})`,
          bullet([
            n.reconstructed && 'Read from my hypothesis record rather than recorded at the time.',
            n.statement && `Why it seemed worth testing: ${n.statement}`,
            n.confidence != null && `Initial confidence: ${n.confidence}%`,
            n.unknowns?.length && `Initial unknowns: ${n.unknowns.join('; ')}`,
          ])].join('\n');
      }
      if (n.kind === 'experiment') {
        return [`### Experiment: ${n.title} (${date(n.at)})`,
          bullet([
            n.tested && `Tested: ${n.tested}`,
            n.expectation[0] && `Expectation: ${n.expectation.join('; ')}`,
            n.activity.missions.length && `Activity: ${n.activity.missions.join('; ')}`,
            n.evidence.length && `Evidence: ${n.evidence.map(e => e.title).join('; ')}`,
            n.reality[0] && `Reality: ${n.reality.join('; ')}`,
          ])].join('\n');
      }
      return [`### Hypothesis update ${n.sequence || ''} (${date(n.at)})`,
        bullet([
          `${n.direction}${n.confidenceBefore ? `: ${n.confidenceBefore} → ${n.confidenceAfter}` : ''}`,
          n.resolved[0] && `Unknown resolved: ${n.resolved.join('; ')}`,
          n.newUnknowns[0] && `New unknown: ${n.newUnknowns.join('; ')}`,
          n.decisionLabel && `Decision: ${n.decisionLabel}`,
          includeReflections && n.correction && `My note: “${n.correction}”`,
        ])].join('\n');
    }),
    `### Current position\n${bullet([
      h.current.decisionLabel || h.status.replace(/_/g, ' '),
      h.current.confidence && `Confidence: ${h.current.confidence}`,
      h.current.openUnknowns?.length && `Still open: ${h.current.openUnknowns.join('; ')}`,
    ])}`,
  ].join('\n'));

  return ['# Career decision record', `Generated ${date(new Date())}.`, ...sections,
    heading('What the evidence says about how I work'), bullet(crossLines(record.cross))].join('\n');
}

export function buildExport(key, record, opts = {}) {
  if (key === 'advisor') return advisorBrief(record, opts);
  if (key === 'summary') return evidenceSummary(record, opts);
  if (key === 'resume') return resumeEvidence(record, opts);
  if (key === 'portfolio') return portfolioExport(record, opts);
  return '';
}