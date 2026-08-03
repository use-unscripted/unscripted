/**
 * Real-time password requirement checklist + strength indicator.
 * Purely presentational — no state, no storage.
 */
import React from "react";
import { Check, X } from "lucide-react";
import { REQUIREMENTS, getPasswordStrength } from "@/lib/password-validation";

function StrengthBar({ password, email }) {
  const { score, label, color } = getPasswordStrength(password, email);
  if (!password) return null;

  const segments = 4;
  return (
    <div className="mt-3" aria-live="polite" aria-atomic="true">
      <div className="flex gap-1 mb-1" role="img" aria-label={`Password strength: ${label}`}>
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors duration-300"
            style={{ background: i < score ? color : "var(--ink-200)" }}
          />
        ))}
      </div>
      <p className="text-xs font-medium" style={{ color }}>{label}</p>
    </div>
  );
}

export default function PasswordChecklist({ password, email = "", confirmPassword, showConfirmError }) {
  const results = {};
  REQUIREMENTS.forEach(({ key }) => {
    switch (key) {
      case "minimumLength":      results[key] = password.length >= 12; break;
      case "uppercase":          results[key] = /[A-Z]/.test(password); break;
      case "lowercase":          results[key] = /[a-z]/.test(password); break;
      case "number":             results[key] = /[0-9]/.test(password); break;
      case "specialCharacter":   results[key] = /[^A-Za-z0-9\s]/.test(password); break;
      default:                   results[key] = false;
    }
  });

  return (
    <div className="mt-2 space-y-1.5" aria-label="Password requirements">
      <p className="text-xs font-semibold text-[color:var(--ink-700)] mb-1">Your password must include:</p>
      {REQUIREMENTS.map(({ key, text }) => {
        const met = results[key];
        return (
          <div key={key} className="flex items-center gap-2" role="status" aria-label={`${text}: ${met ? "complete" : "incomplete"}`}>
            <span
              className="flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0"
              style={{ background: met ? "#22c55e" : "var(--ink-200)" }}
              aria-hidden="true"
            >
              {met
                ? <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                : <X className="w-2.5 h-2.5 text-[color:var(--ink-400)]" strokeWidth={3} />
              }
            </span>
            <span className={`text-xs ${met ? "text-[color:var(--success-700)] line-through decoration-[#22c55e]" : "text-[color:var(--ink-500)]"}`}>
              {text}
            </span>
          </div>
        );
      })}

      <StrengthBar password={password} email={email} />

      {showConfirmError && (
        <p className="text-xs text-destructive font-medium mt-1" role="alert">
          Passwords do not match.
        </p>
      )}
    </div>
  );
}