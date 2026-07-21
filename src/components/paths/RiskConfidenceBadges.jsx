/**
 * RiskConfidenceBadges
 * Accessible, color-coded badges for path Risk and Confidence levels.
 * Green = favorable (low risk / high confidence)
 * Red   = unfavorable (high risk / low confidence)
 */
import { useState } from 'react';
import { ShieldCheck, ShieldAlert, TrendingUp, Info, X } from 'lucide-react';

// ── Normalise raw values from the database ────────────────────────────────────
// Handles: "high", "High", "very_high", "Very High", "very high", etc.
function normalise(raw) {
  if (!raw) return null;
  return raw.toLowerCase().replace(/[\s-]/g, '_');
}

// ── Risk config ───────────────────────────────────────────────────────────────
// Lower risk → greener. Higher risk → redder.
const RISK_CFG = {
  very_low:           { label: 'Very Low Risk',           bg: '#F0FDF4', text: '#14532D', border: '#86EFAC' },
  low:                { label: 'Low Risk',                 bg: '#DCFCE7', text: '#15803D', border: '#4ADE80' },
  low_to_moderate:    { label: 'Low–Moderate Risk',       bg: '#ECFCCB', text: '#3F6212', border: '#A3E635' },
  moderate:           { label: 'Moderate Risk',           bg: '#FFFBEB', text: '#92400E', border: '#FCD34D' },
  medium:             { label: 'Moderate Risk',           bg: '#FFFBEB', text: '#92400E', border: '#FCD34D' }, // alias
  moderate_to_high:   { label: 'Moderate–High Risk',     bg: '#FFF7ED', text: '#9A3412', border: '#FDBA74' },
  high:               { label: 'High Risk',               bg: '#FEF3C7', text: '#B45309', border: '#F59E0B' },
  very_high:          { label: 'Very High Risk',          bg: '#FEF2F2', text: '#B91C1C', border: '#FCA5A5' },
};

// ── Confidence config ─────────────────────────────────────────────────────────
// Higher confidence → greener. Lower confidence → redder.
const CONFIDENCE_CFG = {
  very_high: { label: 'Very High Confidence', bg: '#F0FDF4', text: '#14532D', border: '#86EFAC' },
  high:      { label: 'High Confidence',      bg: '#DCFCE7', text: '#15803D', border: '#4ADE80' },
  moderate:  { label: 'Moderate Confidence',  bg: '#FFFBEB', text: '#92400E', border: '#FCD34D' },
  medium:    { label: 'Moderate Confidence',  bg: '#FFFBEB', text: '#92400E', border: '#FCD34D' }, // alias
  low:       { label: 'Low Confidence',       bg: '#FFF7ED', text: '#9A3412', border: '#FDBA74' },
  very_low:  { label: 'Very Low Confidence',  bg: '#FEF2F2', text: '#B91C1C', border: '#FCA5A5' },
};

const RISK_TOOLTIP = 'How much uncertainty, time, financial exposure, or lifestyle tradeoff this path may involve for you.';
const CONF_TOOLTIP = 'How strongly your onboarding answers currently align with this path. Confidence may change as you complete experiments.';

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label="More information"
        className="ml-0.5 rounded-full text-current opacity-50 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-current transition"
      >
        <Info size={10} />
      </button>
      {open && (
        <>
          {/* backdrop */}
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <span
            role="tooltip"
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-56 rounded-xl border border-[#E2E8F0] bg-white p-3 text-[11px] leading-relaxed text-[#334155] shadow-xl"
          >
            {text}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-1.5 right-1.5 text-[#94A3B8] hover:text-[#334155]"
              aria-label="Close tooltip"
            >
              <X size={10} />
            </button>
          </span>
        </>
      )}
    </span>
  );
}

// ── Individual badge ──────────────────────────────────────────────────────────
function Badge({ cfg, Icon, ariaLabel, tooltipText }) {
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold border"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      <Icon size={11} aria-hidden="true" />
      {cfg.label}
      <Tooltip text={tooltipText} />
    </span>
  );
}

// ── Public exports ────────────────────────────────────────────────────────────
export function RiskBadge({ riskLevel }) {
  const key = normalise(riskLevel);
  const cfg = RISK_CFG[key];
  if (!cfg) return null;
  return (
    <Badge
      cfg={cfg}
      Icon={ShieldAlert}
      ariaLabel={`${cfg.label}: ${RISK_TOOLTIP}`}
      tooltipText={RISK_TOOLTIP}
    />
  );
}

export function ConfidenceBadge({ confidenceLevel }) {
  const key = normalise(confidenceLevel);
  const cfg = CONFIDENCE_CFG[key];
  if (!cfg) return null;
  return (
    <Badge
      cfg={cfg}
      Icon={TrendingUp}
      ariaLabel={`${cfg.label}: ${CONF_TOOLTIP}`}
      tooltipText={CONF_TOOLTIP}
    />
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
export function RiskConfidenceLegend() {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 mb-6">
      <p className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B] mb-3">How to read Risk &amp; Confidence</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Risk */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldAlert size={12} className="text-[#64748B]" />
            <p className="text-[11px] font-bold text-[#334155]">Risk</p>
            <span className="ml-auto text-[10px] text-[#94A3B8]">Lower = better</span>
          </div>
          <div className="flex flex-col gap-1">
            {[
              RISK_CFG.very_low,
              RISK_CFG.low,
              RISK_CFG.moderate,
              RISK_CFG.high,
              RISK_CFG.very_high,
            ].map(cfg => (
              <span key={cfg.label} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold border w-fit"
                style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}>
                <ShieldAlert size={9} aria-hidden="true" /> {cfg.label}
              </span>
            ))}
          </div>
        </div>

        {/* Confidence */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={12} className="text-[#64748B]" />
            <p className="text-[11px] font-bold text-[#334155]">Fit Confidence</p>
            <span className="ml-auto text-[10px] text-[#94A3B8]">Higher = better</span>
          </div>
          <div className="flex flex-col gap-1">
            {[
              CONFIDENCE_CFG.very_high,
              CONFIDENCE_CFG.high,
              CONFIDENCE_CFG.moderate,
              CONFIDENCE_CFG.low,
              CONFIDENCE_CFG.very_low,
            ].map(cfg => (
              <span key={cfg.label} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold border w-fit"
                style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}>
                <TrendingUp size={9} aria-hidden="true" /> {cfg.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}