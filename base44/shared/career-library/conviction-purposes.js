/**
 * The Conviction Test Library: what each test in the library is FOR.
 *
 * The library already answers "how well validated is this test" (Experiment
 * Strength, validation levels, sources) and "what does it measure and not
 * measure" (represented / not represented). This module adds the missing axis:
 * which part of conviction a test can move.
 *
 * Six purposes, because those are the six things a student has to have met
 * before a decision rests on evidence rather than a guess. They map onto the
 * Conviction Record's own areas, so a balanced set here is what lets a path
 * reach Decision Ready at all.
 *
 * A career is BALANCED when each purpose has at least one test behind it. It is
 * never balanced by adding a generic test: an uncovered purpose is reported as a
 * gap so it can be authored against the role blueprint, not filled.
 */

export const PURPOSES = [
  {
    id: 'core_work',
    label: 'Representative core work',
    establishes: 'Whether the work this career is actually made of suits you.',
    record_area: 'core_work',
  },
  {
    id: 'difficult_reality',
    label: 'The difficult reality',
    establishes: 'How you hold up in the part of the work people leave over, rather than the part they apply for.',
    record_area: 'core_work',
  },
  {
    id: 'work_environment',
    label: 'The work environment',
    establishes: 'How the conditions suit you: pace, interruption, structure, autonomy, who you work with.',
    record_area: 'work_environment',
  },
  {
    id: 'tradeoff',
    label: 'The tradeoffs',
    establishes: 'What this work would cost you, in hours, lifestyle, hierarchy or income risk.',
    record_area: 'tradeoffs',
  },
  {
    id: 'contradiction',
    label: 'Testing a contradiction',
    establishes: 'Whether an earlier reading holds up when the same thing is tested again in a different context.',
    record_area: 'stability',
  },
  {
    id: 'comparison',
    label: 'A comparison point',
    establishes: 'How this work compares against a neighbouring path, on one deliberate difference.',
    record_area: 'comparison',
  },
];

export const PURPOSE_IDS = PURPOSES.map(p => p.id);
export const PURPOSE_BY_ID = new Map(PURPOSES.map(p => [p.id, p]));

/**
 * The purposes of the library's original entries, which predate this axis.
 * New tests carry `purpose` inline; nothing is ever inferred at read time,
 * because a guessed purpose would be exactly the generic filler this library
 * is not allowed to contain.
 */
export const LEGACY_PURPOSE_BY_KEY = {
  // Business
  management_consulting__structuring_a_vague_question: 'core_work',
  management_consulting__clean_the_client_data: 'difficult_reality',
  management_consulting__defend_a_recommendation: 'difficult_reality',
  management_consulting__interview_a_consultant: 'tradeoff',
  investment_banking__build_a_three_statement_model: 'core_work',
  investment_banking__tie_out_under_time_pressure: 'difficult_reality',
  investment_banking__hours_reality_interview: 'tradeoff',
  corporate_finance_fpa__build_a_forecast_and_explain_variance: 'core_work',
  corporate_finance_fpa__monthly_pack_twice: 'work_environment',
  corporate_finance_fpa__explain_numbers_to_a_non_finance_person: 'difficult_reality',
  private_equity__write_an_investment_memo: 'core_work',
  private_equity__screen_and_reject_twenty: 'difficult_reality',
  corporate_development_ma__build_the_internal_case: 'core_work',
  corporate_development_ma__coordinate_a_diligence_list: 'work_environment',
  wealth_management__build_a_plan_for_a_real_person: 'core_work',
  wealth_management__ask_for_the_meeting: 'difficult_reality',
  commercial_banking__write_a_credit_memo: 'core_work',
  commercial_banking__monitor_a_portfolio: 'work_environment',
  product_management__cut_the_roadmap: 'core_work',
  product_management__five_user_interviews: 'core_work',
  product_management__write_a_spec: 'core_work',
  software_engineering__fix_a_bug_in_a_strange_codebase: 'core_work',
  software_engineering__take_a_code_review: 'difficult_reality',
  brand_marketing__ship_a_campaign_and_read_the_data: 'core_work',
  brand_marketing__positioning_from_customer_language: 'core_work',
  tech_sales__thirty_cold_outreaches: 'difficult_reality',
  tech_sales__discovery_conversation: 'core_work',
  startup_founder_operator__find_paying_demand: 'core_work',
  startup_founder_operator__build_the_boring_process: 'difficult_reality',
  law_practice__research_memo: 'core_work',
  law_practice__document_review_volume: 'difficult_reality',
  commercial_real_estate__underwrite_a_building: 'core_work',
  commercial_real_estate__prospect_ten_owners: 'difficult_reality',
  // Health and social
  clinical_medicine__reason_through_published_cases: 'core_work',
  clinical_medicine__documentation_load: 'difficult_reality',
  clinical_medicine__shadow_and_ask_about_the_weight: 'tradeoff',
  nursing_clinical_care__direct_care_volunteering: 'core_work',
  nursing_clinical_care__protocol_precision_under_interruption: 'work_environment',
  healthcare_administration__find_and_fix_a_bottleneck: 'core_work',
  healthcare_administration__persuade_a_practitioner: 'difficult_reality',
  health_policy_research__evidence_review_and_brief: 'core_work',
  health_policy_research__present_findings_to_non_experts: 'difficult_reality',
  nonprofit_program__run_a_small_program: 'core_work',
  nonprofit_program__report_a_disappointing_outcome: 'difficult_reality',
  education_program__deliver_the_same_session_three_times: 'work_environment',
  education_program__hold_a_disengaged_group: 'difficult_reality',
};

/** The purpose of one library entry, or null when it has not been assigned one. */
export function purposeOf(entry) {
  const id = entry?.purpose || entry?.conviction_purpose || LEGACY_PURPOSE_BY_KEY[entry?.key || entry?.blueprint_key];
  return id && PURPOSE_BY_ID.has(id) ? id : null;
}

/**
 * Which purposes a career's tests cover, and which are still open.
 * @param {Array} entries library entries or ExperimentTemplate rows for ONE career
 */
export function convictionCoverage(entries = []) {
  const counts = {};
  PURPOSE_IDS.forEach(id => { counts[id] = 0; });
  let unassigned = 0;
  entries.forEach(e => {
    const id = purposeOf(e);
    if (id) counts[id] += 1;
    else unassigned += 1;
  });
  const covered = PURPOSE_IDS.filter(id => counts[id] > 0);
  const missing = PURPOSE_IDS.filter(id => counts[id] === 0);
  return {
    counts,
    covered,
    missing,
    unassigned,
    balanced: missing.length === 0,
  };
}

export default PURPOSES;