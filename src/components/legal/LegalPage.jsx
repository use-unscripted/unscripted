/* ──────────────────────────────────────────────────────────────────────────
   Shared shell + prose primitives for the public policy / company pages.

   Deliberately plain: a legal page that reads like a person wrote it is worth
   more trust than one that reads like it was pasted from a generator, and the
   audience here is an 18-year-old and a university's career-services office.

   Type colour is --text-secondary throughout, never --text-muted (#718096),
   which is 4.02:1 on white and fails the text minimum.
   ────────────────────────────────────────────────────────────────────────── */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LogoFull } from '@/components/UnscriptedLogo';
import SiteFooter from '@/components/SiteFooter';
import { CONTACT_EMAIL } from '@/lib/legal';

export function LegalPage({ title, updated, summary, children }) {
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
        <h1
          className="font-heading text-4xl font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h1>

        {updated && (
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Last updated {updated}
          </p>
        )}

        {summary && (
          <div
            className="mt-8 rounded-2xl border p-6"
            style={{ borderColor: 'var(--border-light)', background: 'var(--background-secondary)' }}
          >
            <p
              className="text-xs font-bold uppercase tracking-[.16em]"
              style={{ color: 'var(--brand-gold-700)' }}
            >
              The short version
            </p>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {summary}
            </p>
          </div>
        )}

        <div className="mt-12">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function Section({ title, children }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2
        className="font-heading text-xl font-bold tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

export function P({ children }) {
  return (
    <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </p>
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

/** For the handful of statements a reader should not be able to skim past. */
export function Callout({ children }) {
  return (
    <div
      className="rounded-xl border-l-4 py-4 pl-5 pr-4"
      style={{ borderColor: 'var(--brand-gold-500)', background: 'var(--background-secondary)' }}
    >
      <p className="text-[15px] font-semibold leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        {children}
      </p>
    </div>
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
