import { callDeepSeek, extractJson } from './deepseek';
import type { ExpertResult } from './experts';

export interface QcResult {
  score: number;
  verdict: 'pass' | 'fail';
  feedback: string;
}

export interface QualityOutcome {
  draft: string;
  qcHistory: QcResult[];
  revisions: number;
  final: string;
}

const FOOTER = '\n\n——多智能体协作台完成（调度·调研·文案·代码）';

export async function summarize(task: string, results: ExpertResult[]): Promise<string> {
  const parts = results
    .filter((r) => r.status === 'done' && r.output)
    .map((r) => `【${r.agent}】\n${r.output}`)
    .join('\n\n');
  if (!parts) return '';
  const output = await callDeepSeek({
    system: [
      '你是汇总官。',
      '把各专家输出合成一稿，去重、去冲突，只衔接润色。',
      '不扩写、不新增事实。',
      '如果包含代码，完整保留代码块，不要改写代码逻辑。',
      '只输出合成后的文案本身，不要加解释。',
    ].join('\n'),
    user: `原任务：${task}\n\n专家输出：\n${parts}`,
    temperature: 0.3,
  });
  return output.trim();
}

export async function checkQuality(task: string, draft: string): Promise<QcResult> {
  const text = await callDeepSeek({
    system: [
      '你是质检官。',
      '只输出 JSON，不要输出思考过程，不要输出其他文字。',
      'JSON 格式：{"score": 0-100, "verdict": "pass" 或 "fail", "feedback": "具体问题+位置+改法"}',
      '评分标准：是否完成原任务、事实是否与调研一致、有无编造、结构是否清晰。',
      '80 分及以上 verdict 为 pass，否则为 fail；通过时 feedback 写“符合要求”。',
    ].join('\n'),
    user: `原任务：${task}\n\n待验收成果：\n${draft}`,
    temperature: 0.2,
    jsonMode: true,
  });
  const parsed = extractJson(text) as QcResult;
  const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0;
  const verdict: 'pass' | 'fail' = parsed.verdict === 'pass' && score >= 80 ? 'pass' : 'fail';
  return {
    score,
    verdict,
    feedback: typeof parsed.feedback === 'string' && parsed.feedback ? parsed.feedback : '质检未给出具体意见',
  };
}

export async function revise(task: string, draft: string, feedback: string): Promise<string> {
  const output = await callDeepSeek({
    system: [
      '你是修订官。',
      '只改质检反馈指出的问题，通过部分不动，不重写全文。',
      '只输出修订后的全文，不要加解释。',
    ].join('\n'),
    user: `原任务：${task}\n\n质检反馈：${feedback}\n\n待修订稿：\n${draft}`,
    temperature: 0.3,
  });
  return output.trim() || draft;
}

export async function runQualityLoop(task: string, results: ExpertResult[]): Promise<QualityOutcome> {
  const draft = await summarize(task, results);
  if (!draft) {
    const fallback = results.filter((r) => r.status === 'done').map((r) => r.output).join('\n\n');
    return { draft: fallback, qcHistory: [], revisions: 0, final: fallback + FOOTER };
  }
  let current = draft;
  const qcHistory: QcResult[] = [];
  let revisions = 0;
  for (let i = 0; i < 2; i++) {
    const qc = await checkQuality(task, current);
    qcHistory.push(qc);
    if (qc.verdict === 'pass') break;
    current = await revise(task, current, qc.feedback);
    revisions += 1;
  }
  return { draft, qcHistory, revisions, final: current + FOOTER };
}
