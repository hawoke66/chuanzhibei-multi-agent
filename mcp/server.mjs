#!/usr/bin/env node
/* 最小 MCP 服务器（stdio 传输，JSON-RPC 2.0，按行分隔）。
   对齐 mcp-setup skill 的架构约定：
   - 四个原语里实现了三个：Tools（web_search / get_current_time）、
     Resources（swarm://clock、swarm://tools）、Prompts（research_brief）；
     Sampling（服务端反向请求模型）本场景用不到，不实现。
   - 能力在 initialize 里按原语分别声明；传输用 stdio（本地、不过网）。
   - 每个工具都有给模型看的 name / description / inputSchema。
   由 lib/mcp-client.ts 以子进程方式连接；连接失败时调用方退回本地直调。 */

import { createInterface } from 'node:readline';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'swarm-tool-server', version: '0.2.0' };
const BOCHA_ENDPOINT = 'https://api.bochaai.com/v1/web-search';
const SEARCH_TIMEOUT_MS = 8000;

const TOOLS = [
  {
    name: 'web_search',
    description:
      'Search the live web for current information. Use it when the task needs facts newer than the model knowledge. Returns titles, snippets and source URLs. Args: query (string, search keywords), count (number 1-10, default 5). Returns: JSON { query, count, results: [{ title, url, snippet, site }] }.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords, usually the core noun of the task goal' },
        count: { type: 'number', description: 'How many results, 1 to 10', default: 5 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_current_time',
    description:
      'Return the current date and time in ISO 8601 with a human readable local form. Use it for time sensitive tasks instead of guessing today. Args: timezone (IANA name, default Asia/Shanghai). Returns: JSON { iso, local, timezone }.',
    inputSchema: {
      type: 'object',
      properties: {
        timezone: { type: 'string', description: 'IANA timezone, defaults to Asia/Shanghai' },
      },
    },
  },
];

const RESOURCES = [
  {
    uri: 'swarm://clock',
    name: 'Current time',
    description: 'Current date and time as JSON, same payload as the get_current_time tool.',
    mimeType: 'application/json',
  },
  {
    uri: 'swarm://tools',
    name: 'Tool catalog',
    description: 'JSON list of the tools this server exposes, for discovery and debugging.',
    mimeType: 'application/json',
  },
];

const PROMPTS = [
  {
    name: 'research_brief',
    description: 'Build a short research brief for a topic, used before the researcher agent starts.',
    arguments: [
      { name: 'topic', description: 'What to research', required: true },
      { name: 'depth', description: 'quick | comprehensive | exhaustive', required: false },
    ],
  },
];

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function fail(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function textResult(text, structured) {
  return { content: [{ type: 'text', text }], ...(structured ? { structuredContent: structured } : {}) };
}

function nowPayload(timezone = 'Asia/Shanghai') {
  const now = new Date();
  let local = now.toISOString();
  try {
    local = new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(now);
  } catch {
    // 时区非法时只回 ISO
  }
  return { iso: now.toISOString(), local, timezone };
}

async function webSearch(args) {
  const query = typeof args?.query === 'string' ? args.query.trim().slice(0, 200) : '';
  const count = Math.min(Math.max(Number(args?.count) || 5, 1), 10);
  if (!query) throw new Error('query is required');
  const key = process.env.BOCHA_API_KEY;
  if (!key) throw new Error('BOCHA_API_KEY is not configured');
  const response = await fetch(BOCHA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, summary: true, count, freshness: 'noLimit' }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`bocha HTTP ${response.status}`);
  const data = await response.json();
  const pages = data?.data?.webPages?.value ?? data?.webPages?.value ?? [];
  const results = (Array.isArray(pages) ? pages : [])
    .slice(0, count)
    .map((page) => ({
      title: String(page?.name ?? page?.title ?? '').trim(),
      url: String(page?.url ?? '').trim(),
      snippet: String(page?.snippet ?? page?.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, 400),
      site: String(page?.siteName ?? '').trim(),
    }))
    .filter((item) => item.url);
  return textResult(JSON.stringify({ query, count: results.length, results }), { results });
}

function currentTime(args) {
  const payload = nowPayload(typeof args?.timezone === 'string' && args.timezone ? args.timezone : 'Asia/Shanghai');
  return textResult(JSON.stringify(payload), payload);
}

function readResource(args) {
  const uri = typeof args?.uri === 'string' ? args.uri : '';
  if (uri === 'swarm://clock') {
    const payload = nowPayload();
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(payload) }] };
  }
  if (uri === 'swarm://tools') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(TOOLS.map((tool) => ({ name: tool.name, description: tool.description }))),
        },
      ],
    };
  }
  throw new Error(`unknown resource: ${uri}`);
}

function buildPrompt(args) {
  const topic = typeof args?.topic === 'string' ? args.topic.trim() : '';
  if (!topic) throw new Error('topic is required');
  const depth = typeof args?.depth === 'string' ? args.depth : 'comprehensive';
  const instruction =
    depth === 'quick'
      ? 'Three to five sentences, only the essentials.'
      : depth === 'exhaustive'
        ? 'Cover definitions, mechanisms, evidence, controversies and open questions.'
        : 'Cover definitions, mechanisms, one concrete example and current limits.';
  return {
    description: `Research brief for ${topic}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Research topic: ${topic}\n${instruction}\nReturn a short brief with facts and sources you can cite.`,
        },
      },
    ],
  };
}

const HANDLERS = {
  web_search: webSearch,
  get_current_time: currentTime,
};

async function handle(message) {
  const { id, method, params } = message;
  const isNotification = id === undefined || id === null;
  if (method === 'initialize') {
    reply(id, {
      protocolVersion: params?.protocolVersion ?? PROTOCOL_VERSION,
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false, subscribe: false },
        prompts: { listChanged: false },
      },
      serverInfo: SERVER_INFO,
    });
    return;
  }
  if (method === 'notifications/initialized' || isNotification) return;
  if (method === 'ping') {
    reply(id, {});
    return;
  }
  if (method === 'tools/list') {
    reply(id, { tools: TOOLS });
    return;
  }
  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments ?? {};
    const handler = HANDLERS[name];
    if (!handler) {
      reply(id, { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true });
      return;
    }
    try {
      reply(id, await handler(args));
    } catch (error) {
      reply(id, {
        content: [{ type: 'text', text: error instanceof Error ? error.message : 'tool failed' }],
        isError: true,
      });
    }
    return;
  }
  if (method === 'resources/list') {
    reply(id, { resources: RESOURCES });
    return;
  }
  if (method === 'resources/read') {
    try {
      reply(id, readResource(params ?? {}));
    } catch (error) {
      fail(id, -32602, error instanceof Error ? error.message : 'resource failed');
    }
    return;
  }
  if (method === 'prompts/list') {
    reply(id, { prompts: PROMPTS });
    return;
  }
  if (method === 'prompts/get') {
    try {
      reply(id, buildPrompt(params?.arguments ?? {}));
    } catch (error) {
      fail(id, -32602, error instanceof Error ? error.message : 'prompt failed');
    }
    return;
  }
  fail(id, -32601, `method not found: ${method}`);
}

const reader = createInterface({ input: process.stdin });
reader.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
    return;
  }
  handle(message).catch((error) => {
    if (message?.id) fail(message.id, -32603, error instanceof Error ? error.message : 'internal error');
  });
});

reader.on('close', () => process.exit(0));
process.stdout.on('error', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
