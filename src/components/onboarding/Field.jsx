export default function Field({ label, name, value, onChange, placeholder, type = 'text', rows }) {
  const cls = 'mt-2 w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3 text-base md:text-sm text-[color:var(--surface-dark-800)] placeholder-[color:var(--ink-400)] outline-none transition focus:border-[color:var(--info-600)] focus:bg-white focus:ring-4 focus:ring-[color:var(--info-600-a10)]';
  return (
    <label className="block text-sm font-semibold text-[color:var(--ink-700)]">
      {label}
      {rows
        ? <textarea rows={rows} name={name} value={value || ''} onChange={onChange} placeholder={placeholder} className={cls} />
        : <input type={type} name={name} value={value || ''} onChange={onChange} placeholder={placeholder} className={cls} />
      }
    </label>
  );
}