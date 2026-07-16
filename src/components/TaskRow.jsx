import { Check } from 'lucide-react';

const typeStyles = {
  networking: { bg: '#F5F3FF', text: '#7C3AED' },
  content: { bg: '#FDF2F8', text: '#DB2777' },
  project: { bg: '#EFF6FF', text: '#2563EB' },
  skill: { bg: '#FFFBEB', text: '#D97706' },
  wellness: { bg: '#ECFDF5', text: '#10B981' },
  career: { bg: '#F8FAFC', text: '#475569' },
  reflection: { bg: '#ECFEFF', text: '#0891B2' },
};

export default function TaskRow({ task, onToggle }) {
  const style = typeStyles[task.task_type] || typeStyles.career;
  return (
    <button
      onClick={() => onToggle(task)}
      className="w-full rounded-[16px] border border-[#E2E8F0] bg-white p-4 text-left transition hover:border-[#BFDBFE] hover:-translate-y-0.5 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition"
          style={
            task.completed
              ? { background: '#2563EB', borderColor: '#2563EB' }
              : { borderColor: '#CBD5E1' }
          }
        >
          {task.completed && <Check size={12} className="text-white" />}
        </span>
        <div>
          <p className={`text-sm font-semibold ${task.completed ? 'line-through text-[#94A3B8]' : 'text-[#07111F]'}`}>
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