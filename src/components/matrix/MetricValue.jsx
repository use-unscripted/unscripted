/**
 * A metric reading. When there is not enough evidence behind it, the evidence
 * stage is shown instead of a number: never a percentage the records cannot
 * support.
 */
export default function MetricValue({ value, maturity, suffix = '%', align = 'left' }) {
  if (value === null || value === undefined) {
    return (
      <span className="tp-meta block" style={{ color: 'var(--text-muted)', textAlign: align }}>
        {maturity?.label || 'Not enough evidence yet'}
      </span>
    );
  }
  return (
    <span className="tp-card block tabular-nums" style={{ color: 'var(--text-primary)', textAlign: align }}>
      {value}{suffix}
    </span>
  );
}