import { Check } from 'lucide-react';

const typeStyles = {
  networking: { bg: '#EEF2F6', text: '#1F3A5F' },
  content:    { bg: '#EEF2F6', text: '#274C77' },
  project:    { bg: '#F1F5F9', text: '#334155' },
  skill:      { bg: '#FFFBEB', text: '#B45309' },
  wellness:   { bg: '#F0FDF4', text: '#15803D' },
  career:     { bg: '#F8FAFC', text: '#475569' },
  reflection: { bg: '#EEF2F6', text: '#274C77' },
};

export default function TaskRow({ task, onToggle }) {
  const style = typeStyles[task.task_type] || typeStyles.career;
  return (
    <button
      onClick={() => onToggle(task)}
      className="w-full rounded-[16px] border border-[#E2E8F0] bg-white p-4 text-left transition hover:border-[rgba(31,58,95,0.25)] hover:-translate-y-0.5 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition"
          style={
            task.completed
              ? { background: '#15803D', borderColor: '#15803D' }
              : { borderColor: '#CBD5E1' }
          }
        >
          {task.completed && <Check size={12} className="text-white" />}
        </span>
        <div>
          <p className={`text-sm font-semibold ${task.completed ? 'line-through text-[#94A3B8]' : 'text-[#050816]'}`}>
            {task.task_title}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: style.bg, color: style.text }}
            >
              {task.task_type}
            </span>
            {task.time && <span className="text-xs text-[#94A3B8]">{task.time}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}