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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setLoading(true);
    setError('');
    setPlan('');
    setSubtasks([]);
    setResults([]);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : '执行失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">多智能体协作台</h1>
      <p className="text-gray-600">第三步：调度拆分后，专家并行执行，调研先行，文案可用调研结果。</p>
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
        {loading ? '专家执行中…可能需要几十秒' : '提交任务'}
      </button>
      {error && <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
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
          <p className="text-sm text-gray-500">下一步：汇总和质检回环还没接上，这一步只验证专家能产出内容。</p>
        </section>
      )}
    </main>
  );
}
