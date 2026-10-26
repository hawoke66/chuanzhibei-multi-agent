'use client';

import { useState } from 'react';

export default function Home() {
  const [task, setTask] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setLoading(true);
    setError('');
    setOutput('');
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '调用失败');
      setOutput(data.output || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : '调用失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">多智能体协作台</h1>
      <p className="text-gray-600">第一步：输入任务，调通 DeepSeek，看看能不能返回。</p>
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        rows={4}
        placeholder="输入一个任务，例如：帮我写一段关于多智能体协作的介绍"
        className="w-full rounded border p-3"
      />
      <button
        onClick={run}
        disabled={loading || !task.trim()}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? '运行中…' : '提交任务'}
      </button>
      {error && <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {output && <pre className="whitespace-pre-wrap rounded bg-gray-50 p-4">{output}</pre>}
    </main>
  );
}
