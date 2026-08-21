import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Send } from 'lucide-react';
import AssistantMessage from '@/components/assistant/AssistantMessage';

const STARTERS = [
  'What should I do next?',
  'Why do I need to add evidence?',
  'What is the Conviction Lab for?',
];

/**
 * The guide conversation. One conversation per session, created lazily on the
 * first question so opening the panel costs nothing.
 */
export default function AssistantPanel({ onClose }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return () => unsubscribe();
  }, [conversation?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, sending]);

  const send = async (text) => {
    const content = String(text || '').trim();
    if (!content || sending) return;
    setDraft('');
    setSending(true);
    let convo = conversation;
    if (!convo) {
      convo = await base44.agents.createConversation({
        agent_name: 'unscripted_guide',
        metadata: { name: 'Guide', description: 'In-app guidance' },
      });
      setConversation(convo);
    }
    setMessages(prev => [...prev, { role: 'user', content }]);
    await base44.agents.addMessage(convo, { role: 'user', content });
    setSending(false);
  };

  const waiting = sending || (messages.length > 0 && messages[messages.length - 1]?.role === 'user');

  return (
    <div
      className="anim-slide-up flex flex-col overflow-hidden rounded-[var(--r-surface)] bg-white sm:anim-scale-in"
      style={{ border: '1px solid var(--border-light)', boxShadow: 'var(--elev-card)', height: 'min(560px, 70svh)' }}
    >
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--brand-navy-900)' }}
      >
        <div>
          <p className="tp-control font-bold text-white">Ask the guide</p>
          <p className="tp-meta text-[color:var(--ink-300)]">Questions about your journey, answered from your own records.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the guide"
          className="touch-target-square grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-control)] text-white hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <>
            <AssistantMessage message={{ role: 'assistant', content: 'Ask me anything about where you are or what to do next. I can only see your own records.' }} />
            <div className="flex flex-wrap gap-2 pt-1">
              {STARTERS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="tp-meta rounded-full border px-3 py-2 font-semibold"
                  style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        {messages.map((m, i) => <AssistantMessage key={i} message={m} />)}
        {waiting && (
          <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>Thinking…</p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(draft); }}
        className="flex items-end gap-2 border-t p-3"
        style={{ borderColor: 'var(--border-light)' }}
      >
        <textarea
          rows={1}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); } }}
          placeholder="Ask a question…"
          className="max-h-28 flex-1 resize-none rounded-[var(--r-control)] border px-3 py-2.5 text-base outline-none md:text-sm"
          style={{ borderColor: 'var(--border-light)' }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send"
          className="ui-press grid shrink-0 place-items-center rounded-[var(--r-control)] text-white disabled:opacity-40"
          style={{ background: 'var(--brand-navy-900)', width: 44, height: 44 }}
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}