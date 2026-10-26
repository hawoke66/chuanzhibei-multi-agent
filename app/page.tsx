'use client';

import { useState } from 'react';

type AgentName = 'research' | 'writer' | 'coder';
type AgentId = 'dispatcher' | AgentName | 'summarizer' | 'qc' | 'reviser';
type AgentStatus = 'waiting' | 'running' | 'done' | 'failed' | 'inactive';

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
}

const AGENT_LABEL: Record<AgentId, string> = {
  dispatcher: '调度官',
  research: '调研员',
  writer: '文案官',
  coder: '代码手',
  summarizer: '汇总官',
  qc: '质检官',
  reviser: '修订官',
};

const AGENT_IDS: AgentId[] = ['dispatcher', 'research', 'writer', 'coder', 'summarizer', 'qc', 'reviser'];

const STATUS_LABEL: Record<AgentStatus, string> = {
  waiting: '等待',
  running: '进行中',
  done: '完成',
  failed: '失败',
  inactive: '未激活',
};

const STATUS_STYLE: Record<AgentStatus, string> = {
  waiting: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  inactive: 'bg-gray-50 text-gray-400',
};

function initialStatus(): Record<AgentId, { status: AgentStatus; detail: string }> {
  const out = {} as Record<AgentId, { status: AgentStatus; detail: string }>;
  AGENT_IDS.forEach((id) => { out[id] = { status: 'waiting', detail: '' }; });
  return out;
}

export default function Home() {
  const [task, setTask] = useState('');
  const [plan, setPlan] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [results, setResults] = useState<ExpertResult[]>([]);
  const [quality, setQuality] = useState<QualityOutcome | null>(null);
  const [agentStatus, setAgentStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      setQuality((ev.quality as QualityOutcome) || null);
    } else if (ev.type === 'error') {
      setError(typeof ev.error === 'string' ? ev.error : '执行失败');
    }
  }

  async function run() {
    setLoading(true);
    setError('');
    setPlan('');
    setSubtasks([]);
    setResults([]);
    setQuality(null);
    setAgentStatus(initialStatus());
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '执行失败');
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
      setError(e instanceof Error ? e.message : '执行失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">多智能体协作台</h1>
      <p className="text-gray-600">Agent 状态卡：提交任务后，每张卡会随执行进度实时更新。</p>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {AGENT_IDS.map((id) => (
          <article key={id} className="rounded border p-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{AGENT_LABEL[id]}</h2>
              <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[agentStatus[id].status]}`}>
                {STATUS_LABEL[agentStatus[id].status]}
              </span>
            </div>
            {agentStatus[id].detail && <p className="mt-1 text-sm text-gray-600">{agentStatus[id].detail}</p>}
          </article>
        ))}
      </section>
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        rows={4}
        placeholder="输入一个任务，例如：调研多智能体协作并写一段介绍"
        className="w-full rounded border p-3"
      />
      <button
        onClick={run}
        disabled={loading || !task.trim()}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? '执行中…看上方状态卡' : '提交任务'}
      </button>
      {error && <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {quality && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">最终成果</h2>
          <pre className="whitespace-pre-wrap rounded bg-gray-50 p-4">{quality.final}</pre>
          <p className="text-sm text-gray-600">修订轮数：{quality.revisions}</p>
          <h3 className="font-bold">质检记录</h3>
          <ul className="space-y-2">
            {quality.qcHistory.map((q, i) => (
              <li key={i} className="rounded border p-3">
                <p>第 {i + 1} 次质检：{q.score} 分，{q.verdict === 'pass' ? '通过' : '不通过'}</p>
                <p className="text-gray-600">意见：{q.feedback}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {plan && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">调度计划</h2>
          <p className="rounded bg-gray-50 p-4">{plan}</p>
          <ul className="space-y-2">
            {subtasks.map((s) => (
              <li key={s.id} className="rounded border p-3">
                <p className="font-bold">{AGENT_LABEL[s.agent]}</p>
                <p>目标：{s.goal}</p>
                <p className="text-gray-600">交付物：{s.deliverable}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {results.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">专家输出</h2>
          {results.map((r) => (
            <article key={r.subtaskId} className="rounded border p-4">
              <h3 className="font-bold">{AGENT_LABEL[r.agent]}</h3>
              <p className="text-sm text-gray-600">目标：{r.goal}</p>
              {r.status === 'done' ? (
                <pre className="mt-2 whitespace-pre-wrap">{r.output}</pre>
              ) : (
                <p className="mt-2 text-red-700">执行失败：{r.error}</p>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
