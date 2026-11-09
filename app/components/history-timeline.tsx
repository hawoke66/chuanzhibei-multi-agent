'use client';

import { useMemo, useState } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import type { Lang } from '../copy';
import type { HistoryItem } from '../types';
import { formatNumber, formatSeconds } from '../format';
import { Glyph, Reveal } from './ui';

/* 任务历史：时间线列表，不做卡片。
   本轮新增：按任务文字搜索 + 按质检分数筛选（全部 / 80+ 通过 / 未通过），全部在本地做。 */

type ScoreFilter = 'all' | 'pass' | 'fail';

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
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ScoreFilter>('all');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return history
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (needle && !item.task.toLowerCase().includes(needle)) return false;
        if (filter === 'pass' && item.score < 80) return false;
        if (filter === 'fail' && item.score >= 80) return false;
        return true;
      });
  }, [history, query, filter]);

  if (history.length === 0) return null;

  const FILTERS: { key: ScoreFilter; label: string }[] = [
    { key: 'all', label: t('historyFilterAll') },
    { key: 'pass', label: t('historyFilterPass') },
    { key: 'fail', label: t('historyFilterFail') },
  ];

  return (
    <section className="relative mx-auto w-full max-w-7xl px-6 py-16 lg:px-8">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
          <h2 className="caption-4 text-ink-3">{t('historyTitle')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="history-search" className="sr-only">
              {t('historySearch')}
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-line px-2 py-1 focus-within:border-line-2">
              <Glyph as={MagnifyingGlass} size={16} className="text-ink-3" />
              <input
                id="history-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('historySearch')}
                className="caption-2 w-40 bg-transparent text-ink outline-none placeholder:text-ink-3 sm:w-56"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={t('historySearchClear')}
                  className="rounded p-0.5 text-ink-3 transition-colors duration-300 ease-out-soft hover:text-ink"
                >
                  <Glyph as={X} size={16} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1" role="group" aria-label={t('historyFilterAll')}>
              {FILTERS.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setFilter(entry.key)}
                  aria-pressed={filter === entry.key}
                  className={`caption-5 rounded-lg px-2 py-1 transition-colors duration-300 ease-out-soft ${
                    filter === entry.key ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClear}
              className="caption-4 rounded-lg px-2 py-1 text-ink-3 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink"
            >
              {t('clearHistory')}
            </button>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="caption-2 mt-4 text-ink-3">{t('historyEmpty')}</p>
        ) : (
          <ol>
            {visible.map(({ item, index }) => (
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
        )}
      </Reveal>
    </section>
  );
}
