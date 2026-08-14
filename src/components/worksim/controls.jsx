/**
 * The three controls every simulation step uses, in one place so five screens
 * cannot drift into five slightly different text areas.
 *
 * Nothing here invents a look. The border, radius, type scale and the navy
 * primary button are the ones the rest of the signed-in app already uses; see
 * MomentTask and the weekly reflection for the same combination.
 */

/** A labelled text area. Sixteen pixels on a phone so iOS does not zoom in. */
export function SimTextArea({ label = '', hint = '', rows = 3, value, onChange, placeholder = '', id = undefined }) {
  // The hint sits outside the label element on purpose. Inside it, the field's
  // accessible name becomes the question and the hint run together, which is
  // what a screen reader would then read out on focus.
  return (
    <div>
      {label && (
        <label className="tp-body block font-semibold" htmlFor={id} style={{ color: 'var(--text-primary)' }}>
          {label}
        </label>
      )}
      {hint && (
        <p className="tp-meta mb-1.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>
      )}
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-[var(--r-control)] border px-4 py-3 text-base outline-none"
        style={{ borderColor: 'var(--border-light)', background: 'var(--background-primary)', color: 'var(--text-primary)' }}
      />
    </div>
  );
}

/** The one primary button on a step. */
export function SimNext({ children, onClick, disabled = false, busy = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="tp-control ui-press app-cta w-full font-bold disabled:opacity-40"
      style={{ minHeight: '48px' }}
    >
      {busy ? 'Saving' : children}
    </button>
  );
}

/** A quoted block of the simulation's own fixed text: a ticket, an email, a message. */
export function SimNote({ from, subject = '', children }) {
  return (
    <article className="app-inset p-4 sm:p-5" style={{ background: 'var(--background-secondary)' }}>
      <p className="tp-meta font-semibold" style={{ color: 'var(--text-primary)' }}>{from}</p>
      {subject && <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>{subject}</p>}
      <div className="mt-2.5">{children}</div>
    </article>
  );
}
