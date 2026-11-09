import { NextResponse } from 'next/server';
import { dispatchTask, type Subtask } from '../../../lib/dispatcher';
import { runExpert, type ExpertResult } from '../../../lib/experts';
import { getTokenUsage, resetTokenUsage } from '../../../lib/deepseek';
import { summarize, checkQuality, revise } from '../../../lib/quality';
import { normalizeLang, serverText, type OutputLang } from '../../../lib/language';
import { searchWeb, formatSearchContext, type WebResult } from '../../../lib/search';
import { callMcpTool, readMcpPayload } from '../../../lib/mcp-client';

const TASK_MAX_CHARS = 2000;
const REFERENCE_MAX_CHARS = 10000;
const ALLOWED_EXPERTS = ['research', 'writer', 'coder'] as const;
type SelectedExpert = (typeof ALLOWED_EXPERTS)[number];

const FOOTER_ZH = '\n\n——多智能体协作台完成（调度·调研·文案·代码）';
const FOOTER_EN = '\n\n— Completed by the multi-agent workspace (dispatch, research, copy, code)';

function stripCodeBlocks(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isSubtask(value: unknown): value is Subtask {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.agent === 'string' &&
    ALLOWED_EXPERTS.includes(item.agent as SelectedExpert) &&
    typeof item.goal === 'string'
  );
}

function normalizeResults(value: unknown): ExpertResult[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ExpertResult => {
      if (!item || typeof item !== 'object') return false;
      const record = item as Record<string, unknown>;
      return (
        typeof record.subtaskId === 'string' &&
        typeof record.agent === 'string' &&
        ALLOWED_EXPERTS.includes(record.agent as SelectedExpert) &&
        typeof record.goal === 'string' &&
        typeof record.output === 'string' &&
        (record.status === 'done' || record.status === 'failed')
      );
    })
    .slice(0, 8);
}

