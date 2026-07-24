export const TEMPLATES = [
  {
    id: 'classic_finance',
    name: 'Classic Finance',
    description: 'A compact, one-column Garamond resume designed for finance, consulting, investing, research, and traditional professional recruiting.',
    accentColor: '#111111',
    isDefault: true,
    recommended: ['finance', 'consulting', 'private equity', 'investment banking', 'corporate finance', 'research'],
  },
  {
    id: 'finance',
    name: 'Finance & Investment Banking',
    description: 'Clean, traditional layout favored by IB and PE recruiters.',
    accentColor: '#1E3A5F',
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
    accentColor: '#1F3A5F',
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
    accentColor: '#1D4ED8',
  },
  {
    id: 'general',
    name: 'General College Student',
    description: 'Versatile ATS-friendly template for any industry.',
    accentColor: '#374151',
  },
  {
    id: 'first',
    name: 'First Resume',
    description: 'Minimal template for students with limited work experience.',
    accentColor: '#4B5563',
  },
  {
    id: 'experienced',
    name: 'Experienced Student',
    description: 'Expanded layout for students with substantial internship history.',
    accentColor: '#1F2937',
  },
];

export const DEFAULT_SECTIONS = [
  { id: 'contact', label: 'Contact', type: 'contact', visible: true },
  { id: 'education', label: 'Education', type: 'list', visible: true },
  { id: 'experience', label: 'Experience', type: 'list', visible: true },
  { id: 'internships', label: 'Internships', type: 'list', visible: false },
  { id: 'leadership', label: 'Leadership', type: 'list', visible: false },
  { id: 'projects', label: 'Projects', type: 'list', visible: true },
  { id: 'skills', label: 'Skills', type: 'skills', visible: true },
  { id: 'certifications', label: 'Certifications', type: 'list', visible: false },
  { id: 'activities', label: 'Activities', type: 'list', visible: false },
  { id: 'awards', label: 'Awards', type: 'list', visible: false },
];

// Classic Finance template uses these sections by default
export const CLASSIC_FINANCE_SECTIONS = [
  { id: 'contact', label: 'Contact', type: 'contact', visible: true },
  { id: 'education', label: 'EDUCATION', type: 'education_cf', visible: true },
  { id: 'experience', label: 'WORK EXPERIENCE', type: 'list', visible: true },
  { id: 'activities', label: 'ACTIVITIES AND EXTRACURRICULAR', type: 'list', visible: true },
  { id: 'skills_grouped', label: 'SKILLS, TRAINING, OTHER ACTIVITIES, & INTERESTS', type: 'skills_grouped', visible: true },
];

export const BLANK_EDUCATION_CF = {
  id: () => Math.random().toString(36).slice(2),
  institution: '',
  location: '',
  gradMonth: '',
  gradYear: '',
  degree: '',
  major: '',
  secondMajor: '',
  minor: '',
  gpa: '',
  gpaScale: '4',
  showGpa: true,
  coursework: '',
  honors: '',
  studyAbroad: '',
  hidden: false,
};

export function newEducationCF() {
  return {
    id: Math.random().toString(36).slice(2),
    institution: '',
    location: '',
    gradMonth: '',
    gradYear: '',
    degree: '',
    major: '',
    secondMajor: '',
    minor: '',
    gpa: '',
    gpaScale: '4',
    showGpa: true,
    coursework: '',
    honors: '',
    studyAbroad: '',
    hidden: false,
  };
}

export const DEFAULT_SKILL_GROUPS = [
  { id: 'tech', label: 'Technical Skills', items: '' },
  { id: 'virtual', label: 'Virtual Programs', items: '' },
  { id: 'other', label: 'Other Activities', items: '' },
  { id: 'interests', label: 'Interests', items: '' },
];

export function newSkillGroup() {
  return { id: Math.random().toString(36).slice(2), label: 'Category', items: '' };
}

export const BLANK_CONTACT = {
  name: '', email: '', phone: '', linkedin: '', github: '', portfolio: '', location: '',
};

export const BLANK_ENTRY = {
  id: () => Math.random().toString(36).slice(2),
  title: '', org: '', location: '', startDate: '', endDate: '', current: false,
  bullets: [''],
  hidden: false,
};

export function newEntry() {
  return {
    id: Math.random().toString(36).slice(2),
    title: '', org: '', location: '', startDate: '', endDate: '', current: false,
    bullets: [''],
    hidden: false,
  };
}

export function newSection(label) {
  return {
    id: Math.random().toString(36).slice(2),
    label: label || 'Custom Section',
    type: 'list',
    visible: true,
    custom: true,
  };
}