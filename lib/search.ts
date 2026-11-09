/* 联网搜索：服务端直调博查（Bocha）Web Search API。
   Key 只从环境变量读，没有 Key 时返回 configured=false，调用方静默退回模型知识。 */

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  site: string;
}

export interface WebSearchOutcome {
  configured: boolean;
  results: WebResult[];
  error?: string;
}

const BOCHA_ENDPOINT = 'https://api.bochaai.com/v1/web-search';
const TIMEOUT_MS = 8000;

function normalize(pages: unknown, count: number): WebResult[] {
  if (!Array.isArray(pages)) return [];
  return pages
    .slice(0, count)
    .map((page) => {
      const item = (page ?? {}) as Record<string, unknown>;
      return {
        title: String(item.name ?? item.title ?? '').trim(),
        url: String(item.url ?? '').trim(),
        snippet: String(item.snippet ?? item.summary ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 400),
        site: String(item.siteName ?? '').trim(),
      };
    })
    .filter((item) => item.url.length > 0);
}

export async function searchWeb(query: string, count = 5): Promise<WebSearchOutcome> {
  const cleaned = query.trim().slice(0, 200);
  if (!cleaned) return { configured: true, results: [], error: 'empty query' };

  const key = process.env.BOCHA_API_KEY;
  if (!key) return { configured: false, results: [], error: 'BOCHA_API_KEY 未配置' };

  try {
    const response = await fetch(BOCHA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ query: cleaned, summary: true, count, freshness: 'noLimit' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return { configured: true, results: [], error: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as Record<string, unknown>;
    const payload = data.data as Record<string, unknown> | undefined;
    const webPages = (payload?.webPages ?? data.webPages) as Record<string, unknown> | undefined;
    return { configured: true, results: normalize(webPages?.value, count) };
  } catch (error) {
    return {
      configured: true,
      results: [],
      error: error instanceof Error ? error.message : 'search failed',
    };
  }
}

/** 把搜索结果拼成一段带出处的资料，交给调研员做 RAG。 */
export function formatSearchContext(results: WebResult[], lang: 'zh' | 'en'): string {
  if (results.length === 0) return '';
  const header =
    lang === 'en'
      ? 'Live web search results (cite the source URL when you use them):'
      : '联网检索结果（引用时标注来源链接）：';
  const body = results
    .map((item, index) => `【联网${index + 1}】${item.title}\n${item.snippet}\n${item.url}`)
    .join('\n\n');
  return `${header}\n\n${body}`;
}
