import { ArrowUpRight, ArrowRight, ArrowDownRight, Minus } from 'lucide-react';

/**
 * Direction of travel across stored hypothesis versions. Arrow, word and shape
 * all carry the meaning, so colour is never the only signal.
 */
const MAP = {
  up: { Icon: ArrowUpRight, color: 'var(--success-700)', bg: 'var(--success-50)' },
  down: { Icon: ArrowDownRight, color: 'var(--warning-700)', bg: 'var(--warning-50)' },
  flat: { Icon: ArrowRight, color: 'var(--ink-600)', bg: 'var(--ink-100)' },
};

export default function TrendBadge({ trend }) {
  if (!trend?.dir) {
    return (
      <span className="tp-meta inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        <Minus size={13} aria-hidden="true" /> Not enough history
      </span>
    );
  }
  const { Icon, color, bg } = MAP[trend.dir];
  return (
    <span className="tp-meta inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold"
      style={{ color, background: bg }}>
      <Icon size={13} aria-hidden="true" />
      {trend.label}
      {trend.from !== null && <span className="tabular-nums font-normal">{trend.from}→{trend.to}</span>}
    </span>
  );
}