import { describe, expect, it } from 'vitest';
import {
  EFFECTIVENESS_THRESHOLDS, effectivenessGate, safeRate,
} from '@/lib/effectiveness-thresholds';
import {
  EFFECTIVENESS_THRESHOLDS as BACKEND_THRESHOLDS,
  effectivenessGate as backendGate,
} from '../../base44/shared/effectiveness-thresholds.js';
import { fieldCalibrationCheck, FIELD_CALIBRATION } from '../../base44/shared/experiment-feedback.js';
import { experimentEffectiveness } from '../../base44/shared/decision-intelligence.js';

const ADMIN_MIN = EFFECTIVENESS_THRESHOLDS.admin.min_students_completed;      // 5
const SURVEY_MIN = EFFECTIVENESS_THRESHOLDS.admin.min_survey_responses;      // 4

const gateAt = (completed, responses = 99) =>
  effectivenessGate({ students_completed: completed, survey_responses: responses, audience: 'admin' });

describe('threshold configuration', () => {
  it('is identical on the frontend and the backend', () => {
    expect(EFFECTIVENESS_THRESHOLDS).toEqual(BACKEND_THRESHOLDS);
  });

  it('applies a stricter bar to student-facing numbers', () => {
    expect(EFFECTIVENESS_THRESHOLDS.student_facing.min_students_completed)
      .toBeGreaterThan(EFFECTIVENESS_THRESHOLDS.admin.min_students_completed);
  });
});

describe('suppression by completion count', () => {
  it('suppresses at 0 completions and names the zero denominator', () => {
    const g = gateAt(0);
    expect(g.suppressed).toBe(true);
    expect(g.insufficient_sample).toBe(true);
    expect(g.message).toBe('Not enough data yet.');
    expect(g.label).toBe('Insufficient Sample');
    expect(g.reasons.join(' ')).toMatch(/zero denominator/);
  });

  it('suppresses at 1 completion', () => {
    expect(gateAt(1).suppressed).toBe(true);
  });

  it('suppresses just below the threshold', () => {
    expect(gateAt(ADMIN_MIN - 1).suppressed).toBe(true);
  });

  it('passes at exactly the threshold', () => {
    const g = gateAt(ADMIN_MIN);
    expect(g.suppressed).toBe(false);
    expect(g.label).toBeNull();
    expect(g.message).toBeNull();
  });

  it('passes above the threshold', () => {
    expect(gateAt(ADMIN_MIN + 12).suppressed).toBe(false);
  });
});

describe('suppression by survey response count', () => {
  it('suppresses below the survey threshold even with plenty of completions', () => {
    expect(gateAt(50, SURVEY_MIN - 1).suppressed).toBe(true);
  });

  it('passes at exactly the survey threshold', () => {
    expect(gateAt(50, SURVEY_MIN).suppressed).toBe(false);
  });

  it('treats zero responses as suppressed', () => {
    expect(gateAt(50, 0).suppressed).toBe(true);
  });
});

describe('zero denominators', () => {
  it('returns null rather than 0% when nothing completed', () => {
    expect(safeRate(0, 0)).toBeNull();
    expect(safeRate(3, 0)).toBeNull();
  });

  it('still computes a real rate', () => {
    expect(safeRate(1, 4)).toBe(25);
  });

  it('behaves identically on the backend gate', () => {
    expect(backendGate({ students_completed: 0, survey_responses: 0 }).suppressed).toBe(true);
    expect(backendGate({ students_completed: 99, survey_responses: 99 }).suppressed).toBe(false);
  });
});

describe('field calibration', () => {
  const strongSurvey = {
    students: 9, survey_responses: 9, survey_realism_no_basis: 0, survey_realism_rating: 4.2,
  };

  it('refuses calibration without a completion sample', () => {
    const r = fieldCalibrationCheck({ survey: strongSurvey, validation_level: 3, students_completed: 0 });
    expect(r.eligible).toBe(false);
    expect(r.missing.join(' ')).toMatch(/completed it/);
  });

  it('refuses calibration without adequate validation', () => {
    const r = fieldCalibrationCheck({ survey: strongSurvey, validation_level: 1, students_completed: 40 });
    expect(r.eligible).toBe(false);
    expect(r.missing.join(' ')).toMatch(/validation level/);
  });

  it('allows calibration only with both', () => {
    const r = fieldCalibrationCheck({
      survey: strongSurvey, validation_level: 3, students_completed: FIELD_CALIBRATION.min_students_completed,
    });
    expect(r.eligible).toBe(true);
  });
});

describe('the audited row: started but never completed', () => {
  // Six distinct students started it, nobody finished, nobody surveyed it.
  const experiments = Array.from({ length: 6 }, (_, i) => ({
    id: `e${i}`, created_by_id: `u${i}`, status: 'planned',
    title: 'The Phase 2 Data Drop', test_question: 'Can you tolerate the detail?',
  }));

  const row = experimentEffectiveness({ experiments })[0];

  it('reports zero completions and zero surveys', () => {
    expect(row.students_completed).toBe(0);
    expect(row.survey_responses).toBe(0);
  });

  it('is flagged insufficient rather than published', () => {
    expect(row.effectiveness_suppressed).toBe(true);
    expect(row.insufficient_sample).toBe(true);
    expect(row.student_facing_suppressed).toBe(true);
  });

  it('publishes no rate, average or conclusion', () => {
    ['completion_rate', 'evidence_submission_rate', 'reflection_completion_rate',
      'pct_changed_understanding', 'information_value_score', 'survey_realism_rating',
      'dropoff_stage'].forEach((f) => {
      expect(row[f]).toBeUndefined();
    });
  });

  it('may not be called field calibrated', () => {
    expect(row.field_calibration.eligible).toBe(false);
  });
});