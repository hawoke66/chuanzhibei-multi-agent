import { NextResponse } from 'next/server';
import { dispatchTask } from '../../../lib/dispatcher';
import { runExpert } from '../../../lib/experts';
import { summarize, checkQuality, revise } from '../../../lib/quality';

const FOOTER = '\n\n——多智能体协作台完成（调度·调研·文案·代码）';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const task = typeof body?.task === 'string' ? body.task.trim() : '';
  if (!task) {
    return NextResponse.json({ error: '请先输入任务' }, { status: 400 });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };
      try {
        send({ type: 'stage', agent: 'dispatcher', status: 'running' });
        const plan = await dispatchTask(task);
        send({ type: 'stage', agent: 'dispatcher', status: 'done', detail: `拆出 ${plan.subtasks.length} 个子任务` });
        send({ type: 'plan', plan });
        const active = new Set(plan.subtasks.map((s) => s.agent));
        (['research', 'writer', 'coder'] as const).forEach((a) => {
          if (!active.has(a)) send({ type: 'stage', agent: a, status: 'inactive' });
        });
        const researchTasks = plan.subtasks.filter((s) => s.agent === 'research');
        const otherTasks = plan.subtasks.filter((s) => s.agent !== 'research');
        researchTasks.forEach((s) => send({ type: 'stage', agent: s.agent, status: 'running' }));
        const researchResults = await Promise.all(researchTasks.map((s) => runExpert(s, '')));
        researchResults.forEach((r) =>
          send({ type: 'stage', agent: r.agent, status: r.status, detail: r.status === 'done' ? `输出 ${r.output.length} 字` : r.error || '执行失败' })
        );
        const researchContext = researchResults.filter((r) => r.status === 'done').map((r) => r.output).join('\n\n');
        otherTasks.forEach((s) => send({ type: 'stage', agent: s.agent, status: 'running' }));
        const otherResults = await Promise.all(otherTasks.map((s) => runExpert(s, researchContext)));
        otherResults.forEach((r) =>
          send({ type: 'stage', agent: r.agent, status: r.status, detail: r.status === 'done' ? `输出 ${r.output.length} 字` : r.error || '执行失败' })
        );
        const byId = new Map();
        [...researchResults, ...otherResults].forEach((r) => byId.set(r.subtaskId, r));
        const results = plan.subtasks.map((s) => byId.get(s.id));
        send({ type: 'stage', agent: 'summarizer', status: 'running' });
        let draft = await summarize(task, results);
        if (!draft) draft = results.filter((r: { status: string }) => r.status === 'done').map((r: { output: string }) => r.output).join('\n\n');
        send({ type: 'stage', agent: 'summarizer', status: 'done', detail: `汇总 ${draft.length} 字` });
        let current = draft;
        const qcHistory: unknown[] = [];
        let revisions = 0;
        for (let i = 0; i < 2; i++) {
          send({ type: 'stage', agent: 'qc', status: 'running', detail: `第 ${i + 1} 次质检` });
          const qc = await checkQuality(task, current);
          qcHistory.push(qc);
          send({ type: 'stage', agent: 'qc', status: 'done', detail: `${qc.score} 分，${qc.verdict === 'pass' ? '通过' : '不通过'}` });
          if (qc.verdict === 'pass') break;
          send({ type: 'stage', agent: 'reviser', status: 'running' });
          current = await revise(task, current, qc.feedback);
          revisions += 1;
          send({ type: 'stage', agent: 'reviser', status: 'done', detail: `第 ${revisions} 轮修订完成` });
        }
        if (revisions === 0) send({ type: 'stage', agent: 'reviser', status: 'inactive' });
        const quality = { draft, qcHistory, revisions, final: current + FOOTER };
        send({ type: 'done', plan, results, quality });
      } catch (e) {
        const message = e instanceof Error ? e.message : '执行失败';
        send({ type: 'error', error: message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
