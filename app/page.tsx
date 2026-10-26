'use client';

import { useState } from 'react';

type AgentName = 'research' | 'writer' | 'coder';

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

const AGENT_LABEL: Record<AgentName, string> = {
  research: '调研员',
  writer: '文案官',
  coder: '代码手',
};

export default function Home() {
  const [task, setTask] = useState('');
  const [plan, setPlan] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [results, setResults] = useState<ExpertResult[]>([]);
  const [quality, setQuality] = useState<QualityOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setLoading(true);
    setError('');
    setPlan('');
    setSubtasks([]);
    setResults([]);
    setQuality(null);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '执行失败');
      setPlan(data.plan.plan || '');
      setSubtasks(data.plan.subtasks || []);
      setResults(data.results || []);
      setQuality(data.quality || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '执行失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">多智能体协作台</h1>
      <p className="text-gray-600">第四步：调度 → 专家 → 汇总 → 质检 → 最多修订 2 轮 → 最终聚合。</p>
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
        {loading ? '全链执行中…质检回环可能需要一两分钟' : '提交任务'}
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
                <p className="font-bold">{AGENT_LABEL[s.agent] || s.agent}</p>
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
              <h3 className="font-bold">{AGENT_LABEL[r.agent] || r.agent}</h3>
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
