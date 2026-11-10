'use client';

import type { RefObject } from 'react';
import { Microphone, Paperclip, Sparkle } from '@phosphor-icons/react';
import type { AgentId, AgentName, Lang } from '../copy';
import type { TaskTemplate } from '../../lib/task-templates';
import type { Attachment } from '../types';
import { Glyph, Reveal, Switch } from './ui';

/* 任务输入：一块悬浮的宽幅面板，不做卡片。
   本轮新增：联网搜索开关、上传文件（PDF / Word / 图片 OCR）、语音输入、已解析资料列表。 */

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
  attachments,
  onAddFiles,
  onRemoveAttachment,
  parsingCount,
  notice,
  fileInputRef,
  searchEnabled,
  onToggleSearch,
  voiceSupported,
  voiceListening,
  onToggleVoice,
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
  attachments: Attachment[];
  onAddFiles: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  parsingCount: number;
  notice: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  searchEnabled: boolean;
  onToggleSearch: (next: boolean) => void;
  voiceSupported: boolean;
  voiceListening: boolean;
  onToggleVoice: () => void;
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
    <section id="task" className="relative z-10 mt-6 w-full">
      <Reveal>
        <div className="card p-4 transition-shadow duration-300 ease-out-soft focus-within:outline focus-within:outline-1 focus-within:outline-offset-4 focus-within:outline-line-2 lg:p-5">
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
                      className="btn-ghost lift"
                    >
                      {template.label[lang]}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Switch checked={searchEnabled} onChange={onToggleSearch} label={t('searchToggleAria')} />
                <span className="caption-4 text-ink-2">{t('searchToggle')}</span>
              </div>
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

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-2">
            <label htmlFor="task-input" className="sr-only">
              {t('taskLabel')}
            </label>
            <textarea
              id="task-input"
              value={task}
              onChange={(event) => onTaskChange(event.target.value)}
              rows={2}
              placeholder={t('taskPlaceholder')}
              className="title-2 min-w-0 flex-1 resize-none bg-transparent text-ink outline-none placeholder:text-ink-3"
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={onToggleVoice}
                aria-pressed={voiceListening}
                aria-label={voiceListening ? t('voiceStop') : t('voiceStart')}
                className={`caption-4 inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-colors duration-300 ease-out-soft ${
                  voiceListening
                    ? 'border-accent/50 bg-accent/15 text-accent'
                    : 'border-line text-ink-2 hover:border-line-2 hover:bg-raised hover:text-ink'
                }`}
              >
                <Glyph as={Microphone} size={16} />
                {voiceListening ? t('voiceListening') : t('voiceStart')}
              </button>
            )}
          </div>

          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <label htmlFor="reference-input" className="caption-4 text-ink-3">
                  {t('reference')}
                </label>
                <span className="caption-5 rounded border border-line-2 px-1.5 py-0.5 text-accent">
                  {t('multimodalLabel')}
                </span>
                <span className="caption-5 text-ink-3">{t('multimodalHint')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  title={t('uploadHint')}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || parsingCount > 0}
                  className="btn-ghost"
                >
                  <Glyph as={Paperclip} size={16} />
                  {parsingCount > 0 ? `${t('uploadParsing')} ${parsingCount}` : t('uploadFile')}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg,image/webp"
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (files.length > 0) onAddFiles(files);
                    event.target.value = '';
                  }}
                />
              </div>
            </div>


            {attachments.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {attachments.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 text-ink-2">
                    {item.kind === 'image' && item.thumb ? (
                      // 用户自己的图片，只在本地预览，不上传
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumb} alt={item.name} className="h-8 w-8 rounded border border-line object-cover" />
                    ) : (
                      <Glyph as={Sparkle} size={16} className="text-ink-3" />
                    )}
                    <span className="caption-2 min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="caption-5 shrink-0 font-mono text-ink-3 tabular-nums">
                      {item.chars} {t('attachmentChars')}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(item.id)}
                      className="caption-5 shrink-0 rounded px-1.5 py-0.5 text-ink-3 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-danger"
                    >
                      {t('attachmentRemove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <textarea
              id="reference-input"
              value={reference}
              onChange={(event) => onReferenceChange(event.target.value)}
              rows={2}
              disabled={loading}
              placeholder={t('referencePlaceholder')}
              className="body-6 mt-3 w-full resize-none bg-transparent text-ink-2 outline-none placeholder:text-ink-3 disabled:opacity-60"
            />
            {notice && <p className="caption-5 mt-2 text-warn">{notice}</p>}
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-4">
            <div className="space-y-4">
              <div>
                <p className="caption-5 text-ink-3">{t('expertsLabel')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {expertIds.map((agent) => {
                    const active = selectedExperts[agent];
                    return (
                      <label
                        key={agent}
                        className={`lift caption-2 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${
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

            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onSubmit}
                disabled={loading || !task.trim()}
                className="btn-primary sheen"
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
