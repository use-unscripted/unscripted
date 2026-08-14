/**
 * The invitation to the short uncertainty update, for a student who onboarded
 * before the intake asked about it.
 *
 * Silent for anyone who already has a clarity baseline, and it is an
 * invitation rather than a gate: nothing on My Journey is blocked by it, and
 * nothing about their existing paths changes if they ignore it.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, HelpCircle } from 'lucide-react';

export default function UncertaintyUpdateCard({ profile }) {
  if (!profile || profile.baseline_career_clarity) return null;

  return (
    <div className="app-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <HelpCircle size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-navy-700)' }} />
        <div className="min-w-0 flex-1">
          <p className="tp-card" style={{ color: 'var(--text-primary)' }}>
            Help us understand what you are still figuring out
          </p>
          <p className="tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>
            Four short questions. Your original answers and your paths stay exactly as they are, and your
            next experiments get chosen from what is actually still open.
          </p>
          <Link
            to="/uncertainty-update"
            className="tp-body mt-4 inline-flex items-center gap-2 rounded-[var(--r-control)] px-5 font-bold text-white"
            style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
          >
            Answer them <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}