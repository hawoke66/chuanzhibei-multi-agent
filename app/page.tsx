'use client';

import { useEffect, useRef, useState } from 'react';
import { extractFileText, FileImportError, REFERENCE_CHAR_LIMIT } from '../lib/import-file';

type AgentName = 'research' | 'writer' | 'coder';
type AgentId = 'dispatcher' | AgentName | 'summarizer' | 'qc' | 'reviser';
type AgentStatus = 'waiting' | 'running' | 'done' | 'failed' | 'inactive';
type Lang = 'zh' | 'en';
type ExpertSelection = Record<AgentName, boolean>;

interface Subtask {
  id: string;
  agent: AgentName;
  goal: string;
  deliverable: string;
}

interface ExpertResult {
  subtaskId: string;
  agent: AgentName;
  goal: string;
  output: string;
  status: 'done' | 'failed';
  error?: string;
}

interface QcResult {
  score: number;
  verdict: 'pass' | 'fail';
  feedback: string;
}

interface QualityOutcome {
  draft: string;
  qcHistory: QcResult[];
  revisions: number;
  final: string;
  finalVerdict?: 'pass' | 'fail' | 'none';
}

interface HistoryItem {
  task: string;
  final: string;
  score: number;
  revisions: number;
  elapsed: number;
  time: string;
}

const AGENT_IDS: AgentId[] = ['dispatcher', 'research', 'writer', 'coder', 'summarizer', 'qc', 'reviser'];
const HISTORY_KEY = 'chuanzhibei-history';
const HISTORY_LIMIT = 10;

// Interface copy: Chinese is complete. Missing English entries fall back to
// Chinese, so the toggle never renders a blank label.
const AGENT_LABEL: Record<Lang, Partial<Record<AgentId, string>>> = {
  zh: {
    dispatcher: '调度官',
    research: '调研员',
    writer: '文案官',
    coder: '代码手',
    summarizer: '汇总官',
    qc: '质检官',
    reviser: '修订官',
  },
  en: {
    dispatcher: 'Coordinator',
    research: 'Researcher',
    writer: 'Copywriter',
    coder: 'Developer',
    summarizer: 'Summarizer',
    qc: 'QA Reviewer',
    reviser: 'Reviser',
  },
};

const STATUS_LABEL: Record<Lang, Partial<Record<AgentStatus, string>>> = {
  zh: {
    waiting: '等待',
    running: '进行中',
    done: '完成',
    failed: '失败',
    inactive: '未激活',
  },
  en: {
    waiting: 'Waiting',
    running: 'In progress',
    done: 'Done',
    failed: 'Failed',
    inactive: 'Inactive',
  },
};