/** 联网检索：先走 MCP 的 web_search，失败再本地直调；两步都失败就退回模型知识。 */
async function resolveSources(query: string) {
  const trace: { via: 'mcp' | 'local' | 'none'; ok: boolean; count: number; error?: string } = {
    via: 'none',
    ok: false,
    count: 0,
  };
  let sources: WebResult[] = [];
  let configured = true;

  const mcp = await callMcpTool('web_search', { query, count: 5 });
  if (mcp.ok) {
    const payload = readMcpPayload(mcp.result) as { results?: WebResult[] } | null;
    const results = Array.isArray(payload?.results) ? payload!.results : [];
    if (results.length > 0) {
      trace.via = 'mcp';
      trace.ok = true;
      trace.count = results.length;
      return { trace, sources: results, configured: true };
    }
    trace.error = 'mcp returned no results';
  } else {
    trace.error = mcp.error;
  }

  const local = await searchWeb(query, 5);
  configured = local.configured;
  sources = local.results;
  trace.via = 'local';
  trace.ok = sources.length > 0;
  trace.count = sources.length;
  if (!trace.ok) trace.error = local.error ?? trace.error;
  return { trace, sources, configured };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lang = normalizeLang(body?.lang);
  const mode = body?.mode === 'resume' ? 'resume' : 'run';
  const task = typeof body?.task === 'string' ? body.task.trim() : '';
  if (!task) {
    return NextResponse.json({ error: serverText(lang, '请先输入任务', 'Enter a task first') }, { status: 400 });
  }
  if (Array.from(task).length > TASK_MAX_CHARS) {
    return NextResponse.json(
      {
        error: serverText(
          lang,
          `任务过长，请控制在 ${TASK_MAX_CHARS} 字以内`,
          `Task is too long, keep it under ${TASK_MAX_CHARS} characters`,
        ),
      },
      { status: 400 },
    );
  }
  const reference = typeof body?.reference === 'string' ? body.reference.trim() : '';
  if (Array.from(reference).length > REFERENCE_MAX_CHARS) {
    return NextResponse.json(
      {
        error: serverText(
          lang,
          `参考资料过长，请控制在 ${REFERENCE_MAX_CHARS} 字以内`,
          `Reference is too long, keep it under ${REFERENCE_MAX_CHARS} characters`,
        ),
      },
      { status: 400 },
    );
  }
  const historyRef = typeof body?.historyRef === 'string' ? body.historyRef.slice(0, 2000) : '';
  const requestedExperts: unknown = body?.experts;
  const selectedExperts: SelectedExpert[] = Array.isArray(requestedExperts)
    ? ALLOWED_EXPERTS.filter((agent) => requestedExperts.includes(agent))
    : [...ALLOWED_EXPERTS];
  if (selectedExperts.length === 0) {
    return NextResponse.json(
      { error: serverText(lang, '请至少选择一个专家', 'Select at least one expert') },
      { status: 400 },
    );
  }
  const searchEnabled = body?.search !== false;

  const encoder = new TextEncoder();
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

      /** 汇总 → 质检 → 修订，两条路径共用。 */
      const runQuality = async (
        baseTask: string,
        results: ExpertResult[],
        planSubtasks: Subtask[],
        missing: SelectedExpert[],
      ) => {
        const doneResults = results.filter((item) => item.status === 'done' && item.output);
        let draft = await summarize(taskWithMissing(baseTask, missing, lang), doneResults, lang);
        if (!draft) draft = doneResults.map((item) => item.output).join('\n\n');
        send({ type: 'stage', agent: 'summarizer', status: 'done', detail: serverText(lang, `汇总 ${draft.length} 字`, `Synthesised ${draft.length} chars`) });

        let current = draft;
        const qcHistory: unknown[] = [];
        let revisions = 0;
        for (let i = 0; i < 2; i++) {
          throwIfCancelled();
          send({
            type: 'stage',
            agent: 'qc',
            status: 'running',
            detail: serverText(lang, `第 ${i + 1} 次质检`, `QA pass ${i + 1}`),
          });
          const qc = await checkQuality(taskWithMissing(baseTask, missing, lang), current, lang);
          qcHistory.push(qc);
          send({
            type: 'stage',
            agent: 'qc',
            status: 'done',
            detail: serverText(
              lang,
              `${qc.score} 分，${qc.verdict === 'pass' ? '通过' : '不通过'}`,
              `Score ${qc.score}, ${qc.verdict === 'pass' ? 'pass' : 'fail'}`,
            ),
          });
          if (qc.verdict === 'pass') break;
          throwIfCancelled();
          send({ type: 'stage', agent: 'reviser', status: 'running' });
          current = await revise(taskWithMissing(baseTask, missing, lang), current, qc.feedback, lang);
          revisions += 1;
          send({
            type: 'stage',
            agent: 'reviser',
            status: 'done',
            detail: serverText(lang, `第 ${revisions} 轮修订完成`, `Revision ${revisions} done`),
          });
        }
        if (revisions === 0) send({ type: 'stage', agent: 'reviser', status: 'inactive' });
        const finalDraft = selectedExperts.includes('coder') ? current : stripCodeBlocks(current);
        const lastQc = qcHistory[qcHistory.length - 1] as { verdict?: string } | undefined;
        const finalVerdict = lastQc?.verdict === 'pass' ? 'pass' : qcHistory.length > 0 ? 'fail' : 'none';
        const quality = {
          draft,
          qcHistory,
          revisions,
          final: finalDraft + (lang === 'en' ? FOOTER_EN : FOOTER_ZH),
          revised: finalDraft,
          finalVerdict,
          usage: getTokenUsage(),
          missing,
        };
        send({ type: 'done', plan: { plan: '', subtasks: planSubtasks }, results, quality });
      };

      try {
        throwIfCancelled();
        resetTokenUsage();

        // ---------- 单专家重试：只重跑一个专家，成功后继续走汇总质检 ----------
        if (mode === 'resume') {
          const agent = body?.retryAgent;
          const subtask = body?.retrySubtask;
          if (typeof agent !== 'string' || !isSubtask(subtask)) {
            send({ type: 'error', error: serverText(lang, '重试参数不完整', 'Retry payload is incomplete') });
            return;
          }
          if (!selectedExperts.includes(agent as SelectedExpert)) {
            send({ type: 'error', error: serverText(lang, '该专家本轮未参与', 'This expert is not in this run') });
            return;
          }
          const existing = normalizeResults(body?.results);
          send({ type: 'stage', agent: subtask.agent, status: 'running', detail: serverText(lang, '单独重试中', 'Retrying this expert') });
          const researchContext = existing
            .filter((item) => item.agent === 'research' && item.status === 'done')
            .map((item) => item.output)
            .join('\n\n');
          const result = await runExpert(subtask, researchContext, reference, historyRef, lang);
          send({ type: 'expert', result });
          if (result.status !== 'done') {
            send({
              type: 'stage',
              agent: subtask.agent,
              status: 'failed',
              detail: result.error || serverText(lang, '重试仍失败', 'Retry failed'),
            });
            send({ type: 'error', error: result.error || serverText(lang, '重试仍失败', 'Retry failed') });
            return;
          }
          send({
            type: 'stage',
            agent: subtask.agent,
            status: 'done',
            detail: serverText(lang, `重试成功，输出 ${result.output.length} 字`, `Retry succeeded, ${result.output.length} chars`),
          });
          const unique = [...existing.filter((item) => item.subtaskId !== result.subtaskId), result];
          const missing = ALLOWED_EXPERTS.filter(
            (name) => selectedExperts.includes(name) && unique.some((item) => item.agent === name && item.status === 'failed'),
          );
          send({ type: 'stage', agent: 'summarizer', status: 'running' });
          await runQuality(task, unique, [], missing);
          return;
        }

        // ---------- 正常一轮 ----------
        send({ type: 'stage', agent: 'dispatcher', status: 'running' });
        const dispatched = await dispatchTask(task, lang);
        const plan = {
          ...dispatched,
          subtasks: dispatched.subtasks.filter((subtask) => selectedExperts.includes(subtask.agent)),
        };
        send({
          type: 'stage',
          agent: 'dispatcher',
          status: 'done',
          detail: serverText(lang, `拆出 ${plan.subtasks.length} 个子任务`, `Split into ${plan.subtasks.length} subtasks`),
        });
        send({ type: 'plan', plan });

        // 调度官取一次当前时间：MCP 的 get_current_time，让时间敏感任务有准确日期
        let timeContext = '';
        const clock = await callMcpTool('get_current_time', { timezone: 'Asia/Shanghai' });
        if (clock.ok) {
          const payload = readMcpPayload(clock.result) as { iso?: string; local?: string } | null;
          if (payload?.iso) {
            timeContext = `\n\n当前时间：${payload.local ?? payload.iso}（${payload.iso}）`;
            send({
              type: 'tool',
              name: 'get_current_time',
              via: 'mcp',
              ok: true,
              count: 1,
              detail: serverText(
                lang,
                `调用了 get_current_time，返回 ${payload.local ?? payload.iso}`,
                `Called get_current_time, ${payload.local ?? payload.iso}`,
              ),
            });
          }
        }

        // 联网检索：MCP → 本地直调 → 模型知识
        let searchContext = '';
        if (searchEnabled) {
          throwIfCancelled();
          const { trace, sources, configured } = await resolveSources(task.slice(0, 160));
          send({
            type: 'tool',
            name: 'web_search',
            via: trace.via,
            ok: trace.ok,
            count: trace.count,
            error: trace.error,
            detail: trace.ok
              ? serverText(lang, `调用了 web_search，返回 ${trace.count} 条`, `Called web_search, ${trace.count} results`)
              : serverText(lang, '联网检索不可用，改用模型知识', 'Web search unavailable, using model knowledge'),
          });
          send({ type: 'sources', sources, configured, enabled: true });
          searchContext = formatSearchContext(sources, lang);
        } else {
          send({ type: 'sources', sources: [], configured: true, enabled: false });
        }
        const groundedReference = [reference, searchContext, timeContext].filter(Boolean).join('\n\n');

        if (plan.subtasks.length === 0) {
          (['research', 'writer', 'coder'] as const).forEach((agent) =>
            send({ type: 'stage', agent, status: 'inactive' }),
          );
          send({
            type: 'error',
            error: serverText(
              lang,
              '调度结果中没有所选专家的子任务，请重试或调整专家选择',
              'No subtasks matched the selected experts. Retry or change the expert selection.',
            ),
          });
          return;
        }

        const active = new Set(plan.subtasks.map((subtask) => subtask.agent));
        (['research', 'writer', 'coder'] as const).forEach((agent) => {
          if (!selectedExperts.includes(agent) || !active.has(agent)) {
            send({ type: 'stage', agent, status: 'inactive' });
          }
        });

        const researchTasks = plan.subtasks.filter((subtask) => subtask.agent === 'research');
        const otherTasks = plan.subtasks.filter((subtask) => subtask.agent !== 'research');
        researchTasks.forEach((subtask) => send({ type: 'stage', agent: subtask.agent, status: 'running' }));
        throwIfCancelled();
        const rawResearchResults = await Promise.all(
          researchTasks.map((subtask) => runExpert(subtask, '', groundedReference, historyRef, lang)),
        );
        const researchResults = selectedExperts.includes('coder')
          ? rawResearchResults
          : rawResearchResults.map((result) => ({ ...result, output: stripCodeBlocks(result.output) }));
        researchResults.forEach((result) =>
          send({
            type: 'stage',
            agent: result.agent,
            status: result.status,
            detail:
              result.status === 'done'
                ? serverText(lang, `输出 ${result.output.length} 字`, `${result.output.length} chars`)
                : result.error || serverText(lang, '执行失败', 'Failed'),
          }),
        );
        const researchContext = researchResults
          .filter((result) => result.status === 'done')
          .map((result) => result.output)
          .join('\n\n');
        otherTasks.forEach((subtask) => send({ type: 'stage', agent: subtask.agent, status: 'running' }));
        throwIfCancelled();
        const rawOtherResults = await Promise.all(
          otherTasks.map((subtask) => runExpert(subtask, researchContext, groundedReference, historyRef, lang)),
        );
        const otherResults = selectedExperts.includes('coder')
          ? rawOtherResults
          : rawOtherResults.map((result) => ({ ...result, output: stripCodeBlocks(result.output) }));
        otherResults.forEach((result) =>
          send({
            type: 'stage',
            agent: result.agent,
            status: result.status,
            detail:
              result.status === 'done'
                ? serverText(lang, `输出 ${result.output.length} 字`, `${result.output.length} chars`)
                : result.error || serverText(lang, '执行失败', 'Failed'),
          }),
        );

        const byId = new Map<string, ExpertResult>();
        [...researchResults, ...otherResults].forEach((result) => byId.set(result.subtaskId, result));
        const results = plan.subtasks.map((subtask) => byId.get(subtask.id)).filter(Boolean) as ExpertResult[];

        if (!results.some((result) => result.status === 'done' && result.output)) {
          send({
            type: 'stage',
            agent: 'summarizer',
            status: 'failed',
            detail: serverText(lang, '没有可用专家输出', 'No usable expert output'),
          });
          send({ type: 'stage', agent: 'qc', status: 'inactive' });
          send({ type: 'stage', agent: 'reviser', status: 'inactive' });
          const firstError = results.find((result) => result.status === 'failed')?.error;
          send({
            type: 'error',
            error: firstError || serverText(lang, '所有专家执行失败，请重试', 'Every expert failed, try again'),
          });
          return;
        }

        send({ type: 'stage', agent: 'summarizer', status: 'running' });
        throwIfCancelled();
        const missing = selectedExperts.filter((agent) =>
          results.some((result) => result.agent === agent && result.status === 'failed'),
        );
        await runQuality(task, results, plan.subtasks, missing);
      } catch (error) {
        if (!(error instanceof Error && error.message === CANCELLED)) {
          const message = error instanceof Error ? error.message : serverText(lang, '执行失败', 'Execution failed');
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

/** 有专家失败时，在交给汇总/质检的任务里注明，避免把缺失当完整。 */
function taskWithMissing(task: string, missing: SelectedExpert[], lang: OutputLang): string {
  if (missing.length === 0) return task;
  const names = missing.join(', ');
  const note =
    lang === 'en'
      ? `Note: these experts failed and their sections are missing: ${names}. Say so in the output instead of inventing that part.`
      : `注意：以下专家执行失败，成果中该部分缺失：${names}。请在文中注明缺失，不要编造这部分内容。`;
  return `${task}\n\n${note}`;
}
