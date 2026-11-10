'use client';

import { useEffect, useRef, useState } from 'react';
import { extractFileText, FileImportError, isImageFile, REFERENCE_CHAR_LIMIT } from '../lib/import-file';
import { ocrImage } from '../lib/ocr-client';
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
import type {
  Attachment,
  ExpertResult,
  HistoryItem,
  QualityOutcome,
  RunSnapshot,
  SourcesState,
  Subtask,
  ToolTrace,
  WebSource,
} from './types';
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
import AgentDag from './components/dag';
import Experts from './components/experts';
import Flow from './components/flow';
import QualityPanel from './components/quality-panel';
import ResultMeta from './components/result-meta';
import RunCompare from './components/run-compare';
import Hero from './components/hero';
import { BlurFade } from './components/magicui/blur-fade';
import { AnimatedGradientText } from './components/magicui/animated-gradient-text';
import HistoryTimeline from './components/history-timeline';
import PluginCenter from './components/plugin-center';
import Results from './components/results';
import Scenarios from './components/scenarios';
import SiteFooter from './components/site-footer';
import SiteNav from './components/site-nav';
import TaskPanel from './components/task-panel';

const HISTORY_KEY = 'chuanzhibei-history';
const HISTORY_LIMIT = 10;
const MANIFEST_MAX_BYTES = 64 * 1024;
const SECTION_IDS = ['intro', 'dispatch', 'experts', 'quality', 'result', 'epilogue'];

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

interface SpeechRecognitionLikeEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionLikeEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

let attachmentSeq = 0;

