'use client';

import { useState } from 'react';
import { ArrowsLeftRight, CaretDown, Copy, Export, Share } from '@phosphor-icons/react';
import type { AgentId, AgentStatus } from '../copy';
import type { ExpertResult } from '../types';
import MarkdownView from '../markdown-view';
import { copyText, countCharacters, formatNumber } from '../format';
import { Glyph, Reveal, StarDot } from './ui';

/* 终章：最终成果全页展示。指标与来源在尾声页，这一页只放正文与操作。 */

const TEXT_BUTTON =
  'btn-ghost focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';

function ExpertOutputRow({
  result,
  t,
  agentLabel,
  statusLabel,
}: {
  result: ExpertResult;
  t: (key: string) => string;
  agentLabel: (id: AgentId) => string;
  statusLabel: (status: AgentStatus) => string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (await copyText(result.output)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <li className="border-t border-line">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors duration-300 ease-out-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="title-4 text-ink">{agentLabel(result.agent)}</span>
          <span className="caption-5 truncate text-ink-3">
            {t('goal')}：{result.goal}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="caption-5 hidden font-mono text-ink-3 tabular-nums sm:inline">
            {formatNumber(countCharacters(result.output))} {t('metricChars')}
          </span>
          <StarDot state={result.status === 'done' ? 'done' : 'failed'} size={12} />
          <span className="sr-only">{statusLabel(result.status)}</span>
          <Glyph
            as={CaretDown}
            size={16}
            className={`text-ink-3 transition-transform duration-300 ease-out-soft ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open &&
        (result.status === 'done' ? (
          <div className="pb-4">
            <pre className="body-6 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-void p-4 text-ink-2">
              {result.output}
            </pre>
            <button type="button" onClick={handleCopy} className={`${TEXT_BUTTON} mt-2`}>
              <Glyph as={Copy} size={16} />
              {copied ? t('copied') : result.agent === 'coder' ? t('copyCode') : t('copy')}
            </button>
          </div>
        ) : (
          <p className="caption-2 pb-4 text-danger">
            {t('errorTitle')}：{result.error}
          </p>
        ))}
    </li>
  );
}

export default function Results({
  t,
  hasResult,
  loading,
  isHistoryView,
  task,
  final,
  copiedFinal,
  onCopy,
  onExport,
  exportEnabled,
  onShare,
  shareNotice,
  shareLink,
  results,
  agentLabel,
  statusLabel,
  onStart,
  compareOpen,
  onToggleCompare,
}: {
  t: (key: string) => string;
  hasResult: boolean;
  loading: boolean;
  isHistoryView: boolean;
  task: string;
  final: string;
  copiedFinal: boolean;
  onCopy: () => void;
  onExport: () => void;
  exportEnabled: boolean;
  onShare: () => void;
  shareNotice: string;
  shareLink: string;
  results: ExpertResult[];
  agentLabel: (id: AgentId) => string;
  statusLabel: (status: AgentStatus) => string;
  onStart: () => void;
  compareOpen: boolean;
  onToggleCompare: () => void;
}) {
  if (!hasResult && !loading) {
    return (
      <div className="mt-6">
        <p className="body-6 max-w-[560px] text-pretty text-ink-3">{t('resultEmptyPage')}</p>
        <button type="button" onClick={onStart} className="caption-4 mt-4 text-ink underline-offset-4 hover:underline">
          {t('resultEmptyCta')} →
        </button>
      </div>
    );
  }

  if (loading && !hasResult) {
    return (
      <div className="mt-8 space-y-3" aria-busy="true">
        <div className="h-3 w-1/3 rounded bg-raised" />
        <div className="h-2 w-full rounded bg-raised" />
        <div className="h-2 w-11/12 rounded bg-raised" />
        <div className="h-2 w-4/5 rounded bg-raised" />
      </div>
    );
  }

  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col">
      <Reveal>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="caption-5 text-ink-3">{t('resultTaskLabel')}</p>
              {isHistoryView && (
                <span className="caption-5 rounded border border-line-2 px-1.5 py-0.5 text-ink-3">
                  {t('historyBadge')}
                </span>
              )}
            </div>
            <p className="title-2 mt-1 text-pretty text-ink">{task}</p>
          </div>

          <div className="flex flex-wrap items-center gap-1" aria-label={t('resultActionsLabel')}>
            <button type="button" onClick={onCopy} className={TEXT_BUTTON}>
              <Glyph as={Copy} size={16} />
              {copiedFinal ? t('copied') : t('copy')}
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={!exportEnabled}
              title={exportEnabled ? undefined : t('pluginDisabled')}
              className={TEXT_BUTTON}
            >
              <Glyph as={Export} size={16} />
              {t('exportMarkdown')}
            </button>
            <button type="button" onClick={onShare} className={TEXT_BUTTON}>
              <Glyph as={Share} size={16} />
              {t('share')}
            </button>
            <button type="button" onClick={onToggleCompare} aria-expanded={compareOpen} className={TEXT_BUTTON}>
              <Glyph as={ArrowsLeftRight} size={16} />
              {compareOpen ? t('compareHide') : t('compareToggle')}
            </button>
          </div>
        </div>

        {(shareNotice || shareLink) && (
          <div className="mt-3 rounded-lg border border-line p-3">
            {shareNotice && <p className="caption-5 text-ink-2">{shareNotice}</p>}
            {shareLink && (
              <input
                readOnly
                value={shareLink}
                aria-label={t('shareLinkLabel')}
                onFocus={(event) => event.currentTarget.select()}
                className="caption-5 mt-2 w-full rounded bg-void px-2 py-1 font-mono text-ink-2"
              />
            )}
          </div>
        )}
      </Reveal>

      <div className="doc-in mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <MarkdownView text={final} copyLabel={t('copyCode')} copiedLabel={t('copied')} />
      </div>

      {results.length > 0 && (
        <Reveal delay={60}>
          <div className="mt-6">
            <h3 className="caption-4 text-ink-3">{t('expertOutput')}</h3>
            <ul className="mt-2">
              {results.map((result) => (
                <ExpertOutputRow
                  key={result.subtaskId}
                  result={result}
                  t={t}
                  agentLabel={agentLabel}
                  statusLabel={statusLabel}
                />
              ))}
            </ul>
          </div>
        </Reveal>
      )}
    </div>
  );
}
