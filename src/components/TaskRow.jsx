import { Check } from 'lucide-react';

const typeStyles = {
  networking: { bg: 'var(--ink-100)', text: 'var(--brand-navy-900)' },
  content:    { bg: 'var(--ink-100)', text: 'var(--brand-navy-700)' },
  project:    { bg: 'var(--ink-100)', text: 'var(--ink-700)' },
  skill:      { bg: 'var(--warning-50)', text: 'var(--warning-700)' },
  wellness:   { bg: 'var(--success-50)', text: 'var(--success-700)' },
  career:     { bg: 'var(--ink-50)', text: 'var(--ink-600)' },
  reflection: { bg: 'var(--ink-100)', text: 'var(--brand-navy-700)' },
};

export default function TaskRow({ task, onToggle }) {
  const style = typeStyles[task.task_type] || typeStyles.career;
  return (
    <button
      onClick={() => onToggle(task)}
      className="w-full rounded-[16px] border border-[color:var(--ink-200)] bg-white p-4 text-left transition hover:border-[rgba(31,58,95,0.25)] hover:-translate-y-0.5 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition"
          style={
            task.completed
              ? { background: 'var(--success-700)', borderColor: 'var(--success-700)' }
              : { borderColor: 'var(--ink-300)' }
          }
        >
          {task.completed && <Check size={12} className="text-white" />}
        </span>
        <div>
          <p className={`text-sm font-semibold ${task.completed ? 'line-through text-[color:var(--ink-400)]' : 'text-[color:var(--surface-dark-900)]'}`}>
            {task.task_title}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: style.bg, color: style.text }}
            >
              {task.task_type}
            </span>
            {task.time && <span className="text-xs text-[color:var(--ink-400)]">{task.time}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}