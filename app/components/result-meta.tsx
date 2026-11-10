'use client';

import type { SourcesState, WebSource } from '../types';
import { NumberTicker } from './magicui/number-ticker';

/* 尾声：指标与历史。像片尾字幕——先 Token 与耗时，再来源列表。 */

export default function ResultMeta({
  t,
  isHistoryView,
  elapsed,
  characters,
  researchWriterChars,
  revisions,
  usage,
  sources,
  sourcesState,
}: {
  t: (key: string) => string;
  isHistoryView: boolean;
  elapsed: number | null;
  characters: number;
  researchWriterChars: number;
  revisions: number;
  usage?: { prompt: number; completion: number };
  sources: WebSource[];
  sourcesState: SourcesState;
}) {
  const rows = [
    {
      key: 'metricElapsed',
      value: elapsed === null ? null : (
        <>
          <NumberTicker value={elapsed} decimals={1} /> {t('secondsUnit')}
        </>
      ),
    },
    { key: 'metricChars', value: <NumberTicker value={characters} /> },
    {
      key: 'metricTokens',
      value: usage ? (
        <>
          <NumberTicker value={usage.prompt} /> + <NumberTicker value={usage.completion} />
        </>
      ) : null,
    },
    {
      key: 'researchWriterChars',
      value: researchWriterChars > 0 ? <NumberTicker value={researchWriterChars} /> : null,
    },
    { key: 'revisions', value: revisions },
  ].filter((row) => row.value !== null && !(row.key === 'metricTokens' && isHistoryView));

  return (
    <div className="mt-2 grid gap-10 lg:grid-cols-12 lg:gap-8">
      <dl className="lg:col-span-7">
        {rows.map((row) => (
          <div key={row.key} className="flex items-baseline justify-between gap-6 border-b border-line py-5">
            <dt className="caption-4 text-ink-3">{t(row.key)}</dt>
            <dd className="heading-6 font-mono text-ink tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="lg:col-span-4 lg:col-start-9">
        <p className="caption-4 text-ink-3">
          {!sourcesState.enabled
            ? t('sourcesOff')
            : sources.length > 0
              ? t('sourcesTitle').replace('{n}', String(sources.length))
              : sourcesState.configured
                ? t('sourcesEmpty')
                : t('sourcesNoKey')}
        </p>
        {sources.length > 0 && (
          <ul className="mt-2 space-y-2">
            {sources.map((source, index) => (
              <li key={source.url} className="flex items-baseline gap-3">
                <span className="caption-5 shrink-0 font-mono text-ink-3 tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="caption-5 min-w-0 flex-1 truncate text-ink-2 underline-offset-4 transition-colors duration-300 ease-out-soft hover:text-ink hover:underline"
                >
                  {source.title || source.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
