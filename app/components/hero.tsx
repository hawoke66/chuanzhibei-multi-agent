'use client';

import { ArrowRight } from '@phosphor-icons/react';
import type { AgentId } from '../copy';
import { Glyph, RiseText, StarDot, type StarState } from './ui';

/* 首屏：左边一句话定位 + 两个动作，右边协作链路星座图。
   链路图是产品的真实结构（调度拆活、三位专家并行、汇总成稿要过质检），不是装饰插画。
   节点用与专家区同一套四角星状态点：调度已完成、调研进行中、另外两位与质检等待中。
   动效：每条连线跑一条一次性电流，节点按 调度 → 三位专家 → 质检 的顺序依次点亮。 */

const VIEW_W = 800;
const VIEW_H = 500;

interface DiagramNode {
  id: AgentId;
  x: number;
  y: number;
  state: StarState;
  size: 14 | 16 | 20;
  delay: number;
}

const NODES: DiagramNode[] = [
  { id: 'dispatcher', x: 400, y: 66, state: 'done', size: 20, delay: 180 },
  { id: 'research', x: 132, y: 252, state: 'running', size: 16, delay: 900 },
  { id: 'writer', x: 400, y: 252, state: 'waiting', size: 16, delay: 960 },
  { id: 'coder', x: 668, y: 252, state: 'waiting', size: 16, delay: 1020 },
  { id: 'qc', x: 400, y: 432, state: 'waiting', size: 20, delay: 1700 },
];

const EDGES: { from: number; to: number; pending: boolean; delay: number }[] = [
  { from: 0, to: 1, pending: false, delay: 420 },
  { from: 0, to: 2, pending: false, delay: 500 },
  { from: 0, to: 3, pending: false, delay: 580 },
  { from: 1, to: 4, pending: true, delay: 1220 },
  { from: 2, to: 4, pending: true, delay: 1290 },
  { from: 3, to: 4, pending: true, delay: 1360 },
];

/** 连线两端各留一段空隙，避免压住星点与名字。 */
function edgePoints(a: DiagramNode, b: DiagramNode, gap: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return {
    x1: a.x + ux * gap,
    y1: a.y + uy * gap,
    x2: b.x - ux * gap,
    y2: b.y - uy * gap,
  };
}

function CoordinationMap({
  t,
  agentLabel,
}: {
  t: (key: string) => string;
  agentLabel: (id: AgentId) => string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
        <p className="caption-4 text-ink-2">{t('heroMapTitle')}</p>
        <p className="caption-4 text-ink-2 tabular-nums">{t('heroMapMeta')}</p>
      </div>

      <div
        className="relative mt-6 aspect-[2/1] w-full"
        role="img"
        aria-label={`${t('heroMapTitle')}，${t('heroMapMeta')}`}
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          {EDGES.map((edge) => {
            // 六条连线同粗细、同不透明度；标签在节点侧边，两条斜线不会再穿过文字
            const point = edgePoints(NODES[edge.from], NODES[edge.to], edge.pending ? 28 : 30);
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <line
                  x1={point.x1}
                  y1={point.y1}
                  x2={point.x2}
                  y2={point.y2}
                  stroke="currentColor"
                  strokeOpacity={0.46}
                  strokeWidth={1.4}
                  className="text-ink-2"
                />
                <line
                  x1={point.x1}
                  y1={point.y1}
                  x2={point.x2}
                  y2={point.y2}
                  pathLength={100}
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  style={{ animationDelay: `${edge.delay}ms` }}
                  className="edge-current text-accent"
                />
              </g>
            );
          })}

          {[
            [70, 46],
            [736, 92],
            [58, 388],
            [742, 404],
            [252, 60],
            [552, 452],
          ].map(([cx, cy], index) => (
            <circle
              key={`faint-${index}`}
              cx={cx}
              cy={cy}
              r={index % 2 === 0 ? 1.6 : 2.2}
              className="fill-ink-3"
              opacity="0.4"
            />
          ))}
        </svg>

        {NODES.map((node) => (
          <div
            key={node.id}
            className="absolute"
            style={{ left: `${(node.x / VIEW_W) * 100}%`, top: `${(node.y / VIEW_H) * 100}%` }}
          >
            <div className="-translate-x-1/2 -translate-y-1/2">
              <span className="node-in" style={{ animationDelay: `${node.delay}ms` }}>
                <StarDot state={node.state} size={node.size} />
              </span>
            </div>
            <p
              className={`hero-node-label absolute left-0 top-1/2 hidden -translate-y-1/2 whitespace-nowrap caption-4 text-ink-2 sm:block ${
                node.id === 'dispatcher' || node.id === 'research'
                  ? '-ml-10 -translate-x-full text-right'
                  : 'ml-10 text-left'
              }`}
            >
              <span className="node-in" style={{ animationDelay: `${node.delay + 120}ms` }}>
                {agentLabel(node.id)}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
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
    <section className="relative mb-8 flex min-h-dvh w-full flex-col justify-center px-6 py-12 lg:mb-0 lg:block lg:min-h-0 lg:px-8 lg:pb-24 lg:pt-24">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-6">
          <p className="caption-4 text-ink-3">{t('heroKicker')}</p>
          <h1 className="rise-run mt-6 max-w-[680px] text-pretty text-ink heading-4 sm:heading-3 lg:heading-2">
            <RiseText text={t('heroTitleLine1')} start={80} step={40} />
            <br />
            <RiseText text={t('heroTitleLine2')} start={220} step={30} />
          </h1>
          <p className="body-3 mt-6 max-w-[560px] text-pretty leading-7 text-ink-2">{t('heroSub')}</p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onStart}
              className="sheen button-md inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-4 py-2 text-void transition-[background-color,transform] duration-300 ease-out-soft hover:bg-white active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t('heroCtaPrimary')}
              <Glyph as={ArrowRight} size={16} />
            </button>
            <a
              href="#flow"
              className="button-md whitespace-nowrap rounded-lg px-2 py-2 text-ink-2 underline-offset-4 transition-colors duration-300 ease-out-soft hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t('heroCtaSecondary')}
            </a>
          </div>

          <p className="caption-5 mt-6 font-mono text-ink-3">{t('heroCaption')}</p>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <CoordinationMap t={t} agentLabel={agentLabel} />
        </div>
      </div>
    </section>
  );
}
