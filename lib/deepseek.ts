const REQUEST_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3; // 首次 + 2 次退避重试
const RETRY_DELAY_MS = [1_000, 2_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const retriable = res.status === 429 || res.status >= 500;
        if (retriable && attempt < MAX_ATTEMPTS - 1) {
          await sleep(RETRY_DELAY_MS[attempt]);
          continue;
        }
        throw new Error(`DeepSeek 调用失败：${res.status} ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      return data?.choices?.[0]?.message?.content ?? '';
    } catch (e) {
      if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        throw new Error('DeepSeek 调用超时（60 秒），请稍后重试');
      }
      // 网络层错误（DNS、断连等）退避重试；HTTP 4xx 已在上面按需处理
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_DELAY_MS[attempt]);
        continue;
      }
      throw e instanceof Error ? e : new Error('DeepSeek 调用失败');
    }
  }
  throw new Error('DeepSeek 调用失败');
}

export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('模型没有返回有效的 JSON');
  }
  return JSON.parse(text.slice(start, end + 1));
}
