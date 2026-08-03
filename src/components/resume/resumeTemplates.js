export const TEMPLATES = [
  {
    id: 'classic_finance',
    name: 'Classic Finance',
    description: 'A compact, one-column Garamond resume designed for finance, consulting, investing, research, and traditional professional recruiting.',
    accentColor: '#7B1D2E',
    isDefault: true,
    recommended: ['finance', 'consulting', 'private equity', 'investment banking', 'corporate finance', 'research'],
  },
  {
    id: 'consulting',
    name: 'Consulting',
    description: 'Structured layout emphasizing impact and frameworks.',
    accentColor: '#0F2D4A',
  },
  {
    id: 'startup',
    name: 'Startup & Operations',
    description: 'Modern single-column optimized for high-growth roles.',
    accentColor: 'var(--brand-navy-900)',
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'Professional layout for clinical, research, and health-related roles.',
    accentColor: '#155E75',
  },
  {
    id: 'technology',
    name: 'Technology',
    description: 'Skills-forward layout for engineering and product roles.',
    accentColor: 'var(--info-700)',
  },
  {
    id: 'general',
    name: 'General College Student',
    description: 'Versatile ATS-friendly template for any industry.',
    accentColor: '#374151',
  },
];

export const DEFAULT_SECTIONS = [
  { id: 'contact',        label: 'CONTACT',                                          type: 'contact',        visible: true  },
  { id: 'education',      label: 'EDUCATION',                                        type: 'education_cf',   visible: true  },
  { id: 'experience',     label: 'WORK EXPERIENCE',                                  type: 'list',           visible: true  },
  { id: 'activities',     label: 'ACTIVITIES AND EXTRACURRICULAR',                   type: 'list',           visible: true  },
  { id: 'skills_grouped', label: 'SKILLS, TRAINING, OTHER ACTIVITIES, & INTERESTS',  type: 'skills_grouped', visible: true  },
  { id: 'certifications', label: 'CERTIFICATIONS',                                   type: 'cert',           visible: false },
  { id: 'awards',         label: 'AWARDS',                                           type: 'awards_cf',      visible: false },
  { id: 'research',       label: 'RESEARCH',                                         type: 'research',       visible: false },
];

// Classic Finance template — approved sections only
// Certifications, Awards, Research are optional and appear near the bottom
export const CLASSIC_FINANCE_SECTIONS = [
  { id: 'contact',        label: 'CONTACT',                                        type: 'contact',        visible: true,  cf_locked: true },
  { id: 'education',      label: 'EDUCATION',                                      type: 'education_cf',   visible: true,  cf_locked: true },
  { id: 'experience',     label: 'WORK EXPERIENCE',                                type: 'list',           visible: true,  cf_locked: true },
  { id: 'activities',     label: 'ACTIVITIES AND EXTRACURRICULAR',                 type: 'list',           visible: true,  cf_locked: true },
  { id: 'skills_grouped', label: 'SKILLS, TRAINING, OTHER ACTIVITIES, & INTERESTS', type: 'skills_grouped', visible: true,  cf_locked: true },
  { id: 'certifications', label: 'CERTIFICATIONS',                                 type: 'cert',           visible: false, cf_locked: true },
  { id: 'awards',         label: 'AWARDS',                                         type: 'awards_cf',      visible: false, cf_locked: true },
  { id: 'research',       label: 'RESEARCH',                                       type: 'research',       visible: false, cf_locked: true },
];

// Fixed skill group labels — not renameable
export const CF_SKILL_GROUP_IDS = ['tech', 'virtual', 'other', 'interests'];
export const CF_SKILL_GROUP_LABELS = {
  tech:      'Technical Skills',
  virtual:   'Virtual Programs',
  other:     'Other Activities',
  interests: 'Interests',
};

export const DEFAULT_SKILL_GROUPS = [
  { id: 'tech',      label: 'Technical Skills',  items: '' },
  { id: 'virtual',   label: 'Virtual Programs',  items: '' },
  { id: 'other',     label: 'Other Activities',  items: '' },
  { id: 'interests', label: 'Interests',         items: '' },
];

export function newEducationCF() {
  return {
    id: Math.random().toString(36).slice(2),
    institution: '',
    city: '',
    state: '',
    degree: '',
    degreeAbbrev: '',
    major: '',
    secondMajor: '',
    minor: '',
    concentration: '',
    gradMonth: '',
    gradYear: '',
    gpa: '',
    gpaScale: '4.00',
    showGpa: true,
    coursework: '',
    honors: '',
    hidden: false,
  };
}

export function newCert() {
  return {
    id: Math.random().toString(36).slice(2),
    name: '',
    issuer: '',
    month: '',
    year: '',
    expMonth: '',
    expYear: '',
    credentialId: '',
    credentialUrl: '',
    hidden: false,
  };
}

export function newAward() {
  return {
    id: Math.random().toString(36).slice(2),
    name: '',
    issuer: '',
    month: '',
    year: '',
    description: '',
    hidden: false,
  };
}

export function newResearch() {
  return {
    id: Math.random().toString(36).slice(2),
    title: '',
    institution: '',
    location: '',
    startMonth: '',
    startYear: '',
    endMonth: '',
    endYear: '',
    current: false,
    role: '',
    advisor: '',
    bullets: [''],
    link: '',
    hidden: false,
  };
}

export const BLANK_CONTACT = {
  name: '', email: '', phone: '', linkedin: '', portfolio: '', city: '', state: '',
};

export function newEntry() {
  return {
    id: Math.random().toString(36).slice(2),
    title: '', org: '', location: '', startDate: '', endDate: '', current: false,
    sectorGroup: '', hoursPerWeek: '', arrangement: '',
    linkLabel: '', linkUrl: '',
    bullets: [''],
    hidden: false,
  };
}

// Months helper
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MONTH_OPTIONS = MONTHS_SHORT.map((label, i) => ({ val: String(i + 1).padStart(2, '0'), label }));