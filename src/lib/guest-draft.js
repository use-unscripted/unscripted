/**
 * Guest onboarding draft — stored in localStorage under a versioned key.
 * Never stores passwords, tokens, or payment data.
 */

const KEY = 'unscripted_guest_onboarding_v1';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function makeSessionId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    // Expire drafts older than 7 days
    if (draft.started_at && Date.now() - new Date(draft.started_at).getTime() > SEVEN_DAYS_MS) {
      clearDraft();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(patch) {
  try {
    const existing = loadDraft() || {
      draft_version: 1,
      guest_session_id: makeSessionId(),
      started_at: new Date().toISOString(),
      completed: false,
    };
    const updated = { ...existing, ...patch, updated_at: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function isDraftComplete(draft) {
  if (!draft) return false;
  return !!(draft.name && draft.college && draft.major && draft.primary_path && draft.available_hours_per_week);
}