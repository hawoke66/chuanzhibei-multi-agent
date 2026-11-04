import { NextResponse } from 'next/server';
import { dispatchTask } from '../../../lib/dispatcher';
import { runExpert } from '../../../lib/experts';
import { getTokenUsage, resetTokenUsage } from '../../../lib/deepseek';
import { summarize, checkQuality, revise } from '../../../lib/quality';

const FOOTER = '\n\n——多智能体协作台完成（调度·调研·文案·代码）';

const TASK_MAX_CHARS = 2000;
const REFERENCE_MAX_CHARS = 10000;

const ALLOWED_EXPERTS = ['research', 'writer', 'coder'] as const;
type SelectedExpert = (typeof ALLOWED_EXPERTS)[number];

function stripCodeBlocks(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const task = typeof body?.task === 'string' ? body.task.trim() : '';
  if (!task) {
    return NextResponse.json({ error: '请先输入任务' }, { status: 400 });
  }
  if (Array.from(task).length > TASK_MAX_CHARS) {
    return NextResponse.json({ error: `任务过长，请控制在 ${TASK_MAX_CHARS} 字以内` }, { status: 400 });
  }
  const reference = typeof body?.reference === 'string' ? body.reference.trim() : '';
  if (Array.from(reference).length > REFERENCE_MAX_CHARS) {
    return NextResponse.json({ error: `参考资料过长，请控制在 ${REFERENCE_MAX_CHARS / 10000} 万字以内` }, { status: 400 });
  }
  // 过往任务召回：客户端按关键词匹配到的历史成果片段，注入调研员上下文
  const historyRef = typeof body?.historyRef === 'string' ? body.historyRef.slice(0, 2000) : '';
  const requestedExperts: unknown = body?.experts;
  const selectedExperts: SelectedExpert[] = Array.isArray(requestedExperts)
    ? ALLOWED_EXPERTS.filter((agent) => requestedExperts.includes(agent))
    : [...ALLOWED_EXPERTS];
  if (selectedExperts.length === 0) {
    return NextResponse.json({ error: '请至少选择一个专家' }, { status: 400 });
  }
  const encoder = new TextEncoder();
  // 客户端断开后置位：各阶段之间检查，停止后续 Agent 调用（进行中的调用结果丢弃）
  let clientGone = false;
  const CANCELLED = '__client_cancelled__';
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        if (clientGone) return;
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };
      const throwIfCancelled = () => {
        if (clientGone) throw new Error(CANCELLED);
      };
      try {
        throwIfCancelled();
        resetTokenUsage();
        send({ type: 'stage', agent: 'dispatcher', status: 'running' });
        const dispatched = await dispatchTask(task);
        const plan = {
          ...dispatched,
          subtasks: dispatched.subtasks.filter((s) => selectedExperts.includes(s.agent)),
        };
        send({ type: 'stage', agent: 'dispatcher', status: 'done', detail: `拆出 ${plan.subtasks.length} 个子任务` });
        send({ type: 'plan', plan });

        if (plan.subtasks.length === 0) {
          (['research', 'writer', 'coder'] as const).forEach((a) =>
            send({ type: 'stage', agent: a, status: 'inactive' })
          );
          send({ type: 'error', error: '调度结果中没有所选专家的子任务，请重试或调整专家选择' });
          return;
        }

        const active = new Set(plan.subtasks.map((s) => s.agent));
        (['research', 'writer', 'coder'] as const).forEach((a) => {
          if (!selectedExperts.includes(a) || !active.has(a)) {
            send({ type: 'stage', agent: a, status: 'inactive' });
          }
        });
        const researchTasks = plan.subtasks.filter((s) => s.agent === 'research');
        const otherTasks = plan.subtasks.filter((s) => s.agent !== 'research');
        // 检索已工具化：参考资料全文交给调研员，由其经 function calling 自主调用本地检索；
        // 模型侧异常时专家内部自动降级为服务端 top-k 检索。
        researchTasks.forEach((s) => send({ type: 'stage', agent: s.agent, status: 'running' }));
        throwIfCancelled();
        const rawResearchResults = await Promise.all(researchTasks.map((s) => runExpert(s, '', reference, historyRef)));
        const researchResults = selectedExperts.includes('coder')
          ? rawResearchResults
          : rawResearchResults.map((r) => ({ ...r, output: stripCodeBlocks(r.output) }));
        researchResults.forEach((r) =>
          send({ type: 'stage', agent: r.agent, status: r.status, detail: r.status === 'done' ? `输出 ${r.output.length} 字` : r.error || '执行失败' })
        );
        const researchContext = researchResults.filter((r) => r.status === 'done').map((r) => r.output).join('\n\n');
        otherTasks.forEach((s) => send({ type: 'stage', agent: s.agent, status: 'running' }));
        throwIfCancelled();
        const rawOtherResults = await Promise.all(otherTasks.map((s) => runExpert(s, researchContext)));
        const otherResults = selectedExperts.includes('coder')
          ? rawOtherResults
          : rawOtherResults.map((r) => ({ ...r, output: stripCodeBlocks(r.output) }));
        otherResults.forEach((r) =>
          send({ type: 'stage', agent: r.agent, status: r.status, detail: r.status === 'done' ? `输出 ${r.output.length} 字` : r.error || '执行失败' })
        );
        const byId = new Map();
        [...researchResults, ...otherResults].forEach((r) => byId.set(r.subtaskId, r));
        const results = plan.subtasks.map((s) => byId.get(s.id));
        // 全部专家失败时不再有可汇总内容，发 error 走重试路径，不把空成果当成功发出
        if (!results.some((r) => r && r.status === 'done' && r.output)) {
          send({ type: 'stage', agent: 'summarizer', status: 'failed', detail: '没有可用专家输出' });
          send({ type: 'stage', agent: 'qc', status: 'inactive' });
          send({ type: 'stage', agent: 'reviser', status: 'inactive' });
          const firstError = results.find((r) => r && r.status === 'failed')?.error;
          send({ type: 'error', error: firstError || '所有专家执行失败，请重试' });
          return;
        }
        send({ type: 'stage', agent: 'summarizer', status: 'running' });
        throwIfCancelled();
        let draft = await summarize(task, results);
        if (!draft) draft = results.filter((r: { status: string }) => r.status === 'done').map((r: { output: string }) => r.output).join('\n\n');
        send({ type: 'stage', agent: 'summarizer', status: 'done', detail: `汇总 ${draft.length} 字` });
        let current = draft;
        const qcHistory: unknown[] = [];
        let revisions = 0;
        for (let i = 0; i < 2; i++) {
          throwIfCancelled();
          send({ type: 'stage', agent: 'qc', status: 'running', detail: `第 ${i + 1} 次质检` });
          const qc = await checkQuality(task, current);
          qcHistory.push(qc);
          send({ type: 'stage', agent: 'qc', status: 'done', detail: `${qc.score} 分，${qc.verdict === 'pass' ? '通过' : '不通过'}` });
          if (qc.verdict === 'pass') break;
          throwIfCancelled();
          send({ type: 'stage', agent: 'reviser', status: 'running' });
          current = await revise(task, current, qc.feedback);
          revisions += 1;
          send({ type: 'stage', agent: 'reviser', status: 'done', detail: `第 ${revisions} 轮修订完成` });
        }
        if (revisions === 0) send({ type: 'stage', agent: 'reviser', status: 'inactive' });
        const finalDraft = selectedExperts.includes('coder') ? current : stripCodeBlocks(current);
        const lastQc = qcHistory[qcHistory.length - 1] as { verdict?: string } | undefined;
        const finalVerdict = lastQc?.verdict === 'pass' ? 'pass' : qcHistory.length > 0 ? 'fail' : 'none';
        const quality = { draft, qcHistory, revisions, final: finalDraft + FOOTER, finalVerdict, usage: getTokenUsage() };
        send({ type: 'done', plan, results, quality });
      } catch (e) {
        if (!(e instanceof Error && e.message === CANCELLED)) {
          const message = e instanceof Error ? e.message : '执行失败';
          try {
            send({ type: 'error', error: message });
          } catch {
            // 连接已断开，发不出去就丢弃
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          // 连接已断开时关闭会抛错，忽略
        }
      }
    },
    cancel() {
      clientGone = true;
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
