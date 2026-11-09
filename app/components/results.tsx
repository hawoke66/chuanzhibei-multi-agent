'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CaretDown, Copy, Export } from '@phosphor-icons/react';
import type { AgentId, AgentStatus } from '../copy';
import type { ExpertResult, QcResult } from '../types';
import MarkdownView from '../markdown-view';
import { copyText, countCharacters, formatNumber, formatSeconds } from '../format';
import { Glyph, Reveal, RiseText, StarDot } from './ui';

/* 结果区：文档式长卷，不做卡片。
   左侧是成果正文与专家输出，右侧是质检读数；两栏不等宽，读数靠边对齐。 */

const EMPTY_LINK =
  'caption-4 inline-flex items-center gap-1.5 text-ink-3 transition-colors duration-300 ease-out-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function useTween(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const immediate = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(immediate);
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function TweenNum({ value, format = formatNumber }: { value: number; format?: (v: number) => string }) {
  const animated = useTween(value);
  return <>{format(animated)}</>;
}

const TEXT_BUTTON =
  'caption-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-ink-3 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';

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
        className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors duration-300 ease-out-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          <div className="pb-5">
            <pre className="body-6 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-void p-4 text-ink-2">
              {result.output}
            </pre>
            <button type="button" onClick={handleCopy} className={`${TEXT_BUTTON} mt-2`}>
              <Glyph as={Copy} size={16} />
              {copied ? t('copied') : result.agent === 'coder' ? t('copyCode') : t('copy')}
            </button>
          </div>
        ) : (
          <p className="caption-2 pb-5 text-danger">
            {t('errorTitle')}：{result.error}
          </p>
        ))}
    </li>
  );
}

