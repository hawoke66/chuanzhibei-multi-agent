'use client';

import type { AgentId, AgentStatus } from '../copy';
import type { Subtask, ToolTrace } from '../types';
import { Reveal, StarDot } from './ui';

/* 第一章：调度拆分。左栏是计划与子任务，右栏是阶段状态与工具轨迹。
   数据全部来自 /api/run 的 plan / tool / stage 事件，没有另造状态。 */

const STAGE_IDS: AgentId[] = ['summarizer', 'qc', 'reviser'];

export default function Flow({
  t,
  agentLabel,
  statusLabel,
  agentStatus,
  plan,
  subtasks,
  tools,
  loading,
}: {
  t: (key: string) => string;
  agentLabel: (id: AgentId) => string;
  statusLabel: (status: AgentStatus) => string;
  agentStatus: Record<AgentId, { status: AgentStatus; detail: string }>;
  plan: string;
  subtasks: Subtask[];
  tools: ToolTrace[];
  loading: boolean;
}) {
  const empty = !plan && subtasks.length === 0 && !loading;

  return (
    <div className="mt-2">
      {empty ? (
        <p className="body-6 mt-6 max-w-[560px] text-pretty text-ink-3">{t('dispatchEmpty')}</p>
      ) : (
        <div className="mt-4 grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <h3 className="caption-4 text-ink-3">{t('dispatchPlan')}</h3>
            <p className="body-3 mt-3 whitespace-pre-wrap text-pretty text-ink-2">{plan || '…'}</p>

            <h3 className="caption-4 mt-8 text-ink-3">{t('dispatchSubtasks')}</h3>
            <ul className="mt-2">
              {subtasks.length === 0 && (
                <li className="caption-5 border-t border-line py-3 text-ink-3">…</li>
              )}
              {subtasks.map((subtask) => (
                <li key={subtask.id} className="border-t border-line py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="title-4 text-ink">{agentLabel(subtask.agent)}</p>
                    <span className="caption-5 font-mono text-ink-3 tabular-nums">{subtask.id}</span>
                  </div>
                  <p className="body-6 mt-1 text-ink-2">
                    {t('goal')}：{subtask.goal}
                  </p>
                  <p className="caption-5 mt-1 text-ink-3">
                    {t('deliverable')}：{subtask.deliverable}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-4 lg:col-start-9">
            <Reveal>
              <h3 className="caption-4 text-ink-3">{t('stagesTitle')}</h3>
              <ul className="mt-2">
                {STAGE_IDS.map((id) => {
                  const state = agentStatus[id];
                  return (
                    <li key={id} className="flex items-start justify-between gap-3 border-t border-line py-3">
                      <div className="flex items-center gap-2">
                        <StarDot state={state.status} size={12} />
                        <span className="caption-2 text-ink-2">{agentLabel(id)}</span>
                      </div>
                      <div className="text-right">
                        <p className="caption-5 text-ink-2">
                          {state.status === 'inactive' ? t('expertInactive') : statusLabel(state.status)}
                        </p>
                        {state.detail && <p className="caption-5 text-ink-3">{state.detail}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Reveal>

            {tools.length > 0 && (
              <Reveal delay={60}>
                <h3 className="caption-4 mt-8 text-ink-3">{t('searchTool')}</h3>
                <ul className="mt-2">
                  {tools.map((tool, index) => (
                    <li key={`${tool.name}-${index}`} className="border-t border-line py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="caption-5 font-mono text-ink-2">{tool.name}</span>
                        <span className="caption-5 text-ink-3">
                          {tool.via === 'mcp' ? t('toolViaMcp') : t('toolViaLocal')}
                        </span>
                      </div>
                      <p className="caption-5 mt-1 text-pretty text-ink-3">{tool.detail}</p>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
