import { GraduationCap, School } from 'lucide-react';

export const STAGE_OPTIONS = [
  {
    value: 'high_school',
    label: 'High school student',
    description: 'I want to test paths before I commit to a college, major, or career.',
    icon: School,
  },
  {
    value: 'college',
    label: 'College student',
    description: 'I am in college and want to test paths before I commit to a career.',
    icon: GraduationCap,
  },
];

export default function EducationStageStep({ value, onSelect }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {STAGE_OPTIONS.map(opt => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className="ui-lift rounded-[18px] border p-5 text-left transition"
            style={selected
              ? { borderColor: 'var(--brand-navy-900)', background: '#EEF2F6' }
              : { borderColor: '#E2E8F0', background: '#F8FAFC' }}
          >
            <Icon size={22} style={{ color: 'var(--brand-navy-900)' }} />
            <p className="mt-3 font-heading text-base font-bold text-[#050816]">{opt.label}</p>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">{opt.description}</p>
          </button>
        );
      })}
    </div>
  );
}