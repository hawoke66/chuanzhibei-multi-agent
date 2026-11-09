'use client';

import { ArrowRight } from '@phosphor-icons/react';
import type { AgentId } from '../copy';
import { Glyph, StarDot } from './ui';

/* 首屏：左边一句话定位 + 两个动作，右边协作链路图。
   链路图是产品的真实结构（调度拆活、三位专家并行、汇总结稿要过质检），不是装饰插画。 */

const NODES: { id: AgentId; x: number; y: number; r: number }[] = [
  { id: 'dispatcher', x: 200, y: 46, r: 5.5 },
  { id: 'research', x: 74, y: 152, r: 4 },
  { id: 'writer', x: 200, y: 152, r: 4 },
  { id: 'coder', x: 326, y: 152, r: 4 },
  { id: 'qc', x: 200, y: 258, r: 5 },
];

const LINKS: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 4],
  [2, 4],
  [3, 4],
];

function CoordinationMap({ t, agentLabel }: { t: (key: string) => string; agentLabel: (id: AgentId) => string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <p className="caption-4 text-ink-3">{t('heroMapTitle')}</p>
        <p className="caption-5 font-mono text-ink-3 tabular-nums">{t('heroMapMeta')}</p>
      </div>
      <svg viewBox="0 0 400 300" className="mt-4 w-full" role="img" aria-label={t('heroMapTitle')}>
        {LINKS.map(([from, to]) => (
          <line
            key={`${from}-${to}`}
            x1={NODES[from].x}
            y1={NODES[from].y}
            x2={NODES[to].x}
            y2={NODES[to].y}
            stroke="currentColor"
            className="text-line-2"
            strokeWidth="1"
          />
        ))}

        {[
          [36, 26],
          [372, 74],
          [22, 214],
          [382, 208],
          [128, 40],
          [286, 274],
        ].map(([cx, cy], index) => (
          <circle key={`faint-${index}`} cx={cx} cy={cy} r={index % 2 === 0 ? 1 : 1.4} className="fill-ink-3" opacity="0.45" />
        ))}

        {NODES.map((node, index) => (
          <g key={node.id}>
            {index === 0 || index === 4 ? (
              <StarDotPath x={node.x} y={node.y} radius={node.r} />
            ) : (
              <circle cx={node.x} cy={node.y} r={node.r} className="fill-ink-2" />
            )}
            <text
              x={node.x}
              y={node.y + (index === 4 ? 24 : -14)}
              textAnchor="middle"
              className="fill-ink-2"
              fontSize="12"
            >
              {agentLabel(node.id)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function StarDotPath({ x, y, radius }: { x: number; y: number; radius: number }) {
  const points = [0, 1, 2, 3, 4, 5, 6, 7].map((step) => {
    const angle = (step / 8) * Math.PI * 2 - Math.PI / 2;
    const reach = step % 2 === 0 ? radius * 2.1 : radius * 0.75;
    return `${(x + Math.cos(angle) * reach).toFixed(2)},${(y + Math.sin(angle) * reach).toFixed(2)}`;
  });
  return <polygon points={points.join(' ')} className="fill-ink" />;
}

export default function Hero({
  t,
  agentLabel,
  onStart,
}: {
  t: (key: string) => string;
  agentLabel: (id: AgentId) => string;
  onStart: () => void;
}) {
  return (
    <section className="relative mx-auto flex min-h-dvh w-full max-w-7xl items-center px-6 pb-28 pt-32 lg:px-8">
      <div className="grid w-full grid-cols-1 items-center gap-16 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-6">
          <p className="caption-4 flex items-center gap-2 text-ink-3">
            <StarDot state="done" size={10} />
            {t('heroKicker')}
          </p>
          <h1 className="mt-6 max-w-[680px] text-pretty text-ink heading-4 sm:heading-3 lg:heading-2">
            {t('heroTitleLine1')}
            <br />
            {t('heroTitleLine2')}
          </h1>
          <p className="body-3 mt-6 max-w-[560px] text-pretty text-ink-2">{t('heroSub')}</p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onStart}
              className="button-md inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-void transition-[background-color,transform] duration-300 ease-out-soft hover:bg-white active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t('heroCtaPrimary')}
              <Glyph as={ArrowRight} size={16} />
            </button>
            <a
              href="#flow"
              className="button-md rounded-lg px-2 py-2 text-ink-2 underline-offset-4 transition-colors duration-300 ease-out-soft hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t('heroCtaSecondary')}
            </a>
          </div>

          <p className="caption-5 mt-8 font-mono text-ink-3">{t('heroCaption')}</p>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <CoordinationMap t={t} agentLabel={agentLabel} />
        </div>
      </div>
    </section>
  );
}
