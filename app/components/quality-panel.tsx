'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowsLeftRight } from '@phosphor-icons/react';
import type { QcResult } from '../types';
import { buildDiff, diffStats } from '../../lib/diff';
import { formatNumber } from '../format';
import { Glyph, Reveal } from './ui';
import { NumberTicker } from './magicui/number-ticker';

/* 第三章：质检与修订。四项分、每轮意见、修订轮数，以及修订前后的词级对比。 */

function Rubric({ t, latest, grown }: { t: (key: string) => string; latest: QcResult | undefined; grown: boolean }) {
  if (!latest?.breakdown) return null;
  const rows = [
    { key: 'rubricFacts', weight: '30%', value: latest.breakdown.facts },
    { key: 'rubricRelevance', weight: '30%', value: latest.breakdown.relevance },
    { key: 'rubricStructure', weight: '20%', value: latest.breakdown.structure },
    { key: 'rubricLanguage', weight: '20%', value: latest.breakdown.language },
  ];
  return (
    <ul className="mt-7 space-y-4">
      {rows.map((row, index) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="caption-5 text-ink-3">
              {t(row.key)} <span className="font-mono tabular-nums">{row.weight}</span>
            </span>
            <span className="caption-4 font-mono text-ink-2 tabular-nums"><NumberTicker value={row.value} /></span>
          </div>
          <div className="mt-1.5 h-px w-full bg-line-2">
            <div
              className="h-px origin-left bg-accent/70 transition-transform duration-700 ease-out-soft"
              style={{
                transform: `scaleX(${grown ? Math.max(0, Math.min(100, row.value)) / 100 : 0})`,
                transitionDelay: `${index * 90}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function QualityPanel({
  t,
  hasResult,
  loading,
  isHistoryView,
  score,
  scorePass,
  qcHistory,
  revisions,
  finalFailed,
  draft,
  revised,
}: {
  t: (key: string) => string;
  hasResult: boolean;
  loading: boolean;
  isHistoryView: boolean;
  score: number | null;
  scorePass: boolean;
  qcHistory: QcResult[];
  revisions: number;
  finalFailed: boolean;
  draft: string;
  revised: string;
}) {
  const [grown, setGrown] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const hasDiff = Boolean(draft && revised && draft !== revised);
  const latest = qcHistory.length > 0 ? qcHistory[qcHistory.length - 1] : undefined;

  useEffect(() => {
    if (!hasResult) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      setGrown(false);
      second = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [hasResult, score, isHistoryView]);

  const diffParts = useMemo(
    () => (hasDiff && showDiff ? buildDiff(draft, revised) : []),
    [hasDiff, showDiff, draft, revised],
  );
  const diffStat = useMemo(() => diffStats(diffParts), [diffParts]);

  if (loading && !hasResult) {
    return (
      <div className="mt-8 space-y-4" aria-busy="true">
        <div className="h-10 w-40 rounded bg-raised" />
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-2 w-full rounded bg-raised" />
        ))}
      </div>
    );
  }

  if (!hasResult) {
    return <p className="body-6 mt-6 max-w-[560px] text-pretty text-ink-3">{t('qualityEmpty')}</p>;
  }

  return (
    <div className="mt-4 grid gap-12 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5">
        <Reveal>
          <p className="caption-5 text-ink-3">{t('metricScore')}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="heading-2 font-mono text-ink tabular-nums">
              {score === null ? '—' : <NumberTicker value={score} />}
            </span>
            <span className="caption-5 text-ink-3">/ 100</span>
            <span className={`caption-2 ${scorePass ? 'text-ok' : 'text-danger'}`}>
              {scorePass ? t('pass') : t('fail')}
            </span>
          </p>
          <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-line-2">
            <div
              className={`h-full origin-left rounded-full transition-transform duration-700 ease-out-soft ${
                scorePass ? 'bg-ok' : 'bg-danger'
              }`}
              style={{ transform: `scaleX(${grown ? Math.max(0, Math.min(100, score ?? 0)) / 100 : 0})` }}
            />
          </div>

          {!isHistoryView && <Rubric t={t} latest={latest} grown={grown} />}

          <p className="caption-5 mt-6 text-ink-3">
            {t('revisions')}：{revisions}
          </p>
          {finalFailed && <p className="caption-2 mt-2 text-warn">{t('qcFailNote').replace('{n}', String(revisions))}</p>}

          {hasDiff && (
            <button
              type="button"
              onClick={() => setShowDiff((value) => !value)}
              aria-expanded={showDiff}
              className="caption-4 mt-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-ink-3 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink"
            >
              <Glyph as={ArrowsLeftRight} size={16} />
              {showDiff ? t('diffHide') : t('diffToggle')}
            </button>
          )}
        </Reveal>
      </div>

      <div className="lg:col-span-6 lg:col-start-7">
        {!isHistoryView && qcHistory.length > 0 && (
          <Reveal delay={60}>
            <h3 className="caption-4 text-ink-3">{t('qcHistory')}</h3>
            <ul className="mt-2">
              {qcHistory.map((entry, index) => (
                <li key={index} className="border-t border-line py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="caption-5 text-ink-3">
                      {t('qcRound')} {index + 1} {t('qcRoundSuffix')}
                    </span>
                    <span className="caption-4 font-mono text-ink-2 tabular-nums">
                      {formatNumber(entry.score)} / 100
                    </span>
                  </div>
                  <p className={`caption-5 mt-1 ${entry.verdict === 'pass' ? 'text-ok' : 'text-danger'}`}>
                    {entry.verdict === 'pass' ? t('pass') : t('fail')}
                  </p>
                  <p className="caption-5 mt-1 whitespace-pre-wrap text-pretty text-ink-3">{entry.feedback}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        {showDiff && (
          <div className="mt-6 rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="caption-5 text-ink-3">
                {diffParts.some((part) => part.kind !== 'same')
                  ? t('diffNote')
                      .replace('{added}', String(diffStat.added))
                      .replace('{removed}', String(diffStat.removed))
                  : t('diffEmpty')}
              </p>
              <div className="caption-5 flex items-center gap-3 text-ink-3">
                <span>
                  <span className="diff-added rounded px-1">+</span> {t('diffAdded')}
                </span>
                <span>
                  <span className="diff-removed rounded px-1">-</span> {t('diffRemoved')}
                </span>
              </div>
            </div>
            <p className="body-6 mt-3 whitespace-pre-wrap leading-7">
              {diffParts.map((part, index) => (
                <span
                  key={`${part.kind}-${index}`}
                  className={part.kind === 'added' ? 'diff-added' : part.kind === 'removed' ? 'diff-removed' : 'diff-same'}
                >
                  {part.value}
                </span>
              ))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
