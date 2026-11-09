'use client';

import type { AgentId, AgentStatus } from '../copy';
import { Reveal, StarDot } from './ui';

/* 任务流：一条五节点的横向轨道 + 左侧计划、右侧阶段状态。
   轨道只有刻度线和文字，不做五个等高方块；阶段状态用星点表示。 */

type StatusMap = Record<AgentId, { status: AgentStatus; detail: string }>;

const STAGE_IDS: AgentId[] = ['summarizer', 'qc', 'reviser'];

export default function Flow({
  t,
  agentLabel,
  statusLabel,
  agentStatus,
  plan,
  subtasks,
}: {
  t: (key: string) => string;
  agentLabel: (id: AgentId) => string;
  statusLabel: (status: AgentStatus) => string;
  agentStatus: StatusMap;
  plan: string;
  subtasks: { id: string; agent: 'research' | 'writer' | 'coder'; goal: string; deliverable: string }[];
}) {
  const steps = [t('aiStep1'), t('aiStep2'), t('aiStep3'), t('aiStep4'), t('aiStep5')];

  return (
    <section id="flow" className="relative mx-auto w-full max-w-7xl px-6 py-24 lg:px-8">
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <p className="caption-4 text-ink-3">{t('flowKicker')}</p>
            <h2 className="mt-4 text-ink heading-4 sm:heading-3">
              {t('flowTitleLine1')}
              <br />
              {t('flowTitleLine2')}
            </h2>
          </div>
          <p className="body-3 lg:col-span-6 lg:col-start-7 lg:self-end text-pretty text-ink-2">{t('flowLead')}</p>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <ol className="mt-14 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-5">
          {steps.map((step, index) => (
            <li key={step}>
              <div className="flex items-center gap-2">
                <span className="caption-5 font-mono text-ink-3 tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="h-px flex-1 bg-line-2" aria-hidden="true" />
              </div>
              <p className="title-3 mt-3 text-ink">{step}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <div className="mt-16 grid gap-12 lg:grid-cols-12 lg:gap-8">
        <Reveal className="lg:col-span-7">
          <h3 className="caption-4 text-ink-3">{t('planTitle')}</h3>
          {plan ? (
            <>
              <p className="body-3 mt-3 whitespace-pre-wrap text-pretty text-ink-2">{plan}</p>
              {subtasks.length > 0 && (
                <ul className="mt-6">
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
              )}
            </>
          ) : (
            <p className="body-6 mt-3 max-w-[420px] text-pretty text-ink-3">{t('planEmpty')}</p>
          )}
        </Reveal>

        <Reveal className="lg:col-span-4 lg:col-start-9" delay={80}>
          <h3 className="caption-4 text-ink-3">{t('stagesTitle')}</h3>
          <ul className="mt-3">
            {STAGE_IDS.map((id) => {
              const state = agentStatus[id];
              return (
                <li key={id} className="flex items-start justify-between gap-3 border-t border-line py-3">
                  <div className="flex items-center gap-2">
                    <StarDot state={state.status} size={12} />
                    <span className="caption-2 text-ink-2">{agentLabel(id)}</span>
                  </div>
                  <div className="text-right">
                    <p className="caption-5 text-ink-2">{statusLabel(state.status)}</p>
                    {state.detail && <p className="caption-5 text-ink-3">{state.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="caption-5 mt-6 text-pretty text-ink-3">{t('flowNotes')}</p>
        </Reveal>
      </div>
    </section>
  );
}
