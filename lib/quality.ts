import { callDeepSeek, extractJson } from './deepseek';
import type { ExpertResult } from './experts';
import { outputLanguageRule, type OutputLang } from './language';

export interface QcBreakdown {
  facts: number;
  relevance: number;
  structure: number;
  language: number;
}

export interface QcResult {
  score: number;
  verdict: 'pass' | 'fail';
  feedback: string;
  breakdown?: QcBreakdown;
}

export interface QualityOutcome {
  draft: string;
  qcHistory: QcResult[];
  revisions: number;
  final: string;
}

const FOOTER = '\n\n——多智能体协作台完成（调度·调研·文案·代码）';

export async function summarize(task: string, results: ExpertResult[], lang: OutputLang = 'zh'): Promise<string> {
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
      outputLanguageRule(lang),
    ].join('\n'),
    user: `原任务：${task}\n\n专家输出：\n${parts}`,
    temperature: 0.3,
  });
  return output.trim();
}

export async function checkQuality(task: string, draft: string, lang: OutputLang = 'zh'): Promise<QcResult> {
  const text = await callDeepSeek({
    system: [
      '你是质检官。',
      '只输出 JSON，不要输出思考过程，不要输出其他文字。',
      'JSON 格式：{"score":0-100,"verdict":"pass"|"fail","breakdown":{"facts":0-100,"relevance":0-100,"structure":0-100,"language":0-100},"feedback":"逐条问题"}',
      'rubric 四项配分：事实准确性 30%、任务契合度 30%、结构完整性 20%、语言质量 20%，四项各打 0-100 分。',
      'score 按四项加权计算并四舍五入；80 分及以上 verdict 为 pass，否则为 fail。',
      'feedback 逐条列出失分项，每项一行："- [项目] 具体问题+位置+改法"；通过时写"符合要求"。',
      outputLanguageRule(lang),
    ].join('\n'),
    user: `原任务：${task}\n\n待验收成果：\n${draft}`,
    temperature: 0.2,
    jsonMode: true,
  });
  const parsed = extractJson(text) as QcResult & { breakdown?: Partial<Record<keyof QcBreakdown, unknown>> };
  const clampScore = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
  const breakdown: QcBreakdown | undefined = (() => {
    const b = parsed.breakdown;
    if (!b) return undefined;
    const facts = clampScore(b.facts);
    const relevance = clampScore(b.relevance);
    const structure = clampScore(b.structure);
    const language = clampScore(b.language);
    if (facts === null || relevance === null || structure === null || language === null) return undefined;
    return { facts, relevance, structure, language };
  })();
  // 有四项分项时以加权总分为准，保证分数与分项一致
  const score = breakdown
    ? Math.round(breakdown.facts * 0.3 + breakdown.relevance * 0.3 + breakdown.structure * 0.2 + breakdown.language * 0.2)
    : Math.max(0, Math.min(100, Math.round(typeof parsed.score === 'number' ? parsed.score : 0)));
  const verdict: 'pass' | 'fail' = parsed.verdict === 'pass' && score >= 80 ? 'pass' : 'fail';
  return {
    score,
    verdict,
    breakdown,
    feedback: typeof parsed.feedback === 'string' && parsed.feedback ? parsed.feedback : '质检未给出具体意见',
  };
}

export async function revise(task: string, draft: string, feedback: string, lang: OutputLang = 'zh'): Promise<string> {
  const output = await callDeepSeek({
    system: [
      '你是修订官。',
      '只改质检反馈指出的问题，通过部分不动，不重写全文。',
      '逐条响应反馈中的每一个问题，不要遗漏，没问题的部分保持原样。',
      '只输出修订后的全文，不要加解释。',
      outputLanguageRule(lang),
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
