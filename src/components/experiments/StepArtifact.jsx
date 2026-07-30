import { useState } from 'react';
import { Copy, Check, Mail, ListChecks, Search, FileText, MessageSquare } from 'lucide-react';

// Split needs /g; the test must NOT be global — a stateful lastIndex would make
// .test() alternate true/false across calls and drop every other token.
const TOKEN_SPLIT_RE = /(\[[A-Z0-9_]{2,60}\])/g;
const IS_TOKEN_RE = /^\[[A-Z0-9_]{2,60}\]$/;

const KIND_META = {
  email: { icon: Mail, label: 'Ready to send' },
  message: { icon: MessageSquare, label: 'Ready to send' },
  question_list: { icon: ListChecks, label: 'Ready to use' },
  outline: { icon: FileText, label: 'Ready to fill in' },
  checklist: { icon: ListChecks, label: 'Ready to use' },
  search_query: { icon: Search, label: 'Ready to paste' },
};

/** Renders text with [TOKENS] visually marked. Never colour-only — tokens are
 *  underlined and announced, so they read as blanks without relying on the gold. */
function WithBlanks({ text }) {
  if (typeof text !== 'string') return null;
  return text.split(TOKEN_SPLIT_RE).map((part, i) =>
    IS_TOKEN_RE.test(part) ? (
      <mark
        key={i}
        title="You fill this in"
        className="rounded px-1 font-semibold underline decoration-dotted underline-offset-2"
        style={{ background: 'rgba(214,182,106,0.22)', color: '#7A5B12' }}
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function CopyButton({ getText }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the text is on screen and selectable anyway */
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
      className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#334155] transition hover:bg-[#F8FAFC]"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/**
 * A finished artifact the student edits — the actual email, the actual questions.
 * Anything less than this and the guide is just a to-do list again.
 */
export default function StepArtifact({ artifact }) {
  if (!artifact || artifact.kind === 'none') return null;

  const { kind, subject, body, items = [], blanks = [] } = artifact;
  const meta = KIND_META[kind] || { icon: FileText, label: 'Ready to use' };
  const Icon = meta.icon;
  const isEmail = kind === 'email' || kind === 'message';
  const isMono = kind === 'search_query';

  const plainText = () =>
    [
      isEmail && subject ? `Subject: ${subject}` : '',
      body || '',
      ...items.map(item => (kind === 'question_list' ? `- ${item}` : item)),
    ]
      .filter(Boolean)
      .join('\n\n');

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
          <Icon size={12} /> {meta.label}
        </span>
        <CopyButton getText={plainText} />
      </div>

      <div className="px-3 py-3">
        {isEmail && subject && (
          <p className="mb-2 border-b border-dashed border-[#E2E8F0] pb-2 text-sm text-[#050816]">
            <span className="text-[#94A3B8]">Subject: </span>
            <span className="font-semibold"><WithBlanks text={subject} /></span>
          </p>
        )}

        {body && (
          <p
            className={`whitespace-pre-wrap text-sm leading-relaxed text-[#334155] ${isMono ? 'font-mono text-xs' : ''}`}
          >
            <WithBlanks text={body} />
          </p>
        )}

        {items.length > 0 && (
          <ol className={`${body ? 'mt-3' : ''} space-y-1.5`}>
            {items.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-[#334155]">
                <span className="shrink-0 text-xs font-bold text-[#94A3B8] pt-0.5">{i + 1}.</span>
                <span className={isMono ? 'font-mono text-xs break-all' : ''}>
                  <WithBlanks text={item} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {blanks.length > 0 && (
        <div className="border-t border-[#E2E8F0] bg-[#FCFBF7] px-3 py-2.5">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
            You fill in ({blanks.length})
          </p>
          <ul className="space-y-1">
            {blanks.map((blank, i) => (
              <li key={i} className="text-xs text-[#64748B]">
                <code className="font-semibold" style={{ color: '#7A5B12' }}>{blank.token}</code>
                {blank.hint ? ` — ${blank.hint}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
