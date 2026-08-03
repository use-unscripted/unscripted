/* ──────────────────────────────────────────────────────────────────────────
   SiteFooter — the public footer.

   Replaces the one-line copyright that named no entity and linked nowhere.
   Two things it has to do beyond looking finished: give a visitor a route to
   the policies, and state that the universities on the landing marquee have
   not endorsed us.
   ────────────────────────────────────────────────────────────────────────── */
import { Link } from 'react-router-dom';
import { PRODUCT, CONTACT_EMAIL } from '@/lib/legal';

const LINKS = [
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
];

export default function SiteFooter() {
  return (
    <footer className="border-t px-6 py-10" style={{ borderColor: 'var(--border-light)' }}>
      {/* Left-aligned, matching the rest of the page. A centred link row under
          a page that reads left the whole way down is the one place the
          symmetry came back. */}
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6">
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-7 gap-y-3">
          {LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="rounded text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
              style={{ color: 'var(--text-secondary)', outlineColor: 'var(--brand-navy-900)' }}
            >
              {label}
            </Link>
          ))}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="rounded text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ color: 'var(--text-secondary)', outlineColor: 'var(--brand-navy-900)' }}
          >
            {CONTACT_EMAIL}
          </a>
        </nav>

        {/* No compass mark here: that asset is 267×35, so forcing it to 14px square
            rendered a 14px-wide sliver that read as a stray dash. */}
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          © {new Date().getFullYear()} {PRODUCT}. Write your unscripted path.
        </p>

        <p className="max-w-2xl text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {PRODUCT} is an independent product. It is not affiliated with, endorsed by, or
          sponsored by any university, and it does not provide career, academic, financial,
          legal or medical advice.
        </p>
      </div>
    </footer>
  );
}
