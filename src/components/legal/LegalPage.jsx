/* ──────────────────────────────────────────────────────────────────────────
   Shell + typographic primitives for the public policy and company pages.

   The policy pages are drafted as legal instruments, so the primitives follow
   the conventions those documents use and courts expect:

   - numbered clauses (§ 4) with numbered run-in subsections (4.2 Heading.)
     so the text can cross-reference itself
   - lettered sub-lists, (a)/(b)/(c), for enumerated obligations
   - a defined-terms clause, terms rendered in quotes and bold on first use
   - Effective Date and Last Updated stated separately
   - a contents block, since a reader is usually looking for one clause
   - <Conspicuous> for the warranty disclaimer and liability cap. UCC § 2-316
     requires those to be conspicuous to be enforceable, which is why they are
     the only blocks set in caps — if the whole document shouted, none of it
     would be conspicuous.

   Type colour is --text-secondary throughout, never --text-muted (#718096),
   which is 4.02:1 on white and fails the text minimum.
   ────────────────────────────────────────────────────────────────────────── */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LogoFull } from '@/components/UnscriptedLogo';
import SiteFooter from '@/components/SiteFooter';
import { CONTACT_EMAIL } from '@/lib/legal';

export function LegalPage({ title, effective, updated, notice, lede, contents, children }) {
  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9' }}>
      <header className="border-b" style={{ borderColor: 'var(--border-light)' }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5">
          <Link to="/" className="rounded focus-visible:outline-2 focus-visible:outline-offset-4" style={{ outlineColor: 'var(--brand-navy-900)' }}>
            <LogoFull height={40} />
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ color: 'var(--text-secondary)', outlineColor: 'var(--brand-navy-900)' }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="font-heading text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>

        {(effective || updated) && (
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {effective && <>Effective Date: {effective}</>}
            {effective && updated && <span aria-hidden="true"> · </span>}
            {updated && <>Last Updated: {updated}</>}
          </p>
        )}

        {notice && (
          <p
            className="mt-8 border-l-4 py-4 pl-5 pr-4 text-[13px] font-bold uppercase leading-relaxed tracking-wide"
            style={{ borderColor: 'var(--brand-gold-500)', background: 'var(--background-secondary)', color: 'var(--text-primary)' }}
          >
            {notice}
          </p>
        )}

        {lede && <div className="mt-8 space-y-4">{lede}</div>}

        {contents && (
          <nav
            aria-label="Contents"
            className="mt-10 rounded-2xl border p-6"
            style={{ borderColor: 'var(--border-light)', background: 'var(--background-secondary)' }}
          >
            <h2 className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: 'var(--brand-gold-700)' }}>
              Contents
            </h2>
            {/* Columns, not a grid: a reader scans a contents list down one
                column and then across, not left-to-right by pairs. */}
            <ol className="mt-4 gap-x-8 space-y-2 sm:columns-2">
              {contents.map(({ id, title: label }, i) => (
                <li key={id} className="break-inside-avoid text-sm">
                  <a
                    href={`#${id}`}
                    className="rounded underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ color: 'var(--text-secondary)', outlineColor: 'var(--brand-navy-900)' }}
                  >
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{i + 1}.</span> {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="mt-12">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}

/** A numbered top-level clause. `n` is stated rather than derived so the
    document can cross-reference "Section 14" and stay correct under edits. */
export function Clause({ n, id, title, children }) {
  return (
    <section id={id} className="mt-11 scroll-mt-8 first:mt-0">
      <h2 className="font-heading text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {n}. {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Numbered subsection with a run-in heading: "4.2 Retention. Text follows…" */
export function Sub({ n, title, children }) {
  return (
    <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
      <strong style={{ color: 'var(--text-primary)' }}>
        {n}
        {title ? ` ${title}.` : ''}
      </strong>{' '}
      {children}
    </p>
  );
}

export function P({ children }) {
  return (
    <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </p>
  );
}

/** Lettered enumeration — the convention for obligations and carve-outs. */
export function Enum({ items }) {
  return (
    <ol className="list-[lower-alpha] space-y-2 pl-9 marker:font-semibold marker:text-[var(--brand-gold-700)]">
      {items.map((item, i) => (
        <li key={i} className="pl-1 text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {item}
        </li>
      ))}
    </ol>
  );
}

/** Definition entries for the defined-terms clause. */
export function Defs({ items }) {
  return (
    <dl className="space-y-3">
      {items.map(({ term, def }) => (
        <div key={term} className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <dt className="inline font-bold" style={{ color: 'var(--text-primary)' }}>
            “{term}”
          </dt>{' '}
          <dd className="inline">{def}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Conspicuous block — caps, bold, boxed, contrasting rule. Reserved for the
 * warranty disclaimer and the liability limitation, which are unenforceable
 * if a reasonable person would not notice them.
 */
export function Conspicuous({ children }) {
  return (
    <div
      className="rounded-xl border-2 p-5"
      style={{ borderColor: 'var(--brand-navy-900)', background: 'var(--background-secondary)' }}
    >
      <p
        className="text-[13px] font-bold uppercase leading-relaxed tracking-wide"
        style={{ color: 'var(--text-primary)' }}
      >
        {children}
      </p>
    </div>
  );
}

/** Disclosure table (categories of Personal Information, recipients). Scrolls
    inside itself on narrow screens rather than pushing the page sideways. */
export function DataTable({ caption, columns, rows }) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
        {caption && (
          <caption className="pb-3 text-left text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            {caption}
          </caption>
        )}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                scope="col"
                className="border-b-2 px-3 py-2 align-bottom text-xs font-bold uppercase tracking-wide"
                style={{ borderColor: 'var(--brand-navy-900)', color: 'var(--text-primary)' }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border-b px-3 py-3 align-top leading-relaxed"
                  style={{ borderColor: 'var(--border-light)', color: j === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: j === 0 ? 600 : 400 }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Section heading for the non-legal pages (About, Contact). */
export function Section({ title, children }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-heading text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

export function Bullets({ items }) {
  return (
    <ul className="space-y-2.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <span aria-hidden="true" style={{ color: 'var(--brand-gold-600)' }}>—</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Mail() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className="rounded font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ color: 'var(--brand-navy-700)', outlineColor: 'var(--brand-navy-900)' }}
    >
      {CONTACT_EMAIL}
    </a>
  );
}

/** Internal cross-reference or link, styled to match the policy body. */
export function Ref({ to, children }) {
  return (
    <Link
      to={to}
      className="rounded font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ color: 'var(--brand-navy-700)', outlineColor: 'var(--brand-navy-900)' }}
    >
      {children}
    </Link>
  );
}
