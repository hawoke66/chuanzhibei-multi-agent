'use client';

import type { RefObject } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';
import type { AgentId, AgentName, Lang } from '../copy';
import type { TaskTemplate } from '../../lib/task-templates';
import { Glyph, Reveal } from './ui';

/* 任务输入：一块悬浮的宽幅面板，不做卡片。
   面板本身只有一层表面色，分隔靠 hairline，动作靠文字与一块实心按钮。 */

export default function TaskPanel({
  t,
  lang,
  examples,
  templates,
  templatesEnabled,
  task,
  onTaskChange,
  reference,
  onReferenceChange,
  importNotice,
  importing,
  onImportFile,
  fileInputRef,
  selectedExperts,
  onToggleExpert,
  loading,
  onSubmit,
  onCancel,
  cancelled,
  error,
  retryable,
  onRetry,
  onUseTemplate,
  agentLabel,
}: {
  t: (key: string) => string;
  lang: Lang;
  examples: { label: string; task: string }[];
  templates: TaskTemplate[];
  templatesEnabled: boolean;
  task: string;
  onTaskChange: (value: string) => void;
  reference: string;
  onReferenceChange: (value: string) => void;
  importNotice: string;
  importing: boolean;
  onImportFile: (file: File) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  selectedExperts: Record<AgentName, boolean>;
  onToggleExpert: (agent: AgentName, next: boolean) => void;
  loading: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  cancelled: boolean;
  error: string;
  retryable: boolean;
  onRetry: () => void;
  onUseTemplate: (template: TaskTemplate) => void;
  agentLabel: (id: AgentId) => string;
}) {
  const expertIds: AgentName[] = ['research', 'writer', 'coder'];

  return (
    <section id="task" className="relative z-10 mx-auto -mt-8 w-full max-w-7xl px-6 sm:-mt-12 lg:-mt-20 lg:px-8">
      <Reveal>
        <div className="rounded-2xl bg-surface p-6 transition-shadow duration-300 ease-out-soft focus-within:outline focus-within:outline-1 focus-within:outline-offset-4 focus-within:outline-line-2 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
            <p className="caption-4 text-ink-3">{t('taskKicker')}</p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              {templatesEnabled && templates.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="caption-5 text-ink-3">{t('templatesLabel')}</span>
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => onUseTemplate(template)}
                      disabled={loading}
                      className="caption-4 rounded-lg border border-line px-2.5 py-1 text-ink-2 transition-colors duration-300 ease-out-soft hover:border-line-2 hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {template.label[lang]}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <span className="caption-5 text-ink-3">{t('samplesLabel')}</span>
                {examples.map((example, index) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => onTaskChange(example.task)}
                    className="caption-4 flex items-center gap-1.5 text-ink-2 transition-colors duration-300 ease-out-soft hover:text-ink"
                  >
                    <span className="font-mono text-ink-3 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                    {example.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label htmlFor="task-input" className="sr-only">
            {t('taskLabel')}
          </label>
          <textarea
            id="task-input"
            value={task}
            onChange={(event) => onTaskChange(event.target.value)}
            rows={2}
            placeholder={t('taskPlaceholder')}
            className="title-2 mt-5 w-full resize-none bg-transparent text-ink outline-none placeholder:text-ink-3"
          />

          <div className="mt-6 border-t border-line pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="reference-input" className="caption-4 text-ink-3">
                {t('reference')}
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || importing}
                className="caption-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-ink-2 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {importing ? t('importParsing') : t('importFile')}
                <Glyph as={ArrowUpRight} size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onImportFile(file);
                }}
              />
            </div>
            <textarea
              id="reference-input"
              value={reference}
              onChange={(event) => onReferenceChange(event.target.value)}
              rows={2}
              disabled={loading}
              placeholder={t('referencePlaceholder')}
              className="body-6 mt-2 w-full resize-none bg-transparent text-ink-2 outline-none placeholder:text-ink-3 disabled:opacity-60"
            />
            {importNotice && <p className="caption-5 mt-2 text-warn">{importNotice}</p>}
          </div>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-5">
            <div>
              <p className="caption-5 text-ink-3">{t('expertsLabel')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {expertIds.map((agent) => {
                  const active = selectedExperts[agent];
                  return (
                    <label
                      key={agent}
                      className={`caption-2 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors duration-300 ease-out-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${
                        active
                          ? 'border-line-2 bg-raised text-ink'
                          : 'border-line text-ink-2 hover:border-line-2 hover:text-ink'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        disabled={loading}
                        onChange={(event) => onToggleExpert(agent, event.target.checked)}
                        className="h-4 w-4 accent-accent"
                      />
                      {agentLabel(agent)}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onSubmit}
                disabled={loading || !task.trim()}
                className="button-md rounded-lg bg-ink px-4 py-2 text-void transition-[background-color,transform] duration-300 ease-out-soft hover:bg-white active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? t('running') : t('submit')}
              </button>
              {loading && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="button-sm rounded-lg border border-line-2 px-3 py-2 text-ink-2 transition-colors duration-300 ease-out-soft hover:border-danger/50 hover:bg-raised hover:text-danger"
                >
                  {t('cancel')}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <p className="caption-2 text-danger">{error}</p>
              {retryable && (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={loading}
                  className="caption-4 rounded-lg border border-line-2 px-2.5 py-1 text-ink-2 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink disabled:opacity-40"
                >
                  {t('retry')}
                </button>
              )}
            </div>
          )}

          {cancelled && !error && <p className="caption-5 mt-5 text-warn">{t('cancelledNote')}</p>}
        </div>
      </Reveal>
    </section>
  );
}
