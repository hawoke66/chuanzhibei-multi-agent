import { callDeepSeek } from './deepseek';
import type { Subtask } from './dispatcher';

export interface ExpertResult {
  subtaskId: string;
  agent: Subtask['agent'];
  goal: string;
  output: string;
  status: 'done' | 'failed';
  error?: string;
}

const RESEARCH_SYSTEM = [
  '你是调研员。',
  '只整理关键事实，分点列出，注明不确定的地方。',
  '不要编造来源，不要写最终文案。',
].join('\n');

const WRITER_SYSTEM = [
  '你是文案官。',
  '根据任务和调研结果（如有）写成段文案，结构清晰。',
  '不要编造调研里没有的事实，不要写代码。',
].join('\n');

const CODER_SYSTEM = [
  '你是代码手。',
  '根据任务写完整可运行的代码，附简短说明和关键注释。',
  '不要写调研报告和文案。',
].join('\n');

async function runOne(subtask: Subtask, researchContext: string): Promise<ExpertResult> {
  try {
    let system = '';
    let user = `任务目标：${subtask.goal}\n交付物：${subtask.deliverable}`;
    let temperature = 0.5;
    if (subtask.agent === 'research') {
      system = RESEARCH_SYSTEM;
      temperature = 0.3;
    } else if (subtask.agent === 'writer') {
      system = WRITER_SYSTEM;
      temperature = 0.7;
      if (researchContext) user += `\n调研结果：\n${researchContext}`;
    } else {
      system = CODER_SYSTEM;
      temperature = 0.2;
    }
    const output = await callDeepSeek({ system, user, temperature });
    return { subtaskId: subtask.id, agent: subtask.agent, goal: subtask.goal, output, status: 'done' };
  } catch (e) {
    return {
      subtaskId: subtask.id,
      agent: subtask.agent,
      goal: subtask.goal,
      output: '',
      status: 'failed',
      error: e instanceof Error ? e.message : '专家执行失败',
    };
  }
}

export async function runExperts(subtasks: Subtask[]): Promise<ExpertResult[]> {
  const researchTasks = subtasks.filter((s) => s.agent === 'research');
  const otherTasks = subtasks.filter((s) => s.agent !== 'research');
  const researchResults = await Promise.all(researchTasks.map((s) => runOne(s, '')));
  const researchContext = researchResults
    .filter((r) => r.status === 'done')
    .map((r) => r.output)
    .join('\n\n');
  const otherResults = await Promise.all(otherTasks.map((s) => runOne(s, researchContext)));
  const byId = new Map<string, ExpertResult>();
  [...researchResults, ...otherResults].forEach((r) => byId.set(r.subtaskId, r));
  return subtasks.map((s) => byId.get(s.id) as ExpertResult);
}
