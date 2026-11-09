'use client';

import { X } from '@phosphor-icons/react';
import type { Lang } from '../copy';
import type { HistoryItem } from '../types';
import { formatNumber, formatSeconds } from '../format';
import { Glyph, Reveal } from './ui';

/* 任务历史：时间线列表，不做卡片。
   每行是「序号 + 任务 + 时间/分数/耗时」，右侧一个安静的删除。 */

export default function HistoryTimeline({
  t,
  lang,
  history,
  onSelect,
  onDelete,
  onClear,
}: {
  t: (key: string) => string;
  lang: Lang;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (index: number) => void;
  onClear: () => void;
}) {
  if (history.length === 0) return null;

  return (
    <section className="relative mx-auto w-full max-w-7xl px-6 py-16 lg:px-8">
      <Reveal>
        <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
          <h2 className="caption-4 text-ink-3">{t('historyTitle')}</h2>
          <button
            type="button"
            onClick={onClear}
            className="caption-4 rounded-lg px-2 py-1 text-ink-3 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink"
          >
            {t('clearHistory')}
          </button>
        </div>
        <ol>
          {history.map((item, index) => (
            <li key={`${item.time}-${index}`} className="flex items-start gap-4 border-b border-line py-4">
              <span className="caption-5 w-6 shrink-0 pt-0.5 font-mono text-ink-3 tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <p className="title-4 truncate text-ink transition-colors duration-300 ease-out-soft hover:text-accent">
                  {item.task}
                </p>
                <p className="caption-5 mt-1 font-mono text-ink-3 tabular-nums">
                  {new Date(item.time).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}
                  {' · '}
                  {t('metricScore')} {formatNumber(item.score)}
                  {' · '}
                  {formatSeconds(item.elapsed)} {t('secondsUnit')}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onDelete(index)}
                aria-label={t('delete')}
                className="rounded-lg p-1.5 text-ink-3 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Glyph as={X} size={16} />
              </button>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}
