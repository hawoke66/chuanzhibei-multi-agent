'use client';

import { Code, MagnifyingGlass, NotePencil, ShareNetwork } from '@phosphor-icons/react';
import type { AgentId, AgentStatus } from '../copy';
import { Glyph, Reveal, StarDot } from './ui';

/* 专家区：调度官一条宽幅，三位专家三条错落的行。
   没有一张卡是同一套「描边 + 阴影 + 背景」模板；层级靠表面色与 hairline 表达。 */

type StatusMap = Record<AgentId, { status: AgentStatus; detail: string }>;

const ROWS: { id: AgentId; glyph: typeof MagnifyingGlass; roleStart: string; roleKey: string }[] = [
  { id: 'research', glyph: MagnifyingGlass, roleStart: 'lg:col-start-4', roleKey: 'roleResearch' },
  { id: 'writer', glyph: NotePencil, roleStart: 'lg:col-start-5', roleKey: 'roleWriter' },
  { id: 'coder', glyph: Code, roleStart: 'lg:col-start-4', roleKey: 'roleCoder' },
];

export default function Experts({
  t,
  agentLabel,
  statusLabel,
  agentStatus,
  doneCount,
  activeCount,
  overallPercent,
}: {
  t: (key: string) => string;
  agentLabel: (id: AgentId) => string;
  statusLabel: (status: AgentStatus) => string;
  agentStatus: StatusMap;
  doneCount: number;
  activeCount: number;
  overallPercent: number;
}) {
  const dispatcher = agentStatus.dispatcher;

  return (
    <section id="experts" className="relative mx-auto w-full max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <p className="caption-4 text-ink-3">{t('expertsKicker')}</p>
            <h2 className="mt-4 text-ink heading-4 sm:heading-3">
              {t('expertsTitleLine1')}
              <br />
              {t('expertsTitleLine2')}
            </h2>
          </div>
          <p className="body-3 lg:col-span-6 lg:col-start-7 lg:self-end text-pretty text-ink-2">
            {t('expertsLead')}
          </p>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div className="mt-14">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface px-6 py-5 lg:px-8">
            <div className="flex items-center gap-3">
              <Glyph as={ShareNetwork} size={18} className="text-ink-2" />
              <h3 className="title-1 text-ink">{agentLabel('dispatcher')}</h3>
              <span className="caption-5 hidden text-ink-3 sm:inline">{t('roleDispatcher')}</span>
            </div>
            <div className="flex items-center gap-2">
              <StarDot state={dispatcher.status} size={12} />
              <span className="caption-2 text-ink-2">{statusLabel(dispatcher.status)}</span>
              {dispatcher.detail && <span className="caption-5 text-ink-3">{dispatcher.detail}</span>}
            </div>
          </div>

          {ROWS.map((row) => {
            const state = agentStatus[row.id];
            return (
              <div
                key={row.id}
                className="grid grid-cols-1 gap-y-2 border-t border-line py-6 lg:grid-cols-12 lg:items-center lg:gap-x-8"
              >
                <div className="flex items-center gap-3 lg:col-span-3">
                  <Glyph as={row.glyph} size={18} className="text-ink-3" />
                  <h3 className="title-2 text-ink">{agentLabel(row.id)}</h3>
                </div>
                <p className={`body-6 text-ink-2 lg:col-span-6 ${row.roleStart}`}>{t(row.roleKey)}</p>
                <div className="flex items-center gap-2 lg:col-span-2 lg:col-start-11 lg:justify-end">
                  <StarDot state={state.status} size={12} />
                  <span className="caption-2 whitespace-nowrap text-ink-2">{statusLabel(state.status)}</span>
                </div>
                {state.detail && (
                  <p className="caption-5 text-ink-3 lg:col-span-2 lg:col-start-11 lg:text-right">{state.detail}</p>
                )}
              </div>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="mt-10 flex items-center gap-4">
          <p className="caption-4 whitespace-nowrap text-ink-3">{t('progress')}</p>
          <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-line-2">
            <div
              className="h-full origin-left rounded-full bg-accent transition-transform duration-500 ease-out-soft"
              style={{ transform: `scaleX(${overallPercent / 100})` }}
            />
          </div>
          <p className="caption-4 font-mono text-ink-2 tabular-nums">
            {doneCount} / {activeCount}
          </p>
          <p className="caption-5 hidden text-ink-3 sm:inline">{t('expertsLiveNote')}</p>
        </div>
      </Reveal>
    </section>
  );
}
