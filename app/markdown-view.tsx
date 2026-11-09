'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

/* 最终成果的 Markdown 渲染：代码块自带复制，样式全部走观测舱色板。 */

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
    <div className="my-4 overflow-hidden rounded-lg bg-void">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="caption-5 font-mono text-ink-3">{language || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="caption-5 rounded px-2 py-0.5 text-ink-3 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre className="body-6 overflow-x-auto p-4 text-ink-2">
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
            return <code className="rounded bg-raised px-1 py-0.5 text-ink">{children}</code>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
