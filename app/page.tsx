'use client';

import { useEffect, useRef, useState } from 'react';
import { extractFileText, FileImportError, REFERENCE_CHAR_LIMIT } from '../lib/import-file';
import { keywordScore } from '../lib/retrieve';
import {
  AGENT_IDS,
  AGENT_LABEL,
  EXAMPLES,
  EXPERT_AGENTS,
  STATUS_LABEL,
  TEXT,
  type AgentId,
  type AgentName,
  type AgentStatus,
  type Lang,
} from './copy';
import type { ExpertResult, HistoryItem, QualityOutcome, Subtask } from './types';
import { copyText, countCharacters } from './format';
import {
  DEFAULT_PLUGIN_STATE,
  MAX_IMPORTED_PLUGINS,
  loadImportedManifests,
  loadPluginState,
  saveImportedManifests,
  savePluginState,
  validateManifest,
  type BuiltinPluginId,
  type PluginManifest,
  type PluginState,
} from '../lib/plugins';
import { TASK_TEMPLATES, type TaskTemplate } from '../lib/task-templates';
import Experts from './components/experts';
import Flow from './components/flow';
import Hero from './components/hero';
import HistoryTimeline from './components/history-timeline';
import PluginCenter from './components/plugin-center';
import Results from './components/results';
import Scenarios from './components/scenarios';
import SiteFooter from './components/site-footer';
import SiteNav from './components/site-nav';
import Tagline from './components/tagline';
import TaskPanel from './components/task-panel';

const HISTORY_KEY = 'chuanzhibei-history';
const HISTORY_LIMIT = 10;
const MANIFEST_MAX_BYTES = 64 * 1024;

function initialStatus(): Record<AgentId, { status: AgentStatus; detail: string }> {
  const out = {} as Record<AgentId, { status: AgentStatus; detail: string }>;
  AGENT_IDS.forEach((id) => {
    out[id] = { status: 'waiting', detail: '' };
  });
  return out;
}

function isHistoryItem(value: unknown): value is HistoryItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.task === 'string' &&
    typeof item.final === 'string' &&
    typeof item.score === 'number' &&
    typeof item.revisions === 'number' &&
    typeof item.elapsed === 'number' &&
    typeof item.time === 'string'
  );
}

