'use client';

import type { ComponentType, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { IconProps } from '@phosphor-icons/react';

/* ============================================================
   全站基础件
   1. 图标：一套 Phosphor，一种字重，两个尺寸（16 / 18）
   2. 四角星状态点：全站唯一签名细节
   3. 滚动显现：上浮 32px + 淡入，只播一次
   4. 词级大字标语：逐行从淡色过渡到全色
   5. 开关：插件启停
   ============================================================ */

export type GlyphComponent = ComponentType<IconProps>;

export function Glyph({
  as: Component,
  size = 18,
  className,
}: {
  as: GlyphComponent;
  size?: 16 | 18;
  className?: string;
}) {
  return <Component size={size} weight="regular" className={className} aria-hidden="true" />;
}

export type StarState = 'waiting' | 'running' | 'done' | 'failed' | 'inactive';

const STAR_TONE: Record<StarState, string> = {
  waiting: 'text-ink-3',
  running: 'text-accent',
  done: 'text-ink',
  failed: 'text-danger',
  inactive: 'text-ink-3 opacity-35',
};

export function StarDot({
  state,
  size = 12,
  className = '',
}: {
  state: StarState;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      className={`${STAR_TONE[state]} shrink-0 ${className}`}
    >
      {state === 'running' && (
        <circle cx="8" cy="8" r="7.2" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.8" />
      )}
      <path
        d="M8 0.7 9.5 6.5 15.3 8 9.5 9.5 8 15.3 6.5 9.5 0.7 8 6.5 6.5Z"
        fill={state === 'waiting' || state === 'inactive' ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={state === 'waiting' ? 0.9 : 0.5}
      />
    </svg>
  );
}

/* 兜底扫描：平滑滚动或锚点跳转会一次跨过整段内容，IntersectionObserver
   可能既不报告进入也不报告离开；这里用一条 rAF 节流的滚动监听把已越过的
   区块补亮，全部播完就自动摘掉监听。 */
type Watcher = { element: HTMLElement; show: () => void };

const watchers = new Set<Watcher>();
let frame = 0;
let listening = false;

function startListening() {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize);
}

function stopListening() {
  if (!listening) return;
  listening = false;
  window.removeEventListener('scroll', onScrollOrResize);
  window.removeEventListener('resize', onScrollOrResize);
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

function onScrollOrResize() {
  if (frame) return;
  frame = requestAnimationFrame(sweep);
}

function sweep() {
  frame = 0;
  const limit = window.innerHeight * 0.95;
  for (const watcher of Array.from(watchers)) {
    if (watcher.element.getBoundingClientRect().top < limit) {
      watchers.delete(watcher);
      watcher.show();
    }
  }
  if (watchers.size === 0) stopListening();
}

function watchReveal(element: HTMLElement, show: () => void): () => void {
  const watcher: Watcher = { element, show };
  watchers.add(watcher);
  startListening();
  onScrollOrResize();
  return () => {
    watchers.delete(watcher);
    if (watchers.size === 0) stopListening();
  };
}

export function Reveal({
  children,
  className = '',
  delay = 0,
  id,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setShown(true);
      observer.disconnect();
      unwatch();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) reveal();
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.01 },
    );
    observer.observe(element);
    const unwatch = watchReveal(element, reveal);
    return () => {
      observer.disconnect();
      unwatch();
    };
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      className={`reveal ${className}`}
      data-shown={shown ? 'true' : 'false'}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export function WordReveal({ words, className = '' }: { words: string[]; className?: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [lit, setLit] = useState<boolean[]>(() => words.map(() => false));

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const crossed = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => Number((entry.target as HTMLElement).dataset.word));
        if (crossed.length === 0) return;
        setLit((previous) => {
          let changed = false;
          const next = [...previous];
          for (const index of crossed) {
            if (!next[index]) {
              next[index] = true;
              changed = true;
            }
          }
          return changed ? next : previous;
        });
      },
      { rootMargin: '-25% 0px -30% 0px', threshold: 0 },
    );
    const spans = Array.from(element.querySelectorAll<HTMLElement>('[data-word]'));
    spans.forEach((span) => observer.observe(span));
    // 兜底：整段已经进入视口就一次点亮，避免锚点跳转后停在淡色
    const unwatch = watchReveal(element, () => setLit(words.map(() => true)));
    return () => {
      observer.disconnect();
      unwatch();
    };
  }, [words]);

  return (
    <p ref={ref} className={className}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="word block"
          data-word={index}
          data-lit={lit[index] ? 'true' : 'false'}
        >
          {word}
        </span>
      ))}
    </p>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-300 ease-out-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        checked ? 'border-accent/45 bg-accent/20' : 'border-line-2 bg-raised'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full transition-[transform,background-color] duration-300 ease-out-soft ${
          checked ? 'translate-x-6 bg-accent' : 'translate-x-1 bg-ink-3'
        }`}
      />
    </button>
  );
}
