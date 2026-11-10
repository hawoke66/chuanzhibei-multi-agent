'use client';

import type { RunSnapshot } from '../types';
import { formatNumber, formatSeconds } from '../format';

/* 任务对比：同一道题跑两次，左右并排看修订前后的成果与分数变化。
   只读前端状态；只有一次运行时给提示，不造假数据。 */

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="caption-5 text-ink-3">±0</span>;
  const positive = value > 0;
  return (
    <span className={`caption-5 font-mono tabular-nums ${positive ? 'compare-up' : 'compare-down'}`}>
      {positive ? '+' : ''}
      {formatNumber(value)}
    </span>
  );
}

function Column({ label, run, t }: { label: string; run: RunSnapshot; t: (key: string) => string }) {
  return (
    <div className="min-w-0">
      <p className="caption-4 text-ink-3">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="heading-5 font-mono text-ink tabular-nums">{run.score === null ? '—' : formatNumber(run.score)}</span>
        <span className="caption-5 text-ink-3">/ 100</span>
      </p>
      {run.breakdown && (
        <ul className="mt-2 space-y-1">
          {[
            ['rubricFacts', run.breakdown.facts],
            ['rubricRelevance', run.breakdown.relevance],
            ['rubricStructure', run.breakdown.structure],
            ['rubricLanguage', run.breakdown.language],
          ].map(([key, value]) => (
            <li key={String(key)} className="caption-5 flex items-baseline justify-between gap-2 text-ink-3">
              <span>{t(String(key))}</span>
              <span className="font-mono text-ink-2 tabular-nums">{formatNumber(Number(value))}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="caption-5 mt-2 text-ink-3">
        {t('metricChars')} {formatNumber(Array.from((run.final ?? '').replace(/\s+/g, '')).length)} ·{' '}
        {formatSeconds(run.elapsed ?? 0)} {t('secondsUnit')} · {t('revisions')} {run.revisions ?? 0}
      </p>
      <pre className="body-6 mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-void p-3 text-ink-2">
        {run.final}
      </pre>
    </div>
  );
}

export default function RunCompare({
  t,
  previous,
  current,
}: {
  t: (key: string) => string;
  previous: RunSnapshot | null;
  current: RunSnapshot | null;
}) {
  if (!previous || !current || previous.task.trim() !== current.task.trim()) {
    return (
      <div className="mt-4 rounded-xl border border-line p-4">
        <p className="caption-4 text-ink-2">{t('compareTitle')}</p>
        <p className="caption-5 mt-2 text-ink-3">{t('compareHint')}</p>
      </div>
    );
  }

  const scoreDelta = (current.score ?? 0) - (previous.score ?? 0);

  return (
    <div className="mt-4 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="caption-4 text-ink-2">{t('compareTitle')}</p>
        <p className="caption-5 flex items-baseline gap-2 text-ink-3">
          {t('qualityArrow')}
          <span className="font-mono text-ink-2 tabular-nums">
            {previous.score ?? '—'} → {current.score ?? '—'}
          </span>
          <Delta value={scoreDelta} />
        </p>
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Column label={t('comparePrev')} run={previous} t={t} />
        <Column label={t('compareNow')} run={current} t={t} />
      </div>
    </div>
  );
}