function nextAttachmentId(kind: 'img' | 'file'): string {
  attachmentSeq += 1;
  return `${kind}-${attachmentSeq}-${Math.random().toString(36).slice(2, 7)}`;
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [parsingCount, setParsingCount] = useState(0);
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [sources, setSources] = useState<WebSource[]>([]);
  const [sourcesState, setSourcesState] = useState<SourcesState>({ enabled: true, configured: true });
  const [tools, setTools] = useState<ToolTrace[]>([]);
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});
  const [retryingAgent, setRetryingAgent] = useState<AgentName | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [page, setPage] = useState(1);
  const [lastRun, setLastRun] = useState<RunSnapshot | null>(null);
  const [previousRun, setPreviousRun] = useState<RunSnapshot | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [shareLink, setShareLink] = useState('');
  const lastRunRef = useRef<RunSnapshot | null>(null);
  const langRef = useRef<Lang>(lang);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const attachmentsRef = useRef<Attachment[]>([]);

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
    const scope = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    const supported = Boolean(scope.SpeechRecognition ?? scope.webkitSpeechRecognition);
    const frame = requestAnimationFrame(() => setVoiceSupported(supported));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  /* 打开页面时：恢复上次两次运行的结果（供对比），并读分享链接里的任务文本 */
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem('cz-last-run');
        if (raw) {
          const parsed = JSON.parse(raw) as RunSnapshot;
          setLastRun(parsed);
          lastRunRef.current = parsed;
        }
        const rawPrevious = window.localStorage.getItem('cz-prev-run');
        if (rawPrevious) setPreviousRun(JSON.parse(rawPrevious) as RunSnapshot);
      } catch {
        // 本地状态坏了就当没有
      }
      const params = new URLSearchParams(window.location.search);
      const shared = params.get('task');
      if (shared) {
        setTask(shared);
        if (params.get('ref') === '1') {
          setImportNotice(TEXT[langRef.current].shareRefNote ?? TEXT.zh.shareRefNote);
        }
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

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

  /** 平滑滚到某一章（Magic UI 版不再有翻页系统，正常滚动） */
  function goToSection(next: number) {
    const index = Math.min(6, Math.max(1, next));
    setPage(index);
    const target = document.getElementById(SECTION_IDS[index - 1]);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 滚动反推当前章节：以视口 42% 处为基准，最后一节到底时强制算尾声
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const probe = window.innerHeight * 0.42;
      let current = 1;
      SECTION_IDS.forEach((id, index) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= probe) current = index + 1;
      });
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) current = SECTION_IDS.length;
      setPage((prev) => (prev === current ? prev : current));
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  /** 分享：只把任务文本编码进 URL；带参考资料时多一个 ref=1 标记，打开后提示重传。 */
  async function handleShare() {
    const hasReference = reference.trim().length > 0 || attachments.length > 0;
    const base = window.location.origin + window.location.pathname;
    const url = base + '?task=' + encodeURIComponent(task.trim()) + (hasReference ? '&ref=1' : '');
    setShareLink('');
    setShareNotice('');
    const ok = await copyText(url);
    setShareNotice(ok ? t('shareCopied') : t('shareFailed'));
    if (!ok) setShareLink(url);
  }

  function handleEvent(ev: Record<string, unknown>) {
    if (ev.type === 'stage') {
      const agent = ev.agent as AgentId;
      const status = ev.status as AgentStatus;
      const detail = typeof ev.detail === 'string' ? ev.detail : '';
      setAgentStatus((prev) => ({ ...prev, [agent]: { status, detail } }));
      if (status === 'running' || status === 'done') {
        if (agent === 'dispatcher') goToSection(2);
        else if (agent === 'research' || agent === 'writer' || agent === 'coder') goToSection(3);
        else if (agent === 'summarizer' || agent === 'qc' || agent === 'reviser') goToSection(4);
      }
    } else if (ev.type === 'plan') {
      const p = ev.plan as { plan: string; subtasks: Subtask[] };
      setPlan(p.plan || '');
      setSubtasks(p.subtasks || []);
    } else if (ev.type === 'done') {
      const p = ev.plan as { plan: string; subtasks: Subtask[] } | undefined;
      if (p?.plan) setPlan(p.plan);
      if (p?.subtasks?.length) setSubtasks(p.subtasks);
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
        const snapshot: RunSnapshot = {
          task: activeTaskRef.current,
          final: nextQuality.final,
          score: lastQc?.score ?? null,
          revisions: nextQuality.revisions,
          elapsed: finishedElapsed,
          time: new Date().toISOString(),
          breakdown: lastQc?.breakdown,
        };
        const previousSnapshot = lastRunRef.current;
        lastRunRef.current = snapshot;
        setLastRun(snapshot);
        setPreviousRun(previousSnapshot);
        try {
          window.localStorage.setItem('cz-last-run', JSON.stringify(snapshot));
          if (previousSnapshot) {
            window.localStorage.setItem('cz-prev-run', JSON.stringify(previousSnapshot));
          }
        } catch {
          // 存不下就不存
        }
        goToSection(5);
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
    } else if (ev.type === 'tool') {
      setTools((prev) => [
        ...prev,
        {
          name: typeof ev.name === 'string' ? ev.name : 'tool',
          via: ev.via === 'mcp' ? 'mcp' : ev.via === 'local' ? 'local' : 'none',
          ok: ev.ok === true,
          count: typeof ev.count === 'number' ? ev.count : 0,
          detail: typeof ev.detail === 'string' ? ev.detail : '',
          error: typeof ev.error === 'string' ? ev.error : undefined,
        },
      ]);
    } else if (ev.type === 'sources') {
      setSources(Array.isArray(ev.sources) ? (ev.sources as WebSource[]) : []);
      setSourcesState({ enabled: ev.enabled !== false, configured: ev.configured !== false });
    } else if (ev.type === 'expert') {
      const result = ev.result as ExpertResult | undefined;
      if (result) {
        setResults((prev) => [...prev.filter((item) => item.subtaskId !== result.subtaskId), result]);
      }
    } else if (ev.type === 'error') {
      setError(typeof ev.error === 'string' ? ev.error : t('errorTitle'));
      setElapsed(Number(((Date.now() - startedAtRef.current) / 1000).toFixed(1)));
      setRetryable(true);
    }
  }

  /** 上传文件：图片走 OCR，PDF / Word / 文本走本地解析；解析结果进参考资料，可删除。 */
  async function handleAddFiles(files: File[]) {
    setImportNotice('');
    setParsingCount((count) => count + files.length);
    for (const file of files) {
      try {
        if (isImageFile(file)) {
          const outcome = await ocrImage(file, lang);
          if (!outcome.text.trim()) {
            setImportNotice(t(outcome.error ? 'ocrFailed' : 'uploadNoText'));
            continue;
          }
          const thumb = await readThumb(file);
          const attachment: Attachment = {
            id: nextAttachmentId('img'),
            name: file.name,
            chars: Array.from(outcome.text.replace(/\s+/g, '')).length,
            text: outcome.text,
            kind: 'image',
            thumb,
          };
          setAttachments((prev) => [...prev, attachment]);
          setImportNotice(
            t('ocrExtracted').replace('{n}', String(attachment.chars)),
          );
          continue;
        }
        const text = (await extractFileText(file)).trim();
        if (!text) {
          setImportNotice(t('uploadNoText'));
          continue;
        }
        const attachment: Attachment = {
          id: nextAttachmentId('file'),
          name: file.name,
          chars: Array.from(text.replace(/\s+/g, '')).length,
          text,
          kind: 'file',
        };
        setAttachments((prev) => [...prev, attachment]);
      } catch (error) {
        const kind = error instanceof FileImportError ? error.kind : 'parse-failed';
        const key =
          kind === 'unsupported'
            ? 'uploadUnsupported'
            : kind === 'too-large'
              ? 'uploadTooLarge'
              : kind === 'no-text'
                ? 'uploadNoText'
                : 'uploadParseFailed';
        setImportNotice(t(key));
      }
    }
    setParsingCount((count) => Math.max(0, count - files.length));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }

  function readThumb(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  /** 语音输入：Web Speech API，浏览器不支持时按钮不出现。 */
  function toggleVoice() {
    if (voiceListening) {
      recognitionRef.current?.stop();
      setVoiceListening(false);
      return;
    }
    const scope = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = lang === 'en' ? 'en-US' : 'zh-CN';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event: SpeechRecognitionLikeEvent) => {
      const transcript = Array.from(event.results)
        .map((item) => item[0]?.transcript ?? '')
        .join('')
        .trim();
      if (transcript) setTask((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => {
      setImportNotice(t('voiceError'));
      setVoiceListening(false);
    };
    recognition.onend = () => setVoiceListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setVoiceListening(true);
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

  async function consumeStream(res: Response) {
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
    const attachmentText = attachmentsRef.current.map((item) => item.text).join('\n\n');
    const runReference = [options?.reference ?? reference, attachmentText]
      .filter((item) => item.trim().length > 0)
      .join('\n\n')
      .trim();
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
    setShareNotice('');
    setShareLink('');
    setRetryable(false);
    setPlan('');
    setSubtasks([]);
    setResults([]);
    setQuality(null);
    setAgentStatus(initialStatus());
    setElapsed(null);
    setResultTask(cleanTask);
    setSelectedHistory(null);
    setSources([]);
    setTools([]);
    setSourcesState({ enabled: searchEnabled, configured: true });
    setRetryCounts({});

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'run',
          task: cleanTask,
          reference: runReference,
          experts: runExperts,
          historyRef,
          lang,
          search: searchEnabled,
        }),
        signal: abortRef.current?.signal,
      });
      await consumeStream(res);
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

  /** 单专家重试：只把失败的那个专家重跑一遍，成功后继续汇总质检。 */
  async function retryExpert(agent: AgentName) {
    if (retryingAgent || (retryCounts[agent] ?? 0) >= 2) return;
    const failed = results.find((item) => item.agent === agent && item.status === 'failed');
    if (!failed) return;
    const subtask =
      subtasks.find((item) => item.id === failed.subtaskId) ?? {
        id: failed.subtaskId,
        agent,
        goal: failed.goal,
        deliverable: failed.goal,
      };
    setRetryCounts((prev) => ({ ...prev, [agent]: (prev[agent] ?? 0) + 1 }));
    setRetryingAgent(agent);
    setLoading(true);
    setError('');
    try {
      const combinedReference = [reference, attachmentsRef.current.map((item) => item.text).join('\n\n')]
        .filter((item) => item.trim().length > 0)
        .join('\n\n')
        .trim();
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'resume',
          task: resultTask || task,
          lang,
          experts: EXPERT_AGENTS.filter((name) => selectedExperts[name]),
          retryAgent: agent,
          retrySubtask: subtask,
          results,
          reference: combinedReference,
        }),
      });
      await consumeStream(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorTitle'));
    } finally {
      setLoading(false);
      setRetryingAgent(null);
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

  const pageLabels = [
    t('pageLabel1'),
    t('pageLabel2'),
    t('pageLabel3'),
    t('pageLabel4'),
    t('pageLabel5'),
    t('pageLabel6'),
  ];
  const pageBody = 'w-full';

  const pages = [
    <div key="page-1" className={pageBody}>
      <div data-stagger>
        <Hero t={t} />
      </div>
      <div data-stagger>
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
        attachments={attachments}
        onAddFiles={(files) => void handleAddFiles(files)}
        onRemoveAttachment={removeAttachment}
        parsingCount={parsingCount}
        notice={importNotice}
        fileInputRef={fileInputRef}
        searchEnabled={searchEnabled}
        onToggleSearch={setSearchEnabled}
        voiceSupported={voiceSupported}
        voiceListening={voiceListening}
        onToggleVoice={toggleVoice}
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
      </div>
      <div data-stagger>
        <Scenarios t={t} compact />
      </div>
    </div>,

    <div key="page-2" className={pageBody}>
      <div data-stagger>
        <PageHead title={t('pageTitle2')} hint={t('pageHint2')} />
      </div>
      <div data-stagger>
        <Flow
        t={t}
        agentLabel={agentLabel}
        statusLabel={statusLabel}
        agentStatus={agentStatus}
        plan={plan}
        subtasks={subtasks}
        tools={tools}
          loading={loading}
        />
      </div>
    </div>,

    <div key="page-3" className={pageBody}>
      <div data-stagger>
        <PageHead title={t('pageTitle3')} hint={t('pageHint3')} />
      </div>
      <div data-stagger>
        <AgentDag t={t} agentLabel={agentLabel} statusLabel={statusLabel} agentStatus={agentStatus} />
      </div>
      <div data-stagger>
        <Experts
        t={t}
        agentLabel={agentLabel}
        statusLabel={statusLabel}
        agentStatus={agentStatus}
        doneCount={doneAgentCount}
        activeCount={activeAgentCount}
        overallPercent={overallPercent}
        onRetryExpert={(agent) => void retryExpert(agent)}
        retryCounts={retryCounts}
          retryingAgent={retryingAgent}
        />
      </div>
    </div>,

    <div key="page-4" className={pageBody}>
      <div data-stagger>
        <PageHead title={t('pageTitle4')} hint={t('pageHint4')} />
      </div>
      <div data-stagger>
        <QualityPanel
        t={t}
        hasResult={hasResult}
        loading={loading}
        isHistoryView={Boolean(selectedHistory)}
        score={shownScore}
        scorePass={shownScorePass}
        qcHistory={selectedHistory ? [] : (quality?.qcHistory ?? [])}
        revisions={shownRevisions}
        finalFailed={finalFailed}
        draft={quality?.draft ?? ''}
        revised={quality?.revised ?? ''}
        />
      </div>
    </div>,

    <div key="page-5" className={pageBody}>
      <div data-stagger>
        <PageHead title={t('pageTitle5')} hint={t('pageHint5')} />
      </div>
      <div data-stagger className="min-h-0 flex-1">
        <Results
        t={t}
        hasResult={hasResult}
        loading={loading}
        isHistoryView={Boolean(selectedHistory)}
        task={selectedHistory ? selectedHistory.task : resultTask}
        final={shownFinal}
        copiedFinal={copiedFinal}
        onCopy={() => void handleCopyFinal()}
        onExport={handleExport}
        exportEnabled={pluginState['markdown-export']}
        onShare={() => void handleShare()}
        shareNotice={shareNotice}
        shareLink={shareLink}
        results={selectedHistory ? [] : results}
        agentLabel={agentLabel}
        statusLabel={statusLabel}
        onStart={() => goToSection(1)}
        compareOpen={compareOpen}
        onToggleCompare={() => setCompareOpen((value) => !value)}
      />

      {compareOpen && <RunCompare t={t} previous={previousRun} current={lastRun} />}
      </div>
    </div>,

    <div key="page-6" className={pageBody}>
      <div data-stagger>
        <PageHead title={t('pageTitle6')} hint={t('pageHint6')} />
      </div>
      <div data-stagger className={hasResult ? undefined : 'hidden'}>
        <ResultMeta
          t={t}
          isHistoryView={Boolean(selectedHistory)}
          elapsed={shownElapsed}
          characters={shownFinalChars}
          researchWriterChars={researchWriterChars}
          revisions={shownRevisions}
          usage={selectedHistory ? undefined : quality?.usage}
          sources={sources}
          sourcesState={sourcesState}
        />
      </div>
      <div data-stagger className="mt-6 min-h-0 flex-1 overflow-y-auto">
        <HistoryTimeline
          t={t}
          lang={lang}
          history={history}
          onSelect={selectHistory}
          onDelete={deleteHistory}
          onClear={clearHistory}
        />

        <div className={hasResult ? undefined : 'hidden'}>
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
        </div>

        <SiteFooter t={t} labels={pageLabels} onNavigate={goToSection} />
      </div>
    </div>,
  ];

  return (
    <>
      <SiteNav
        t={t}
        langLabel={t('langToggle')}
        onToggleLang={toggleLang}
        page={page}
        onNavigate={goToSection}
        labels={pageLabels}
      />
      <main id="main" className="relative z-10">
        {pages.map((node, index) => (
          <section
            key={index}
            id={SECTION_IDS[index]}
            aria-label={pageLabels[index]}
            className={`relative w-full px-6 py-14 lg:px-8 lg:py-16 ${index === 0 ? 'pt-24' : 'border-t border-white/[0.06]'}`}
          >
            <div className="mx-auto w-full max-w-6xl">
              <BlurFade>
                <Grow>{node}</Grow>
              </BlurFade>
            </div>
          </section>
        ))}
      </main>
    </>
  );
}

/** 内容高度平滑生长：空闲时紧凑，流式内容进来时高度跟着长，不跳变。 */
function Grow({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={{ height, transition: 'height 520ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      className="overflow-hidden"
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}

function PageHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-5 border-b border-line pb-3">
      <h2 className="heading-5 text-ink">
        <AnimatedGradientText>{title}</AnimatedGradientText>
      </h2>
      <p className="caption-5 mt-1 text-pretty text-ink-3">{hint}</p>
    </div>
  );
}
