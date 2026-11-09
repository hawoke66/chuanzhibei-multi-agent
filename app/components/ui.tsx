'use client';

import { Fragment, useLayoutEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { IconProps } from '@phosphor-icons/react';

/* ============================================================
   全站基础件
   1. 图标：一套 Phosphor，一种字重，两个尺寸（16 / 18）
   2. 四角星状态点：全站唯一签名细节（进行中带一圈微光）
   3. 滚动翻页：区块绕顶边小角度翻折 + 缩放 + 淡入，进度跟着滚动走
   4. 标题逐字／逐词升起
   5. 词级大字标语
   6. 开关：插件启停
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
        <>
          <circle cx="8" cy="8" r="7.2" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.8" />
          <circle
            className="star-live"
            cx="8"
            cy="8"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.45"
            strokeWidth="0.9"
          />
        </>
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

/* ---------------- 滚动翻页 ---------------- */

type Flip = { el: HTMLElement; delay: number };

const flips = new Set<Flip>();
let frame = 0;
let bound = false;

function onScroll() {
  if (frame) return;
  frame = requestAnimationFrame(tick);
}

/** 翻页角度：桌面 12 度、窄屏减半；滚到视口 55% 高度处翻完，播完即摘掉监听。 */
function tick() {
  frame = 0;
  const viewport = window.innerHeight;
  const span = Math.max(240, viewport * 0.55);
  const angle = window.innerWidth < 768 ? 6 : 12;

  for (const flip of Array.from(flips)) {
    const rect = flip.el.getBoundingClientRect();
    const offset = flip.delay * 0.35;
    const progress = Math.min(1, Math.max(0, (viewport - rect.top - offset) / span));
    flip.el.style.setProperty('--reveal-p', progress.toFixed(3));
    flip.el.style.setProperty('--reveal-angle', `${(angle * (1 - progress)).toFixed(2)}deg`);
    if (progress >= 1) {
      flips.delete(flip);
      flip.el.dataset.settled = 'true';
    }
  }

  if (flips.size === 0) stopListening();
}

function startListening() {
  if (bound) return;
  bound = true;
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
}

function stopListening() {
  if (!bound) return;
  bound = false;
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onScroll);
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
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

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.dataset.settled = 'true';
      return;
    }
    element.style.setProperty('--reveal-p', '0');
    const flip: Flip = { el: element, delay };
    flips.add(flip);
    startListening();
    onScroll();
    return () => {
      flips.delete(flip);
      if (flips.size === 0) stopListening();
    };
  }, [delay]);

  return (
    <div ref={ref} id={id} className={`reveal-flip ${className}`}>
      {children}
    </div>
  );
}

/* ---------------- 标题逐字 / 逐词 ---------------- */

function splitRise(text: string): { words: string[]; spaced: boolean } {
  if (/\s/.test(text)) {
    return { words: text.split(/\s+/).filter(Boolean), spaced: true };
  }
  return { words: Array.from(text), spaced: false };
}

export function RiseText({
  text,
  start = 0,
  step = 34,
  className = '',
}: {
  text: string;
  start?: number;
  step?: number;
  className?: string;
}) {
  const { words, spaced } = splitRise(text);
  return (
    <span className={className}>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span className="rise-word" style={{ animationDelay: `${start + index * step}ms` }}>
            {word}
          </span>
          {spaced && index < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </span>
  );
}

/* ---------------- 大字标语 ---------------- */

export function WordReveal({ words, className = '' }: { words: string[]; className?: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [lit, setLit] = useState<boolean[]>(() => words.map(() => false));

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const spans = Array.from(element.querySelectorAll<HTMLElement>('[data-word]'));
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
      { rootMargin: '-22% 0px -28% 0px', threshold: 0 },
    );
    spans.forEach((span) => observer.observe(span));
    return () => observer.disconnect();
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
