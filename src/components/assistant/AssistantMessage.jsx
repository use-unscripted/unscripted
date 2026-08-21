import ReactMarkdown from 'react-markdown';

/**
 * One turn in the guide conversation. The student's own words are set plainly;
 * the guide answers in markdown because its replies carry short lists.
 */
export default function AssistantMessage({ message }) {
  const isUser = message.role === 'user';
  if (!message.content) return null;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <p
          className="tp-body max-w-[85%] rounded-[var(--r-control)] px-3.5 py-2.5 text-white"
          style={{ background: 'var(--brand-navy-900)' }}
        >
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className="tp-body max-w-[92%] rounded-[var(--r-control)] px-3.5 py-2.5"
        style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
            li: ({ children }) => <li className="mb-1">{children}</li>,
            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}