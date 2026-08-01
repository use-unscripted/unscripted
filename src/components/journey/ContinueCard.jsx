import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';

/**
 * The most prominent card on My Journey. It always points at the exact next
 * unfinished action for the current stage — never a menu of options.
 */
export default function ContinueCard({ action, pathName, onAnchorClick }) {
  const body = (
    <>
      <span className="text-base sm:text-lg">{action.label}</span>
      <ArrowRight size={18} className="shrink-0" />
    </>
  );
  const btnCls =
    'ui-press flex w-full items-center justify-center gap-2 rounded-[10px] px-6 py-4 font-heading font-bold text-white sm:w-auto sm:min-w-[280px]';
  const btnStyle = { background: 'var(--brand-navy-900)', boxShadow: '0 10px 30px rgba(31,58,95,0.30)', minHeight: '52px' };

  return (
    <section
      className="rounded-[20px] p-6 text-white sm:p-8"
      style={{
        background: 'linear-gradient(135deg, var(--brand-navy-900) 0%, var(--brand-navy-700) 100%)',
        border: '1px solid rgba(39,76,119,0.4)',
      }}
    >
      <div className="flex items-center gap-2">
        <Play size={13} style={{ color: 'var(--brand-gold-500)' }} />
        <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: 'var(--brand-gold-500)' }}>
          Continue where you left off
        </p>
      </div>

      {pathName && <h2 className="font-heading mt-3 text-2xl font-bold text-white sm:text-3xl">{pathName}</h2>}
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{action.sub}</p>

      <div className="mt-6 rounded-[14px] bg-white p-4 sm:inline-block sm:p-2">
        {action.to ? (
          <Link to={action.to} className={btnCls} style={btnStyle}>{body}</Link>
        ) : (
          <button type="button" onClick={onAnchorClick} className={btnCls} style={btnStyle}>{body}</button>
        )}
      </div>
    </section>
  );
}