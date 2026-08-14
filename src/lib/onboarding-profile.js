/**
 * Turning a guest intake draft into the one StudentProfile row.
 *
 * Everything the intake collects is student self-report. It is stored under
 * names that say so (self_reported_*, prior_experiences, major_uncertainties)
 * and it is never written anywhere the evidence layer reads as demonstrated
 * behaviour.
 *
 * The five priority scores below are DERIVED, not asked. The intake replaced
 * the five 1-5 sliders with the values grid, and the path-generation prompt
 * still reads the scores, so they are mapped here rather than losing that
 * personalisation or asking the same thing twice. Anything the student did not
 * rate stays absent, and the generator's own default applies.
 */

const list = (v) => (Array.isArray(v) ? v : []);

/** Values grid factor → the priority score the generator prompt reads. */
const PRIORITY_FROM_VALUE = {
  Autonomy: 'priority_autonomy',
  Stability: 'priority_stability',
  'Mission or social impact': 'priority_impact',
  Creativity: 'priority_creativity',
  Entrepreneurship: 'priority_ownership',
};

/** 1-4 importance → the 1-5 scale the prompt was written against. */
const toFive = (importance) => Math.min(5, Math.max(1, Math.round(importance * 1.25)));

export function derivedPriorities(draft) {
  const out = {};
  list(draft.values_importance).forEach(({ factor, importance }) => {
    const key = PRIORITY_FROM_VALUE[factor];
    if (key && typeof importance === 'number') out[key] = toFive(importance);
  });
  return out;
}

/**
 * The careers the student named, if any. A student who named none is fully
 * supported: the generator falls back to "undecided" and builds three
 * hypotheses from the rest of the intake.
 */
export function consideredCareers(draft) {
  return list(draft.current_careers_considered).filter(Boolean);
}

/** The fields written to StudentProfile on claim. */
export function profileFromDraft(draft) {
  const considered = consideredCareers(draft);
  return {
    name: draft.name,
    education_stage: draft.education_stage || 'college',
    college: draft.college || 'Not specified',
    major: draft.major || 'Undecided',
    graduation_year: draft.graduation_year,
    school_year: draft.school_year,
    // The careers they are considering, kept in the field the generator and the
    // hypothesis layer already read. Empty when they named none.
    career_interests: considered.join(', '),
    pressured_paths: draft.pressured_path,
    secret_paths: draft.curious_path,
    biggest_blocker: draft.biggest_blocker,
    commitments: draft.fixed_commitments,
    available_hours_per_week: draft.available_hours_per_week || 8,
    willing_financial_risk: draft.willing_financial_risk,
    willing_long_hours: draft.willing_long_hours,
    guest_session_id: draft.guest_session_id,

    // The uncertainty baseline. This is what progress is measured against.
    onboarding_version: 3,
    baseline_career_clarity: draft.baseline_career_clarity,
    baseline_confidence: draft.baseline_confidence,
    baseline_recorded_at: new Date().toISOString(),
    current_careers_considered: considered,
    careers_ruled_out: list(draft.careers_ruled_out),
    current_decision_pressure: list(draft.current_decision_pressure),
    current_decision_pressure_note: draft.current_decision_pressure_note || '',
    major_uncertainties: list(draft.major_uncertainties),
    major_uncertainties_other: draft.major_uncertainties_other || '',

    // Stated preference, and prior experience. Not evidence.
    self_reported_energizers: list(draft.self_reported_energizers),
    self_reported_drains: list(draft.self_reported_drains),
    values_importance: list(draft.values_importance),
    work_setting_preference: draft.work_setting_preference || undefined,
    prior_experiences: list(draft.prior_experiences),

    ...derivedPriorities(draft),

    personal_notes: draft.personal_notes || '',
    long_term_ambitions: draft.long_term_ambitions || '',
    responsibilities_constraints: draft.responsibilities_constraints || '',
    things_to_avoid: draft.things_to_avoid || '',
    priorities_for_recommendations: draft.priorities_for_recommendations || '',
  };
}

/** The identity and path fields kept on the user record. */
export function userMetaFromDraft(draft) {
  const considered = consideredCareers(draft);
  return {
    education_stage: draft.education_stage || 'college',
    college: draft.college,
    major: draft.major,
    graduation_year: draft.graduation_year,
    school_year: draft.school_year,
    // Optional now. "undecided" is what the generator reads when a student has
    // named no career, and it is a supported starting point rather than a gap.
    primary_path: considered[0] || 'undecided',
    comparison_path: considered[1] || '',
  };
}