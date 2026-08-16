/**
 * Human Reality conversations laid ALONGSIDE the workstyle rows, exactly as
 * scenario answers are. The behavioural level, label and confidence on each row
 * are untouched: a conversation tells the student what the field is like, never
 * how they themselves work.
 */
import { humanEvidenceByDimension } from '@/lib/human-reality';

export function withHumanReality(rows = [], conversations = []) {
  const byDimension = humanEvidenceByDimension(conversations);
  if (!byDimension.size) return rows;

  return rows.map(r => {
    const h = byDimension.get(r.dimension);
    if (!h) return r;
    return { ...r, human: h, humanLabel: h.label, humanStatement: h.statement, humanCount: h.count };
  });
}

export default withHumanReality;