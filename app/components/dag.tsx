'use client';

import { Star } from '@phosphor-icons/react';
import type { AgentId, AgentStatus } from '../copy';
import { AGENT_IDS } from '../copy';
import { StarDot } from './ui';

/* 第二章的协作图：把七个角色摆成北斗七星。
   斗身：天枢—调度官、天璇—调研员、天玑—文案官、天权—代码手；
   斗柄：玉衡—汇总官、开阳—质检官、摇光—修订官。
   走过的连线是流动光束，没走的是暗线；节点是发光星形。 */

const VIEW_W = 900;
const VIEW_H = 560;

const NODES: { id: AgentId; star: string; x: number; y: number; size: number }[] = [
  { id: 'dispatcher', star: '天枢', x: 636, y: 84, size: 30 },
  { id: 'research', star: '天璇', x: 800, y: 150, size: 26 },
  { id: 'writer', star: '天玑', x: 772, y: 292, size: 26 },
  { id: 'coder', star: '天权', x: 612, y: 276, size: 26 },
  { id: 'summarizer', star: '玉衡', x: 452, y: 326, size: 24 },
  { id: 'qc', star: '开阳', x: 292, y: 386, size: 24 },
  { id: 'reviser', star: '摇光', x: 140, y: 452, size: 24 },
];

// 斗身四条边 + 斗柄三节
const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [3, 4],
  [4, 5],
  [5, 6],
];

function edgePoints(from: { x: number; y: number }, to: { x: number; y: number }, gap: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return {
    x1: from.x + ux * gap,
    y1: from.y + uy * gap,
    x2: to.x - ux * gap,
    y2: to.y - uy * gap,
  };
}

const STAR_TONE: Record<string, string> = {
  waiting: 'text-ink-3',
  running: 'text-accent',
  done: 'text-ink',
  failed: 'text-danger',
  inactive: 'text-ink-3',
};

export default function AgentDag({
  t,
  agentLabel,
  statusLabel,
  agentStatus,
}: {
  t: (key: string) => string;
  agentLabel: (id: AgentId) => string;
  statusLabel: (status: AgentStatus) => string;
  agentStatus: Record<AgentId, { status: AgentStatus; detail: string }>;
}) {
  const reached = (id: AgentId) => {
    const status = agentStatus[id].status;
    return status === 'running' || status === 'done';
  };

  return (
    <div>
      <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
        {AGENT_IDS.map((id, index) => {
          const state = agentStatus[id];
          const inactive = state.status === 'inactive';
          return (
            <li key={id} className="flex items-center gap-1.5">
              <StarDot state={state.status} size={11} />
              <span className={`caption-5 ${inactive ? 'text-ink-3' : 'text-ink-2'}`}>{agentLabel(id)}</span>
              {index < AGENT_IDS.length - 1 && <span className="caption-5 text-ink-3">→</span>}
            </li>
          );
        })}
      </ol>

      <div className="relative mx-auto mt-2 hidden aspect-[900/560] w-full max-w-[820px] sm:block">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a99bf5" stopOpacity="0.2" />
              <stop offset="45%" stopColor="#d7d0ff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#a99bf5" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {EDGES.map(([from, to], index) => {
            const point = edgePoints(NODES[from], NODES[to], 34);
            const active = reached(NODES[to].id);
            return (
              <path
                key={`${from}-${to}`}
                d={`M ${point.x1} ${point.y1} L ${point.x2} ${point.y2}`}
                fill="none"
                stroke={active ? 'url(#beam-gradient)' : 'rgba(167, 176, 200, 0.16)'}
                strokeWidth={active ? 2.2 : 1.4}
                strokeLinecap="round"
                className={active ? 'beam-flow' : undefined}
                style={{ animationDelay: `${index * 130}ms` }}
              />
            );
          })}
        </svg>

        {NODES.map((node) => {
          const state = agentStatus[node.id];
          const inactive = state.status === 'inactive';
          return (
            <div
              key={node.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 text-center ${inactive ? 'opacity-45' : ''}`}
              style={{ left: `${(node.x / VIEW_W) * 100}%`, top: `${(node.y / VIEW_H) * 100}%` }}
            >
              <div className="relative mx-auto flex items-center justify-center" style={{ width: node.size * 2.4, height: node.size * 2.4 }}>
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 rounded-full blur-xl ${
                    state.status === 'running'
                      ? 'bg-accent/60'
                      : state.status === 'done'
                        ? 'bg-white/25'
                        : 'bg-white/10'
                  }`}
                />
                <Star
                  size={node.size}
                  weight="fill"
                  className={`relative ${STAR_TONE[state.status] ?? 'text-ink-3'}`}
                />
              </div>
              <p className="caption-5 mt-1 whitespace-nowrap font-mono text-ink-3">{node.star}</p>
              <p className="title-4 whitespace-nowrap text-ink">{agentLabel(node.id)}</p>
              <p className="caption-5 whitespace-nowrap text-ink-3">
                {inactive ? t('expertInactive') : statusLabel(state.status)}
              </p>
            </div>
          );
        })}
      </div>
      <p className="caption-5 mt-1 hidden text-center text-ink-3 sm:block">{t('expertFlowCaption')}</p>
    </div>
  );
}
