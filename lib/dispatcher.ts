import { callDeepSeek, extractJson } from './deepseek';

export type AgentName = 'research' | 'writer' | 'coder';

export interface Subtask {
  id: string;
  agent: AgentName;
  goal: string;
  deliverable: string;
}

export interface Plan {
  plan: string;
  subtasks: Subtask[];
}

const SYSTEM = [
  '你是多智能体协作台的调度官。',
  '你只负责拆分任务，不直接写正文、不写代码。',
  '把用户任务拆成 1-3 个子任务，每个子任务交给调研员、文案官、代码手中的一个，写清目标和交付物。',
  '只输出 JSON，不要输出其他文字。',
  'JSON 格式：{"plan": "一句话说明整体思路", "subtasks": [{"id": "1", "agent": "research", "goal": "...", "deliverable": "..."}]}',
  'agent 只能是 research、writer、coder 三种。',
  '调研类任务必须有 research，写作类必须有 writer，只有明确需要写代码时才有 coder。',
].join('\n');

export async function dispatchTask(task: string): Promise<Plan> {
  const text = await callDeepSeek({
    system: SYSTEM,
    user: task,
    temperature: 0.3,
    jsonMode: true,
  });
  const parsed = extractJson(text) as Plan;
  if (!parsed || typeof parsed.plan !== 'string' || !Array.isArray(parsed.subtasks)) {
    throw new Error('调度官返回的计划格式不正确');
  }
  const allowed: AgentName[] = ['research', 'writer', 'coder'];
  parsed.subtasks = parsed.subtasks
    .filter((s) => s && allowed.includes(s.agent) && typeof s.goal === 'string')
    .map((s, i) => ({
      id: String(s.id ?? i + 1),
      agent: s.agent,
      goal: s.goal,
      deliverable: typeof s.deliverable === 'string' ? s.deliverable : s.goal,
    }));
  if (parsed.subtasks.length === 0) {
    throw new Error('调度官没有拆出有效的子任务');
  }
  return parsed;
}
