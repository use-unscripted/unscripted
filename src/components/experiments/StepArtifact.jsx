import { useState } from 'react';
import { Copy, Check, Mail, ListChecks, Search, FileText, MessageSquare } from 'lucide-react';
import { fillProfileTokens } from './guideSchema';

// Split needs /g; the test must NOT be global, so lastIndex can't leak between calls.
const TOKEN_SPLIT_RE = /(\[[A-Z0-9_]{2,60}\])/g;
const IS_TOKEN_RE = /^\[[A-Z0-9_]{2,60}\]$/;

const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

const KIND_META = {
  email: { icon: Mail, label: 'Ready to send' },
  message: { icon: MessageSquare, label: 'Ready to send' },
  question_list: { icon: ListChecks, label: 'Ready to use' },
  outline: { icon: FileText, label: 'Ready to fill in' },
  checklist: { icon: ListChecks, label: 'Ready to use' },
  search_query: { icon: Search, label: 'Ready to paste' },
};

const WRITTEN_KINDS = ['email', 'message'];
const NUMBERED_KINDS = ['question_list', 'checklist', 'outline'];

/** Marks remaining [TOKENS]. Underlined as well as tinted — never colour alone. */
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

function CopyButton({ getText, label }) {
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
      aria-label={copied ? 'Copied to clipboard' : label}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition"
      style={{
        borderColor: copied ? '#BBF7D0' : '#E2E8F0',
        background: copied ? '#F0FDF4' : '#fff',
        color: copied ? '#15803D' : '#334155',
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/**
 * A finished artifact the student edits — the actual email, the actual questions.
 *
 * Two rules keep this honest:
 *   - the instruction line is never part of what Copy puts on the clipboard
 *   - anything the profile already answers is substituted, not left as a blank
 */
export default function StepArtifact({ artifact: raw, profile }) {
  if (!raw || raw.kind === 'none') return null;

  const artifact = fillProfileTokens(raw, profile);
  const { kind, subject, body, items = [], blanks = [], prefilled = [] } = artifact;

  const meta = KIND_META[kind] || { icon: FileText, label: 'Ready to use' };
  const Icon = meta.icon;
  const isWritten = WRITTEN_KINDS.includes(kind);
  const isQuery = kind === 'search_query';
  const numbered = NUMBERED_KINDS.includes(kind);

  // For anything but an email, `body` is guidance about the payload — shown
  // above the paste zone, and deliberately excluded from the clipboard.
  const instruction = isWritten ? '' : body;
  const payload = isWritten
    ? [subject ? `Subject: ${subject}` : '', body || ''].filter(Boolean).join('\n\n')
    : items.join('\n');

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
          <Icon size={12} /> {meta.label}
        </span>
        <CopyButton getText={() => payload} label={`Copy the ${isWritten ? 'message' : 'text to paste'}`} />
      </div>

      {instruction && (
        <p className="border-b border-[#F1F5F9] px-3 py-2 text-xs leading-relaxed text-[#64748B]">
          <WithBlanks text={instruction} />
        </p>
      )}

      <div className="px-3 py-3">
        {isWritten && subject && (
          <p className="mb-3 border-b border-dashed border-[#E2E8F0] pb-2 text-sm text-[#050816]">
            <span className="text-[#94A3B8]">Subject: </span>
            <span className="font-semibold"><WithBlanks text={subject} /></span>
          </p>
        )}

        {isWritten && body && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#334155]">
            <WithBlanks text={body} />
          </p>
        )}

        {items.length > 0 && (
          isQuery ? (
            <div className="space-y-2">
              {items.map((item, i) => (
                <p
                  key={i}
                  className="overflow-x-auto whitespace-pre rounded-lg px-3 py-2 text-xs leading-relaxed"
                  style={{ fontFamily: MONO, background: '#F8FAFC', border: '1px solid #EEF2F6', color: '#334155' }}
                >
                  <WithBlanks text={item} />
                </p>
              ))}
            </div>
          ) : (
            <ol className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-[#334155]">
                  <span className="shrink-0 pt-0.5 text-xs font-bold tabular-nums text-[#94A3B8]">
                    {numbered ? `${i + 1}.` : '·'}
                  </span>
                  <span><WithBlanks text={item} /></span>
                </li>
              ))}
            </ol>
          )
        )}
      </div>

      {(blanks.length > 0 || prefilled.length > 0) && (
        <div className="border-t border-[#E2E8F0] bg-[#FCFBF7] px-3 py-2.5">
          {blanks.length > 0 && (
            <>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
                You fill in ({blanks.length})
              </p>
              <ul className="space-y-1">
                {blanks.map((blank, i) => (
                  <li key={i} className="text-xs text-[#64748B]">
                    <code className="font-semibold" style={{ fontFamily: MONO, color: '#7A5B12' }}>
                      {blank.token}
                    </code>
                    {blank.hint ? ` — ${blank.hint}` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
          {prefilled.length > 0 && (
            <p className={`text-[11px] text-[#94A3B8] ${blanks.length > 0 ? 'mt-2' : ''}`}>
              {prefilled.length} filled in from your profile
            </p>
          )}
        </div>
      )}
    </div>
  );
}
