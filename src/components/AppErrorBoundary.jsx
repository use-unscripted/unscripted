import { Component } from 'react';
import { RefreshCw, ArrowLeft } from 'lucide-react';

/**
 * The last thing standing between a render error and a blank white page.
 *
 * Until this existed the app had exactly one error boundary, around the proof
 * cards, so a single bad value anywhere else unmounted the entire tree: the
 * student got a white screen with no navigation, no message and nothing to
 * click. That is the worst failure the product can produce, and it was reachable
 * from any list that a model had filled in.
 *
 * The AI call sites are validated now, but this is the net that does not depend
 * on having thought of the failure in advance. It is deliberately plain: no
 * data loading, no hooks, nothing that can itself throw.
 */
export default class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Shape only. A render error message can quote the value that broke it, and
    // that value is often the student's own text.
    console.error(`[app] render error (${error?.name || 'Error'})`);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="grid min-h-[100svh] place-items-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="font-heading text-2xl font-bold text-[color:var(--surface-dark-900)]">
            This page could not be displayed.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--ink-500)]">
            Nothing you saved has been lost. Reloading usually clears it.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 rounded-[var(--r-control)] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-px"
              style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}
            >
              <RefreshCw size={15} /> Reload the page
            </button>
            <a
              href="/journey"
              className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink-500)] transition hover:text-[color:var(--surface-dark-900)]"
            >
              <ArrowLeft size={14} /> Back to My Journey
            </a>
          </div>
        </div>
      </main>
    );
  }
}