const TEXT: Record<Lang, Partial<Record<string, string>>> = {
  zh: {
    title: '多智能体协作台',
    subtitle: '提交任务后，7 张状态卡会随执行进度实时更新。',
    taskPlaceholder: '输入一个任务，例如：调研多智能体协作并写一段介绍',
    submit: '提交任务',
    running: '执行中…看上方状态卡',
    enterTaskFirst: '请先输入任务',
    executionFailed: '执行失败',
    finalResult: '最终成果',
    revisions: '修订轮数',
    qcHistory: '质检记录',
    qcRound: '第',
    qcRoundSuffix: '次质检',
    scoreSuffix: '分',
    pass: '通过',
    fail: '不通过',
    qcFailNote: '质检未通过，以上为第 {n} 轮修订稿，可重试或调整任务',
    feedback: '意见',
    plan: '调度计划',
    expertOutput: '专家输出',
    goal: '目标',
    deliverable: '交付物',
    failedWith: '执行失败：',
    langButton: 'English',
    sampleTasks: '示例任务',
    copy: '复制',
    copied: '已复制',
    exportMarkdown: '导出 Markdown',
    history: '历史记录',
    clearHistory: '清空历史',
    elapsed: '总耗时',
    seconds: '秒',
    characters: '字数',
    qcScore: '质检分数',
    expand: '展开',
    collapse: '收起',
    copyCode: '复制代码',
    code: '代码',
    retry: '重新提交',
    aiHighlights: 'AI 技术亮点',
    progress: '总体进度',
    researchWriterChars: '调研与文案字数',
    delete: '删除',
    taskLabel: '任务',
    aiStep1: '调度拆分',
    aiStep2: '专家并行',
    aiStep3: '汇总',
    aiStep4: '质检',
    aiStep5: '最多 2 轮修订',
    aiNotes: '调度只拆分不写正文、调研给事实不编造、质检 ≥80 分才通过、Key 只读环境变量不进代码仓库。',
    reference: '参考资料（可选）',
    referencePlaceholder: '粘贴一段参考文字，调研会优先用这里的事实',
    importFile: '导入文件',
    importParsing: '解析中…',
    importErrorUnsupported: '仅支持 TXT、Markdown 或有文字层的 PDF，请改用粘贴',
    importErrorTooLarge: '文件超过 5MB 上限，请拆分内容或改用粘贴',
    importErrorNoText: '这个 PDF 提取不到文字（可能是扫描件），请改用粘贴',
    importErrorParseFailed: '文件解析失败，请检查文件或改用粘贴',
    importTooLong: '参考资料超过 1 万字上限，请删减后再提交',
    experts: '专家',
    selectExpert: '请至少选择一个专家',
  },
  en: {
    title: 'Multi-Agent Workspace',
    subtitle: 'Submit a task and all seven status cards will update live as work progresses.',
    taskPlaceholder: 'Enter a task, e.g. research multi-agent collaboration and draft an introduction',
    submit: 'Submit task',
    running: 'Running… see the status cards above',
    enterTaskFirst: 'Please enter a task',
    executionFailed: 'Execution failed',
    finalResult: 'Final output',
    revisions: 'Revision rounds',
    qcHistory: 'QA history',
    qcRound: 'Round',
    qcRoundSuffix: 'QA check',
    scoreSuffix: 'pts',
    pass: 'Pass',
    fail: 'Fail',
    qcFailNote: 'QC did not pass. Above is the draft after {n} revision round(s). You can retry or adjust the task.',
    feedback: 'Feedback',
    plan: 'Execution plan',
    expertOutput: 'Specialist output',
    goal: 'Goal',
    deliverable: 'Deliverable',
    failedWith: 'Failed: ',
    langButton: '中文',
    sampleTasks: 'Sample tasks',
    copy: 'Copy',
    copied: 'Copied',
    exportMarkdown: 'Export Markdown',
    history: 'History',
    clearHistory: 'Clear history',
    elapsed: 'Elapsed',
    seconds: 's',
    characters: 'Characters',
    qcScore: 'QC score',
    expand: 'Expand',
    collapse: 'Collapse',
    copyCode: 'Copy code',
    code: 'Code',
    retry: 'Retry',
    aiHighlights: 'AI highlights',
    progress: 'Overall progress',
    researchWriterChars: 'Research + copy characters',
    delete: 'Delete',
    taskLabel: 'Task',
    aiStep1: 'Dispatch & split',
    aiStep2: 'Parallel experts',
    aiStep3: 'Synthesis',
    aiStep4: 'Quality check',
    aiStep5: 'Up to 2 revisions',
    aiNotes: 'The coordinator only splits tasks; research provides facts without fabrication; QC requires a score of 80+ to pass; the API key is read from environment variables only and never committed to the repository.',
    reference: 'Reference (optional)',
    referencePlaceholder: 'Paste reference text; research will prioritize facts from it',
    importFile: 'Import file',
    importParsing: 'Parsing…',
    importErrorUnsupported: 'Only TXT, Markdown, or PDF with a text layer is supported. Paste the text instead.',
    importErrorTooLarge: 'File exceeds the 5MB limit. Split the content or paste it instead.',
    importErrorNoText: 'No selectable text found in this PDF (it may be a scan). Paste the text instead.',
    importErrorParseFailed: 'Failed to parse the file. Check the file or paste the text instead.',
    importTooLong: 'Reference exceeds the 10,000-character limit. Trim it before submitting.',
    experts: 'Experts',
    selectExpert: 'Select at least one expert',
  },
};

