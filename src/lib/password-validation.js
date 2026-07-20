/**
 * Centralized password validation — used by Register, ResetPassword, and any future Change Password form.
 * Passwords are never stored, logged, or passed outside of authentication calls.
 */

export const validatePassword = (password, email = "") => {
  const trimmedPassword = password.trim();
  const emailClean = email.toLowerCase().trim();

  return {
    minimumLength: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    specialCharacter: /[^A-Za-z0-9\s]/.test(password),
    noOuterSpaces: password === trimmedPassword,
    notEmail: !emailClean || password.toLowerCase() !== emailClean,
    doesNotContainFullEmail: !emailClean || !password.toLowerCase().includes(emailClean),
  };
};

export const isPasswordValid = (password, email = "") => {
  const r = validatePassword(password, email);
  return Object.values(r).every(Boolean);
};

/**
 * Password strength scoring (0–4).
 * Does NOT block submission — only drives the UI indicator.
 */
export const getPasswordStrength = (password, email = "") => {
  if (!password) return { score: 0, label: "" };

  let score = 0;
  const emailClean = email.toLowerCase().trim();

  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  const variety = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9\s]/.test(password),
  ].filter(Boolean).length;
  if (variety >= 3) score++;
  if (variety === 4) score++;

  // Penalise common sequences
  if (/(.)\1{2,}/.test(password)) score = Math.max(0, score - 1);
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) score = Math.max(0, score - 1);
  if (emailClean && password.toLowerCase().includes(emailClean)) score = Math.max(0, score - 1);

  const clampedScore = Math.min(4, Math.max(0, score));

  const labels = ["Too weak", "Too weak", "Fair", "Strong", "Very strong"];
  const colors = ["#ef4444", "#ef4444", "#f59e0b", "#22c55e", "#16a34a"];

  return { score: clampedScore, label: labels[clampedScore], color: colors[clampedScore] };
};

export const REQUIREMENTS = [
  { key: "minimumLength",           text: "At least 12 characters" },
  { key: "uppercase",               text: "One uppercase letter" },
  { key: "lowercase",               text: "One lowercase letter" },
  { key: "number",                  text: "One number" },
  { key: "specialCharacter",        text: "One special character" },
];