// 过往任务召回：按关键词重合度找最相似的一条历史任务
function findRelevantHistory(task: string, items: HistoryItem[]): HistoryItem | null {
  let best: HistoryItem | null = null;
  let bestScore = 0;
  for (const item of items) {
    const score = keywordScore(task, item.task);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore > 0 ? best : null;
}

export default function Home() {
  const [lang, setLang] = useState<Lang>('zh');
  const [task, setTask] = useState('');
  const [plan, setPlan] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [results, setResults] = useState<ExpertResult[]>([]);
  const [quality, setQuality] = useState<QualityOutcome | null>(null);
  const [agentStatus, setAgentStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [resultTask, setResultTask] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [copiedFinal, setCopiedFinal] = useState(false);
  const [reference, setReference] = useState('');
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState('');
  const [selectedExperts, setSelectedExperts] = useState<Record<AgentName, boolean>>({
    research: true,
    writer: true,
    coder: true,
  });
  const [pluginState, setPluginState] = useState<PluginState>(DEFAULT_PLUGIN_STATE);
  const [importedManifests, setImportedManifests] = useState<PluginManifest[]>([]);
  const [pluginImportError, setPluginImportError] = useState('');
  const [pluginsLoaded, setPluginsLoaded] = useState(false);

  const startedAtRef = useRef(0);
  const activeTaskRef = useRef('');
  const lastRunConfigRef = useRef<{ task: string; reference: string; experts: AgentName[] }>({
    task: '',
    reference: '',
    experts: ['research', 'writer', 'coder'],
  });
  const doneHandledRef = useRef(false);
  const copyTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelRef = useRef(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('lang');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 本地语言偏好只能在挂载后读取
      if (saved === 'zh' || saved === 'en') setLang(saved);
    } catch {
      // localStorage unavailable: keep default Chinese.
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- 本地历史只能在挂载后读取
          setHistory(parsed.filter(isHistoryItem).slice(0, HISTORY_LIMIT));
        }
      }
    } catch {
      // Ignore invalid or unavailable storage.
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // History is optional; the app still works when storage is full.
    }
  }, [history, historyLoaded]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 插件状态存在本机，只能在挂载后读取
    setPluginState(loadPluginState());
    setImportedManifests(loadImportedManifests());
    setPluginsLoaded(true);
  }, []);

  useEffect(() => {
    if (pluginsLoaded) savePluginState(pluginState);
  }, [pluginState, pluginsLoaded]);

  useEffect(() => {
    if (pluginsLoaded) saveImportedManifests(importedManifests);
  }, [importedManifests, pluginsLoaded]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  function toggleLang() {
    const next: Lang = lang === 'zh' ? 'en' : 'zh';
    setLang(next);
    try {
      window.localStorage.setItem('lang', next);
    } catch {
      // ignore storage errors
    }
  }

  const t = (key: string) => TEXT[lang][key] ?? TEXT.zh[key] ?? key;
  const agentLabel = (id: AgentId) => AGENT_LABEL[lang][id] ?? AGENT_LABEL.zh[id] ?? id;
  const statusLabel = (status: AgentStatus) => STATUS_LABEL[lang][status] ?? STATUS_LABEL.zh[status] ?? status;

  function scrollToTask() {
    const section = document.getElementById('task');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => {
      document.getElementById('task-input')?.focus({ preventScroll: true });
    }, reduced ? 0 : 420);
  }

  function handleEvent(ev: Record<string, unknown>) {
    if (ev.type === 'stage') {
      const agent = ev.agent as AgentId;
      const status = ev.status as AgentStatus;
      const detail = typeof ev.detail === 'string' ? ev.detail : '';
      setAgentStatus((prev) => ({ ...prev, [agent]: { status, detail } }));
    } else if (ev.type === 'plan') {
      const p = ev.plan as { plan: string; subtasks: Subtask[] };
      setPlan(p.plan || '');
      setSubtasks(p.subtasks || []);
    } else if (ev.type === 'done') {
      const p = ev.plan as { plan: string; subtasks: Subtask[] };
      setPlan(p.plan || '');
      setSubtasks(p.subtasks || []);
      setResults((ev.results as ExpertResult[]) || []);
      const nextQuality = (ev.quality as QualityOutcome) || null;
      setQuality(nextQuality);

      const finishedElapsed = Number(((Date.now() - startedAtRef.current) / 1000).toFixed(1));
      setElapsed(finishedElapsed);
      setResultTask(activeTaskRef.current);
      setRetryable(false);

      if (nextQuality && !doneHandledRef.current) {
        doneHandledRef.current = true;
        const lastQc = nextQuality.qcHistory[nextQuality.qcHistory.length - 1];
        const record: HistoryItem = {
          task: activeTaskRef.current,
          final: nextQuality.final,
          score: lastQc?.score ?? 0,
          revisions: nextQuality.revisions,
          elapsed: finishedElapsed,
          time: new Date().toISOString(),
        };
        setHistory((prev) => [record, ...prev].slice(0, HISTORY_LIMIT));
      }
    } else if (ev.type === 'error') {
      setError(typeof ev.error === 'string' ? ev.error : t('errorTitle'));
      setElapsed(Number(((Date.now() - startedAtRef.current) / 1000).toFixed(1)));
      setRetryable(true);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportNotice('');
    try {
      const text = await extractFileText(file);
      setReference(text);
      if (Array.from(text).length > REFERENCE_CHAR_LIMIT) {
        setImportNotice(t('importTooLong'));
      }
    } catch (e) {
      const kind = e instanceof FileImportError ? e.kind : 'parse-failed';
      const key =
        kind === 'unsupported'
          ? 'importErrorUnsupported'
          : kind === 'too-large'
            ? 'importErrorTooLarge'
            : kind === 'no-text'
              ? 'importErrorNoText'
              : 'importErrorParseFailed';
      setImportNotice(t(key));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleImportManifest(file: File) {
    setPluginImportError('');
    if (file.size > MANIFEST_MAX_BYTES) {
      setPluginImportError(t('pluginImportInvalid'));
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setPluginImportError(t('pluginImportInvalidJson'));
      return;
    }
    const manifest = validateManifest(parsed);
    if (!manifest) {
      setPluginImportError(t('pluginImportInvalid'));
      return;
    }
    if (importedManifests.some((item) => item.id === manifest.id)) {
      setPluginImportError(t('pluginImportDuplicate'));
      return;
    }
    if (importedManifests.length >= MAX_IMPORTED_PLUGINS) {
      setPluginImportError(t('pluginImportTooMany'));
      return;
    }
    setImportedManifests((prev) => [...prev, manifest]);
  }

  function cancelRun() {
    cancelRef.current = true;
    abortRef.current?.abort();
    setLoading(false);
    setError('');
    setCancelled(true);
  }

  async function executeTask(taskToRun: string, options?: { reference: string; experts: AgentName[] }) {
    const cleanTask = taskToRun.trim();
    if (!cleanTask) {
      setError(t('enterTaskFirst'));
      return;
    }
    const runExperts =
      options?.experts ??
      EXPERT_AGENTS.filter((agent) => selectedExperts[agent]);
    if (runExperts.length === 0) {
      setError(t('selectExpert'));
      return;
    }
    const runReference = (options?.reference ?? reference).trim();
    if (Array.from(runReference).length > REFERENCE_CHAR_LIMIT) {
      setError(t('importTooLong'));
      return;
    }
    const recalled = findRelevantHistory(cleanTask, history);
    const historyRef = recalled ? recalled.final.slice(0, 2000) : '';

    startedAtRef.current = Date.now();
    activeTaskRef.current = cleanTask;
    lastRunConfigRef.current = { task: cleanTask, reference: runReference, experts: runExperts };
    doneHandledRef.current = false;
    cancelRef.current = false;
    setCancelled(false);
    abortRef.current = new AbortController();

    setLoading(true);
    setError('');
    setRetryable(false);
    setPlan('');
    setSubtasks([]);
    setResults([]);
    setQuality(null);
    setAgentStatus(initialStatus());
    setElapsed(null);
    setResultTask(cleanTask);
    setSelectedHistory(null);

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: cleanTask,
          reference: runReference,
          experts: runExperts,
          historyRef,
        }),
        signal: abortRef.current?.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('errorTitle'));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          handleEvent(JSON.parse(line));
        }
      }
    } catch (e) {
      if (cancelRef.current) {
        // 用户主动取消：不报错误、不重试，状态停在当前阶段
        setError('');
        setRetryable(false);
      } else {
        setError(e instanceof Error ? e.message : t('errorTitle'));
        setElapsed(Number(((Date.now() - startedAtRef.current) / 1000).toFixed(1)));
        setRetryable(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function useTemplate(template: TaskTemplate) {
    const nextTask = template.task[lang];
    setTask(nextTask);
    setSelectedHistory(null);
    const experts = EXPERT_AGENTS.filter((agent) => selectedExperts[agent]);
    void executeTask(nextTask, { reference, experts });
  }

  function selectHistory(item: HistoryItem) {
    setSelectedHistory(item);
    setTask(item.task);
    setError('');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      document.getElementById('result')?.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'start',
      });
    }, 50);
  }

  function deleteHistory(index: number) {
    const removed = history[index];
    setHistory((prev) => prev.filter((_, i) => i !== index));
    if (selectedHistory === removed) setSelectedHistory(null);
  }

  function clearHistory() {
    setHistory([]);
    setSelectedHistory(null);
  }

  async function handleCopyFinal() {
    const text = selectedHistory ? selectedHistory.final : quality?.final ?? '';
    if (!text) return;
    if (await copyText(text)) {
      setCopiedFinal(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedFinal(false), 1800);
    }
  }

  function handleExport() {
    if (!pluginState['markdown-export']) return;
    if (!selectedHistory && !quality) return;
    const exportTask = selectedHistory ? selectedHistory.task : resultTask;
    const exportFinal = selectedHistory ? selectedHistory.final : quality?.final ?? '';
    const exportElapsed = selectedHistory ? selectedHistory.elapsed : elapsed ?? 0;
    const exportRevisions = selectedHistory ? selectedHistory.revisions : quality?.revisions ?? 0;
    const qcLines = selectedHistory
      ? [`- ${t('metricScore')}: ${selectedHistory.score} / 100 (${selectedHistory.score >= 80 ? t('pass') : t('fail')})`]
      : (quality?.qcHistory ?? []).map(
          (q, i) =>
            `- ${t('qcRound')} ${i + 1} ${t('qcRoundSuffix')}：${q.score} ${t('scoreSuffix')}，${q.verdict === 'pass' ? t('pass') : t('fail')}`,
        );
    const markdown = [
      `# ${t('resultTitle')}`,
      '',
      `## ${t('resultTaskLabel')}`,
      exportTask,
      '',
      `## ${t('resultTitle')}`,
      exportFinal,
      '',
      `## ${t('qcHistory')}`,
      ...qcLines,
      '',
      `## ${t('revisions')}`,
      String(exportRevisions),
      '',
      `## ${t('metricElapsed')}`,
      `${exportElapsed.toFixed(1)} ${t('secondsUnit')}`,
      '',
    ].join('\n');

    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `多智能体协作台-${date}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const activeAgentCount = AGENT_IDS.filter((id) => agentStatus[id].status !== 'inactive').length;
  const doneAgentCount = AGENT_IDS.filter((id) => agentStatus[id].status === 'done').length;
  const overallPercent = activeAgentCount > 0 ? Math.round((doneAgentCount / activeAgentCount) * 100) : 0;
  const lastQc = quality && quality.qcHistory.length > 0 ? quality.qcHistory[quality.qcHistory.length - 1] : null;
  const researchWriterChars = results
    .filter((r) => r.status === 'done' && (r.agent === 'research' || r.agent === 'writer'))
    .reduce((sum, r) => sum + countCharacters(r.output), 0);

  const shownFinal = selectedHistory ? selectedHistory.final : quality?.final ?? '';
  const shownScore = selectedHistory ? selectedHistory.score : lastQc?.score ?? null;
  const shownScorePass = selectedHistory ? selectedHistory.score >= 80 : lastQc?.verdict === 'pass';
  const shownElapsed = selectedHistory ? selectedHistory.elapsed : elapsed;
  const shownFinalChars = shownFinal ? countCharacters(shownFinal) : 0;
  const shownRevisions = selectedHistory ? selectedHistory.revisions : quality?.revisions ?? 0;
  const finalFailed = !selectedHistory && quality?.finalVerdict === 'fail';
  const hasResult = Boolean(selectedHistory || quality);

  return (
    <>
      <SiteNav t={t} langLabel={t('langToggle')} onToggleLang={toggleLang} />
      <main id="main" className="relative z-10">
        <Hero t={t} agentLabel={agentLabel} onStart={scrollToTask} />

        <TaskPanel
          t={t}
          lang={lang}
          examples={EXAMPLES[lang]}
          templates={TASK_TEMPLATES}
          templatesEnabled={pluginState['task-templates']}
          task={task}
          onTaskChange={(value) => {
            setTask(value);
            setCancelled(false);
          }}
          reference={reference}
          onReferenceChange={(value) => {
            setReference(value);
            setImportNotice('');
          }}
          importNotice={importNotice}
          importing={importing}
          onImportFile={handleImportFile}
          fileInputRef={fileInputRef}
          selectedExperts={selectedExperts}
          onToggleExpert={(agent, next) => setSelectedExperts((prev) => ({ ...prev, [agent]: next }))}
          loading={loading}
          onSubmit={() => void executeTask(task)}
          onCancel={cancelRun}
          cancelled={cancelled}
          error={error}
          retryable={retryable}
          onRetry={() =>
            void executeTask(lastRunConfigRef.current.task, {
              reference: lastRunConfigRef.current.reference,
              experts: lastRunConfigRef.current.experts,
            })
          }
          onUseTemplate={useTemplate}
          agentLabel={agentLabel}
        />

        <Experts
          t={t}
          agentLabel={agentLabel}
          statusLabel={statusLabel}
          agentStatus={agentStatus}
          doneCount={doneAgentCount}
          activeCount={activeAgentCount}
          overallPercent={overallPercent}
        />

        <Tagline t={t} />

        <Flow
          t={t}
          agentLabel={agentLabel}
          statusLabel={statusLabel}
          agentStatus={agentStatus}
          plan={plan}
          subtasks={subtasks}
        />

        <Results
          t={t}
          hasResult={hasResult}
          loading={loading}
          isHistoryView={Boolean(selectedHistory)}
          task={selectedHistory ? selectedHistory.task : resultTask}
          final={shownFinal}
          score={shownScore}
          scorePass={shownScorePass}
          elapsed={shownElapsed}
          characters={shownFinalChars}
          researchWriterChars={researchWriterChars}
          revisions={shownRevisions}
          usage={selectedHistory ? undefined : quality?.usage}
          qcHistory={selectedHistory ? [] : quality?.qcHistory ?? []}
          finalFailed={finalFailed}
          copiedFinal={copiedFinal}
          onCopy={() => void handleCopyFinal()}
          onExport={handleExport}
          exportEnabled={pluginState['markdown-export']}
          results={selectedHistory ? [] : results}
          agentLabel={agentLabel}
          statusLabel={statusLabel}
          onStart={scrollToTask}
        />

        <HistoryTimeline
          t={t}
          lang={lang}
          history={history}
          onSelect={selectHistory}
          onDelete={deleteHistory}
          onClear={clearHistory}
        />

        <Scenarios t={t} />

        <PluginCenter
          t={t}
          lang={lang}
          state={pluginState}
          onToggle={(id: BuiltinPluginId, next: boolean) =>
            setPluginState((prev) => ({ ...prev, [id]: next }))
          }
          imported={importedManifests}
          importError={pluginImportError}
          onImport={(file) => void handleImportManifest(file)}
          onRemoveImported={(id) =>
            setImportedManifests((prev) => prev.filter((item) => item.id !== id))
          }
        />
      </main>
      <SiteFooter t={t} />
    </>
  );
}
