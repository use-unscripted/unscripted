/**
 * The way into the work simulation from My Journey.
 *
 * The card prints `entry_note` from the content module, which is the sentence
 * saying this is one kind of work and not a verdict on the path the student
 * chose. That has to be here, before they press anything. A student who spends
 * 30 minutes believing the result decides their path has been misled by the
 * time they read anything at the other end, and read-out copy cannot undo it.
 *
 * One card, one button, no second call to action. This page has been a menu
 * before and that is what made it one.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { NORTHGATE_PM } from '@/lib/work-sims/northgate-pm';

export default function SimEntryCard({ sim = NORTHGATE_PM }) {
  return (
    <section className="app-card p-6 sm:p-8">
      <p className="tp-eyebrow font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-navy-700)' }}>
        Work simulation
      </p>
      <h2 className="tp-section mt-2" style={{ color: 'var(--text-primary)' }}>
        {sim.estimated_minutes} minutes as a {sim.career_name.toLowerCase()}
      </h2>
      <p className="tp-body mt-3" style={{ color: 'var(--text-secondary)', maxWidth: '58ch' }}>
        {sim.entry_note}
      </p>
      <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
        {sim.steps.length} steps. Nothing is timed on screen.
      </p>
      <Link to="/simulation" className="ui-press app-cta tp-control mt-6" style={{ minHeight: '48px' }}>
        Start the simulation <ArrowRight size={16} />
      </Link>
    </section>
  );
}
