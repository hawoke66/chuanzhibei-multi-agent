'use client';

import type { AgentId, AgentName, AgentStatus } from '../copy';
import { Reveal, StarDot } from './ui';
import { MagicCard } from './magicui/magic-card';

/* 七张状态卡：不按 7 等分排一行，按流程分三段——调度 / 并行 / 汇总·验收·修订。
   状态一变，卡片绕 Y 轴翻一下落到新状态；状态与协作图同源。 */

const ROWS: { key: string; ids: AgentId[] }[] = [
  { key: 'groupDispatch', ids: ['dispatcher', 'research', 'writer'] },
  { key: 'groupParallel', ids: ['coder', 'summarizer', 'qc', 'reviser'] },
];

export default function Experts({
  t,
  agentLabel,
  statusLabel,
  agentStatus,
  doneCount,
  activeCount,
  overallPercent,
  onRetryExpert,
  retryCounts,
  retryingAgent,
}: {
  t: (key: string) => string;
  agentLabel: (id: AgentId) => string;
  statusLabel: (status: AgentStatus) => string;
  agentStatus: Record<AgentId, { status: AgentStatus; detail: string }>;
  doneCount: number;
  activeCount: number;
  overallPercent: number;
  onRetryExpert?: (agent: AgentName) => void;
  retryCounts?: Record<string, number>;
  retryingAgent?: AgentName | null;
}) {
  const expertAgents: AgentName[] = ['research', 'writer', 'coder'];

  return (
    <div className="mt-4 space-y-3">
      {ROWS.map((row) => (
        <div key={row.key} className="flex flex-wrap justify-center gap-3">
          {row.ids.map((id) => {
            const state = agentStatus[id];
            const inactive = state.status === 'inactive';
            const failed = state.status === 'failed';
            const canRetry = failed && (expertAgents as string[]).includes(id) && onRetryExpert;
            return (
              <MagicCard
                key={id}
                className="w-[228px] shrink-0 px-3 py-2.5"
                glowColor="169, 155, 245"
              >
                <div data-status={state.status}>
                  <div className="agent-card-flip" key={`${state.status}-${state.detail}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="title-4 truncate text-ink">{agentLabel(id)}</p>
                      <StarDot state={state.status} size={11} />
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <p
                        className={`caption-5 truncate ${
                          failed
                            ? 'text-danger'
                            : inactive
                              ? 'text-ink-3'
                              : state.status === 'running'
                                ? 'text-accent'
                                : 'text-ink-2'
                        }`}
                      >
                        {inactive ? t('expertInactive') : statusLabel(state.status)}
                      </p>
                      <p className="caption-5 truncate text-right text-ink-3">{state.detail || '—'}</p>
                    </div>
                    {canRetry && (
                      <button
                        type="button"
                        onClick={() => onRetryExpert(id as AgentName)}
                        disabled={Boolean(retryingAgent) || (retryCounts?.[id] ?? 0) >= 2}
                        className="caption-5 mt-1.5 w-full rounded border border-line-2 px-2 py-0.5 text-ink-2 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {retryingAgent === id
                          ? t('retryExpertBusy')
                          : (retryCounts?.[id] ?? 0) >= 2
                            ? t('retryExpertLimit')
                            : `${t('retryExpert')} (${retryCounts?.[id] ?? 0}/2)`}
                      </button>
                    )}
                  </div>
                </div>
              </MagicCard>
            );
          })}
        </div>
      ))}

      <Reveal>
        <div className="flex items-center gap-4 pt-1">
          <p className="caption-5 whitespace-nowrap text-ink-3">{t('progress')}</p>
          <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-line-2">
            <div
              className="h-full origin-left rounded-full bg-accent transition-transform duration-500 ease-out-soft"
              style={{ transform: `scaleX(${overallPercent / 100})` }}
            />
          </div>
          <p className="caption-5 font-mono text-ink-2 tabular-nums">
            {doneCount} / {activeCount}
          </p>
        </div>
      </Reveal>
    </div>
  );
}
