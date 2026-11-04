'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

function CodeBlock({
  code,
  language,
  copyLabel,
  copiedLabel,
}: {
  code: string;
  language?: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默失败，不影响阅读
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-xs text-indigo-200/80">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-indigo-100 transition hover:bg-white/20"
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-sm leading-relaxed text-indigo-50">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function MarkdownView({
  text,
  copyLabel,
  copiedLabel,
}: {
  text: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  return (
    <div className="md-view">
      <ReactMarkdown
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const raw = String(children ?? '');
            const match = /language-([\w-]+)/.exec(className || '');
            if (match || raw.includes('\n')) {
              return (
                <CodeBlock
                  code={raw.replace(/\n$/, '')}
                  language={match?.[1]}
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                />
              );
            }
            return <code className="rounded bg-white/10 px-1 py-0.5 text-[0.9em] text-violet-200">{children}</code>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