const EXAMPLES: Record<Lang, { label: string; task: string }[]> = {
  zh: [
    { label: '多智能体协作介绍', task: '调研多智能体协作并写一段介绍' },
    { label: 'AI 智能体入门指南', task: '调研 AI 智能体并写一份入门指南' },
    { label: 'Python 爬虫学习路线', task: '写一个 Python 爬虫学习路线并附代码示例' },
  ],
  en: [
    { label: 'Multi-agent intro', task: 'Research multi-agent collaboration and write an introduction.' },
    { label: 'AI agent guide', task: 'Research AI agents and write a beginner guide.' },
    { label: 'Python scraping path', task: 'Create a Python web scraping learning path with code examples.' },
  ],
};

const STATUS_STYLE: Record<AgentStatus, string> = {
  waiting: 'bg-slate-100 text-slate-500',
  running: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  done: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  inactive: 'bg-slate-50 text-slate-400',
};

function initialStatus(): Record<AgentId, { status: AgentStatus; detail: string }> {
  const out = {} as Record<AgentId, { status: AgentStatus; detail: string }>;
  AGENT_IDS.forEach((id) => { out[id] = { status: 'waiting', detail: '' }; });
  return out;
}

function countCharacters(text: string): number {
  return Array.from(text.replace(/\s+/g, '')).length;
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

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to a selected textarea below.
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
      <p className="text-xs text-indigo-200/80">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function ExpertOutputCard({
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
    <article className="rounded-2xl border border-white/20 bg-slate-950 p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{agentLabel(result.agent)}</h3>
            {result.agent === 'coder' && (
              <span className="rounded-full border border-violet-300/40 bg-violet-400/15 px-2 py-0.5 text-[11px] font-medium text-violet-200">
                {t('code')}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-indigo-200">{t('goal')}：{result.goal}</p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          <span className={`rounded-full px-2.5 py-0.5 ${result.status === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {statusLabel(result.status)}
          </span>
          <span className="text-indigo-200/80">
            {countCharacters(result.output)} {t('characters')}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="text-xs font-medium text-indigo-200 transition hover:text-white"
        >
          {open ? t('collapse') : t('expand')}
        </button>
        {open && result.status === 'done' && (
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white transition hover:bg-white/20"
          >
            {copied ? t('copied') : result.agent === 'coder' ? t('copyCode') : t('copy')}
          </button>
        )}
      </div>

      {open && (
        result.status === 'done' ? (
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-indigo-50">{result.output}</pre>
        ) : (
          <p className="mt-3 text-sm text-red-300">{t('failedWith')}{result.error}</p>
        )
      )}
    </article>
  );
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
  const [selectedExperts, setSelectedExperts] = useState<ExpertSelection>({
    research: true,
    writer: true,
    coder: true,
  });

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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('lang');
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
  const statusLabel = (s: AgentStatus) => STATUS_LABEL[lang][s] ?? STATUS_LABEL.zh[s] ?? s;

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
      setError(typeof ev.error === 'string' ? ev.error : t('executionFailed'));
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

  async function executeTask(
    taskToRun: string,
    options?: { reference: string; experts: AgentName[] }
  ) {
    const cleanTask = taskToRun.trim();
    if (!cleanTask) {
      setError(t('enterTaskFirst'));
      return;
    }
    const runExperts = options?.experts
      ?? (['research', 'writer', 'coder'] as AgentName[]).filter((agent) => selectedExperts[agent]);
    if (runExperts.length === 0) {
      setError(t('selectExpert'));
      return;
    }
    const runReference = (options?.reference ?? reference).trim();
    if (Array.from(runReference).length > REFERENCE_CHAR_LIMIT) {
      setError(t('importTooLong'));
      return;
    }

    startedAtRef.current = Date.now();
    activeTaskRef.current = cleanTask;
    lastRunConfigRef.current = { task: cleanTask, reference: runReference, experts: runExperts };
    doneHandledRef.current = false;

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
        body: JSON.stringify({ task: cleanTask, reference: runReference, experts: runExperts }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('executionFailed'));
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
      setError(e instanceof Error ? e.message : t('executionFailed'));
      setElapsed(Number(((Date.now() - startedAtRef.current) / 1000).toFixed(1)));
      setRetryable(true);
    } finally {
      setLoading(false);
    }
  }

  function selectHistory(item: HistoryItem) {
    setSelectedHistory(item);
    setTask(item.task);
    setError('');
    window.setTimeout(() => {
      document.getElementById('final-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (!selectedHistory && !quality) return;
    const exportTask = selectedHistory ? selectedHistory.task : resultTask;
    const exportFinal = selectedHistory ? selectedHistory.final : quality?.final ?? '';
    const exportElapsed = selectedHistory ? selectedHistory.elapsed : elapsed ?? 0;
    const exportRevisions = selectedHistory ? selectedHistory.revisions : quality?.revisions ?? 0;
    const qcLines = selectedHistory
      ? [`- ${t('qcScore')}: ${selectedHistory.score} / 100 (${selectedHistory.score >= 80 ? t('pass') : t('fail')})`]
      : (quality?.qcHistory ?? []).map((q, i) =>
          `- ${t('qcRound')} ${i + 1} ${t('qcRoundSuffix')}：${q.score} ${t('scoreSuffix')}，${q.verdict === 'pass' ? t('pass') : t('fail')}`
        );
    const markdown = [
      `# ${t('title')}`,
      '',
      `## ${t('taskLabel')}`,
      exportTask,
      '',
      `## ${t('finalResult')}`,
      exportFinal,
      '',
      `## ${t('qcHistory')}`,
      ...qcLines,
      '',
      `## ${t('revisions')}`,
      String(exportRevisions),
      '',
      `## ${t('elapsed')}`,
      `${exportElapsed.toFixed(1)} ${t('seconds')}`,
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
    <main className="relative mx-auto max-w-4xl space-y-8 px-6 py-10">
      <div className="relative z-10 space-y-8">
        <header className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
          <div />
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow">{t('title')}</h1>
            <p className="mt-2 text-indigo-200">{t('subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={toggleLang}
            className="justify-self-end rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-sm text-white backdrop-blur transition hover:bg-white/20"
          >
            {t('langButton')}
          </button>
        </header>

        <section className="space-y-3">
          <div className="flex flex-wrap justify-center gap-3">
            {AGENT_IDS.map((id) => (
              <article
                key={id}
                className="w-[calc(50%-6px)] rounded-2xl border border-white/20 bg-slate-950 p-4 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-white">{agentLabel(id)}</h2>
                  <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ${STATUS_STYLE[agentStatus[id].status]}`}>
                    {agentStatus[id].status === 'running' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />}
                    {statusLabel(agentStatus[id].status)}
                  </span>
                </div>
                {agentStatus[id].detail && <p className="mt-2 text-sm text-indigo-200">{agentStatus[id].detail}</p>}
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 shadow-lg">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-indigo-100">{t('progress')}</span>
              <span className="font-medium text-white">{doneAgentCount} / {activeAgentCount}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-500"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-indigo-100">{t('sampleTasks')}</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES[lang].map((example, index) => (
                <button
                  key={example.task}
                  type="button"
                  onClick={() => setTask(example.task)}
                  className="rounded-full border border-indigo-300/30 bg-indigo-500/10 px-3 py-1.5 text-sm text-indigo-100 shadow-sm transition hover:border-violet-300/50 hover:bg-violet-500/20 hover:text-white"
                >
                  <span className="mr-1.5 text-[11px] text-violet-300/90">0{index + 1}</span>
                  {example.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={4}
            placeholder={t('taskPlaceholder')}
            className="w-full rounded-2xl border border-white/20 bg-slate-950 p-4 text-white shadow-lg outline-none transition placeholder:text-indigo-200/70 focus:border-violet-300 focus:ring-2 focus:ring-violet-400/50"
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="reference-input" className="block text-sm font-medium text-indigo-100">
                {t('reference')}
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || importing}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-indigo-100 transition hover:bg-white/20 disabled:opacity-50"
              >
                {importing ? t('importParsing') : t('importFile')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportFile(file);
                }}
              />
            </div>
            <textarea
              id="reference-input"
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                setImportNotice('');
              }}
              rows={3}
              disabled={loading}
              placeholder={t('referencePlaceholder')}
              className="w-full rounded-2xl border border-white/20 bg-slate-950 p-4 text-sm text-white shadow-lg outline-none transition placeholder:text-indigo-200/60 focus:border-violet-300 focus:ring-2 focus:ring-violet-400/50 disabled:opacity-60"
            />
            {importNotice && <p className="text-sm text-amber-300">{importNotice}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-indigo-100">{t('experts')}</p>
            <div className="flex flex-wrap gap-2">
              {(['research', 'writer', 'coder'] as AgentName[]).map((agent) => (
                <label
                  key={agent}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-slate-950/80 px-3 py-1.5 text-sm text-indigo-100 transition hover:border-violet-300/40 hover:bg-slate-900"
                >
                  <input
                    type="checkbox"
                    checked={selectedExperts[agent]}
                    onChange={(e) =>
                      setSelectedExperts((prev) => ({ ...prev, [agent]: e.target.checked }))
                    }
                    disabled={loading}
                    className="h-4 w-4 accent-indigo-500"
                  />
                  {agentLabel(agent)}
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => executeTask(task)}
            disabled={loading || !task.trim()}
            className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 px-6 py-2.5 text-white shadow-lg transition hover:from-indigo-500 hover:to-violet-400 disabled:opacity-50"
          >
            {loading ? t('running') : t('submit')}
          </button>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/80 p-5 shadow-lg">
          <h2 className="text-lg font-semibold text-white">{t('aiHighlights')}</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-5">
            {[
              ['01', t('aiStep1')],
              ['02', t('aiStep2')],
              ['03', t('aiStep3')],
              ['04', t('aiStep4')],
              ['05', t('aiStep5')],
            ].map(([number, label]) => (
              <li key={number} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="text-xs font-semibold text-violet-300">{number}</span>
                <p className="mt-1 text-sm text-indigo-50">{label}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-indigo-200/75">{t('aiNotes')}</p>
        </section>

        {history.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white">{t('history')}</h2>
              <button
                type="button"
                onClick={clearHistory}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-indigo-100 transition hover:bg-white/20"
              >
                {t('clearHistory')}
              </button>
            </div>
            <ul className="space-y-2">
              {history.map((item, index) => (
                <li key={`${item.time}-${index}`} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => selectHistory(item)}
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950/80 p-3 text-left shadow-lg transition hover:border-violet-300/40 hover:bg-slate-900"
                  >
                    <p className="truncate text-sm font-medium text-white">{item.task}</p>
                    <p className="mt-1 text-xs text-indigo-200/80">
                      {new Date(item.time).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}
                      {' · '}{t('qcScore')} {item.score}
                      {' · '}{item.elapsed.toFixed(1)} {t('seconds')}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteHistory(index)}
                    aria-label={t('delete')}
                    title={t('delete')}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 text-lg text-indigo-200 transition hover:border-red-300/40 hover:bg-red-500/20 hover:text-white"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <section className="fade-in space-y-3 rounded-2xl bg-red-50 p-4 text-red-700">
            <p>{error}</p>
            {elapsed !== null && !quality && <p className="text-sm">{t('elapsed')}：{elapsed.toFixed(1)} {t('seconds')}</p>}
            {retryable && (
              <button
                type="button"
                onClick={() => executeTask(lastRunConfigRef.current.task, {
                  reference: lastRunConfigRef.current.reference,
                  experts: lastRunConfigRef.current.experts,
                })}
                disabled={loading}
                className="rounded-full border border-red-300 bg-white/70 px-4 py-1.5 text-sm font-medium text-red-700 transition hover:bg-white disabled:opacity-50"
              >
                {t('retry')}
              </button>
            )}
          </section>
        )}

        {hasResult && (
          <section id="final-result" className="fade-in space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{t('finalResult')}</h2>
                {selectedHistory && (
                  <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2.5 py-0.5 text-xs text-violet-200">
                    {t('history')}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyFinal}
                  className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm text-white transition hover:bg-white/20"
                >
                  {copiedFinal ? t('copied') : t('copy')}
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="rounded-full border border-indigo-300/30 bg-indigo-500/15 px-4 py-1.5 text-sm text-indigo-100 transition hover:bg-indigo-500/25"
                >
                  {t('exportMarkdown')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label={t('elapsed')} value={`${shownElapsed?.toFixed(1) ?? '—'} ${t('seconds')}`} />
              <MetricCard label={t('characters')} value={String(shownFinalChars)} />
              {!selectedHistory && <MetricCard label={t('researchWriterChars')} value={String(researchWriterChars)} />}
              <MetricCard
                label={t('qcScore')}
                value={shownScore === null ? '—' : `${shownScore}${selectedHistory ? '' : ` ${t('scoreSuffix')}`}`}
              />
            </div>

            <div className="rounded-xl border border-white/15 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-indigo-100">{t('qcScore')}</span>
                <span className={shownScorePass ? 'font-medium text-emerald-300' : 'font-medium text-red-300'}>
                  {shownScore === null ? '—' : `${shownScore} / 100 · ${shownScorePass ? t('pass') : t('fail')}`}
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${shownScorePass ? 'bg-emerald-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.max(0, Math.min(100, shownScore ?? 0))}%` }}
                />
              </div>
            </div>

            {finalFailed && (
              <p className="text-sm text-red-200/90">{t('qcFailNote').replace('{n}', String(shownRevisions))}</p>
            )}

            <pre className="whitespace-pre-wrap rounded-2xl border border-white/20 bg-slate-950 p-5 text-indigo-50 shadow-lg">{shownFinal}</pre>
            <p className="text-sm text-indigo-200">{t('revisions')}：{shownRevisions}</p>

            {!selectedHistory && quality && (
              <>
                <h3 className="font-semibold text-white">{t('qcHistory')}</h3>
                <ul className="space-y-3">
                  {quality.qcHistory.map((q, i) => (
                    <li key={i} className="rounded-2xl border border-white/20 bg-slate-950 p-4 shadow-lg">
                      <p>{t('qcRound')} {i + 1} {t('qcRoundSuffix')}：{q.score} {t('scoreSuffix')}，{q.verdict === 'pass' ? t('pass') : t('fail')}</p>
                      <p className="mt-1 text-indigo-200">{t('feedback')}：{q.feedback}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {plan && (
          <section className="fade-in space-y-4">
            <h2 className="text-xl font-bold text-white">{t('plan')}</h2>
            <p className="rounded-2xl border border-white/20 bg-slate-950 p-5 shadow-lg">{plan}</p>
            <ul className="space-y-3">
              {subtasks.map((s) => (
                <li key={s.id} className="rounded-2xl border border-white/20 bg-slate-950 p-4 shadow-lg">
                  <p className="font-semibold text-white">{agentLabel(s.agent)}</p>
                  <p className="mt-1">{t('goal')}：{s.goal}</p>
                  <p className="text-indigo-200">{t('deliverable')}：{s.deliverable}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {results.length > 0 && (
          <section className="fade-in space-y-4">
            <h2 className="text-xl font-bold text-white">{t('expertOutput')}</h2>
            {results.map((r) => (
              <ExpertOutputCard
                key={r.subtaskId}
                result={r}
                t={t}
                agentLabel={agentLabel}
                statusLabel={statusLabel}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