function Rubric({
  t,
  latest,
  grown,
}: {
  t: (key: string) => string;
  latest: QcResult | undefined;
  grown: boolean;
}) {
  if (!latest?.breakdown) return null;
  const rows = [
    { key: 'rubricFacts', weight: '30%', value: latest.breakdown.facts },
    { key: 'rubricRelevance', weight: '30%', value: latest.breakdown.relevance },
    { key: 'rubricStructure', weight: '20%', value: latest.breakdown.structure },
    { key: 'rubricLanguage', weight: '20%', value: latest.breakdown.language },
  ];
  return (
    <ul className="mt-5 space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="caption-5 text-ink-3">
              {t(row.key)} <span className="font-mono tabular-nums">{row.weight}</span>
            </span>
            <span className="caption-4 font-mono text-ink-2 tabular-nums">{formatNumber(row.value)}</span>
          </div>
          <div className="mt-1.5 h-px w-full bg-line-2">
            <div
              className="h-px origin-left bg-accent/70 transition-transform duration-700 ease-out-soft"
              style={{
                transform: `scaleX(${grown ? Math.max(0, Math.min(100, row.value)) / 100 : 0})`,
                transitionDelay: `${rows.indexOf(row) * 90}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Results({
  t,
  hasResult,
  loading,
  isHistoryView,
  task,
  final,
  score,
  scorePass,
  elapsed,
  characters,
  researchWriterChars,
  revisions,
  usage,
  qcHistory,
  finalFailed,
  copiedFinal,
  onCopy,
  onExport,
  exportEnabled,
  results,
  agentLabel,
  statusLabel,
  onStart,
}: {
  t: (key: string) => string;
  hasResult: boolean;
  loading: boolean;
  isHistoryView: boolean;
  task: string;
  final: string;
  score: number | null;
  scorePass: boolean;
  elapsed: number | null;
  characters: number;
  researchWriterChars: number;
  revisions: number;
  usage?: { prompt: number; completion: number };
  qcHistory: QcResult[];
  finalFailed: boolean;
  copiedFinal: boolean;
  onCopy: () => void;
  onExport: () => void;
  exportEnabled: boolean;
  results: ExpertResult[];
  agentLabel: (id: AgentId) => string;
  statusLabel: (status: AgentStatus) => string;
  onStart: () => void;
}) {
  const latest = qcHistory.length > 0 ? qcHistory[qcHistory.length - 1] : undefined;
  const [grown, setGrown] = useState(false);

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

  return (
    <section id="result" className="relative mx-auto -mt-8 w-full max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="caption-4 text-ink-3">{t('resultKicker')}</p>
            <h2 className="heading-5 mt-2 text-ink">
              <RiseText text={t('resultTitle')} start={80} step={40} />
            </h2>
          </div>
          {hasResult && (
            <div className="flex items-center gap-2" aria-label={t('resultActionsLabel')}>
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
            </div>
          )}
        </div>
      </Reveal>

      {!hasResult && !loading && (
        <Reveal>
          <div className="mt-8 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="heading-5 text-ink">{t('resultEmptyTitle')}</p>
              <p className="body-6 mt-2 max-w-[420px] text-pretty text-ink-2">{t('resultEmptyDesc')}</p>
              <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-y border-line py-3">
                {[t('metricElapsed'), t('metricChars'), t('metricTokens'), t('metricScore')].map((label) => (
                  <div key={label}>
                    <dt className="caption-5 text-ink-3">{label}</dt>
                    <dd className="caption-2 mt-0.5 font-mono text-ink-3 tabular-nums">—</dd>
                  </div>
                ))}
              </dl>
              <button type="button" onClick={onStart} className={`${EMPTY_LINK} mt-4`}>
                {t('resultEmptyCta')}
                <Glyph as={ArrowRight} size={16} />
              </button>
            </div>
            <ol className="lg:col-span-4 lg:col-start-9">
              {[t('aiStep1'), t('aiStep2'), t('aiStep3')].map((step, index) => (
                <li key={step} className="flex items-baseline gap-3 border-t border-line py-3">
                  <span className="caption-5 font-mono text-ink-3 tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="caption-2 text-ink-2">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      )}

      {loading && !hasResult && (
        <div className="mt-10 grid gap-10 lg:grid-cols-12" aria-busy="true">
          <div className="lg:col-span-7">
            <p className="caption-4 text-ink-3">{t('resultLoadingTitle')}</p>
            <div className="mt-6 space-y-3" aria-hidden="true">
              <div className="h-3 w-1/2 rounded bg-raised" />
              <div className="h-2 w-full rounded bg-raised" />
              <div className="h-2 w-11/12 rounded bg-raised" />
              <div className="h-2 w-4/5 rounded bg-raised" />
              <div className="h-2 w-full rounded bg-raised" />
              <div className="h-2 w-3/5 rounded bg-raised" />
            </div>
          </div>
          <div className="lg:col-span-4 lg:col-start-9" aria-hidden="true">
            <div className="h-2 w-24 rounded bg-raised" />
            <div className="mt-4 h-8 w-32 rounded bg-raised" />
            <div className="mt-6 space-y-3">
              <div className="h-2 w-full rounded bg-raised" />
              <div className="h-2 w-full rounded bg-raised" />
            </div>
          </div>
        </div>
      )}

      {hasResult && (
        <article className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7 xl:col-span-8">
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="caption-5 text-ink-3">{t('resultTaskLabel')}</p>
              {isHistoryView && (
                <span className="caption-5 rounded border border-line-2 px-1.5 py-0.5 text-ink-3">
                  {t('historyBadge')}
                </span>
              )}
            </div>
            <p className="title-2 mt-1 text-pretty text-ink">{task}</p>

            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-y border-line py-3">
              <div>
                <dt className="caption-5 text-ink-3">{t('metricElapsed')}</dt>
                <dd className="caption-2 mt-0.5 font-mono text-ink-2 tabular-nums">
                  {elapsed === null ? '—' : <><TweenNum value={elapsed} format={formatSeconds} /> {t('secondsUnit')}</>}
                </dd>
              </div>
              <div>
                <dt className="caption-5 text-ink-3">{t('metricChars')}</dt>
                <dd className="caption-2 mt-0.5 font-mono text-ink-2 tabular-nums">
                  <TweenNum value={characters} />
                </dd>
              </div>
              {!isHistoryView && usage && (
                <div>
                  <dt className="caption-5 text-ink-3">{t('metricTokens')}</dt>
                  <dd className="caption-2 mt-0.5 font-mono text-ink-2 tabular-nums">
                    <TweenNum value={usage.prompt} /> + <TweenNum value={usage.completion} />
                  </dd>
                </div>
              )}
              {!isHistoryView && researchWriterChars > 0 && (
                <div>
                  <dt className="caption-5 text-ink-3">{t('researchWriterChars')}</dt>
                  <dd className="caption-2 mt-0.5 font-mono text-ink-2 tabular-nums">
                    <TweenNum value={researchWriterChars} />
                  </dd>
                </div>
              )}
              <div>
                <dt className="caption-5 text-ink-3">{t('metricScore')}</dt>
                <dd className="caption-2 mt-0.5 font-mono text-ink-2 tabular-nums">
                  {score === null ? '—' : <><TweenNum value={score} /> / 100</>}
                </dd>
              </div>
            </dl>

            <div className="doc-in mt-8">
              <MarkdownView text={final} copyLabel={t('copyCode')} copiedLabel={t('copied')} />
            </div>

            {finalFailed && (
              <p className="caption-2 mt-6 border-t border-line pt-4 text-warn">
                {t('qcFailNote').replace('{n}', String(revisions))}
              </p>
            )}

            <p className="caption-5 mt-6 text-ink-3">
              {t('revisions')}：{revisions}
            </p>

            {results.length > 0 && (
              <div className="mt-10">
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
            )}
          </div>

          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="border-t border-line pt-4">
              <p className="caption-5 text-ink-3">{t('metricScore')}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="heading-4 font-mono text-ink tabular-nums">
                  {score === null ? '—' : <TweenNum value={score} />}
                </span>
                <span className="caption-5 text-ink-3">/ 100</span>
                <span className={`caption-2 ${scorePass ? 'text-ok' : 'text-danger'}`}>
                  {scorePass ? t('pass') : t('fail')}
                </span>
              </p>
              <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-line-2">
                <div
                  className={`h-full origin-left rounded-full transition-transform duration-500 ease-out-soft ${
                    scorePass ? 'bg-ok' : 'bg-danger'
                  }`}
                  style={{ transform: `scaleX(${grown ? Math.max(0, Math.min(100, score ?? 0)) / 100 : 0})` }}
                />
              </div>

              {!isHistoryView && <Rubric t={t} latest={latest} grown={grown} />}

              {!isHistoryView && qcHistory.length > 0 && (
                <>
                  <h3 className="caption-4 mt-8 text-ink-3">{t('qcHistory')}</h3>
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
                </>
              )}
            </div>
          </aside>
        </article>
      )}
    </section>
  );
}
