/**
 * The library's experiment definitions.
 *
 * The content itself lives outside src so the same definitions can be read by
 * tooling as well as by the app: this module is only the join point, and the
 * seeder is the only thing that imports it.
 */
import { BUSINESS_EXPERIMENTS } from '../../../base44/shared/career-library/experiments-business.js';
import { HEALTH_SOCIAL_EXPERIMENTS } from '../../../base44/shared/career-library/experiments-health-social.js';

export const TEMPLATES = [...BUSINESS_EXPERIMENTS, ...HEALTH_SOCIAL_EXPERIMENTS];

export default TEMPLATES;