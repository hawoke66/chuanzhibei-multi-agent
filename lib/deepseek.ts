export async function callDeepSeek(options: {
  system?: string;
  user: string;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY，请在项目根目录新建 .env.local 并写入该变量，然后重启开发服务器');
  }
  const messages: { role: string; content: string }[] = [];
  if (options.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: options.user });
  const body: Record<string, unknown> = {
    model: 'deepseek-chat',
    messages,
    temperature: options.temperature ?? 0.7,
  };
  if (options.jsonMode) body.response_format = { type: 'json_object' };
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`DeepSeek 调用失败：${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('模型没有返回有效的 JSON');
  }
  return JSON.parse(text.slice(start, end + 1));
}
