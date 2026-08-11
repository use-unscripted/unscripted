import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

/**
 * The app's one dropdown.
 *
 * A native <select> is drawn by the platform, so the same control looked like a
 * grey iOS bar on a phone and like the app everywhere else, and its options
 * could not be styled at all. This is the Radix listbox instead: one branded
 * control, thumb-sized rows, and a list that scrolls inside the viewport rather
 * than covering it.
 *
 * Radix has no concept of an empty value, but plenty of these dropdowns have a
 * "Month" or "No specific mission" row that means exactly that, so an empty
 * string is carried through the listbox as a sentinel and handed back to the
 * caller as '' — callers keep the value shape they already store.
 */
const NONE = '__none__';

export default function FieldSelect({
  value,
  onChange,
  options = [],
  placeholder,
  className = '',
  ariaLabel,
  disabled,
}) {
  return (
    <Select
      value={value ? value : undefined}
      onValueChange={(v) => onChange(v === NONE ? '' : v)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={`h-auto min-h-[44px] text-base md:text-sm ${className}`}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {/* Capped so a long list (every experiment, every month) stays a list on a
          phone screen rather than a full-height takeover. */}
      <SelectContent className="max-h-[60vh]">
        {options.map((o) => (
          <SelectItem
            key={o.value === '' ? NONE : o.value}
            value={o.value === '' ? NONE : o.value}
            className="min-h-[44px] text-base md:text-sm"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}