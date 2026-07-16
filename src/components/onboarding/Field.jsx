export default function Field({ label, name, value, onChange, placeholder, type = 'text', rows }) {
  const cls = 'mt-2 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#07111F] placeholder-[#94A3B8] outline-none transition focus:border-[#2563EB] focus:bg-white focus:ring-4 focus:ring-[#2563EB]/10';
  return (
    <label className="block text-sm font-semibold text-[#334155]">
      {label}
      {rows
        ? <textarea rows={rows} name={name} value={value || ''} onChange={onChange} placeholder={placeholder} className={cls} />
        : <input type={type} name={name} value={value || ''} onChange={onChange} placeholder={placeholder} className={cls} />
      }
    </label>
  );
}