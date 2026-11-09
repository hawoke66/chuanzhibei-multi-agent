#!/usr/bin/env node
/* 最小 MCP 服务器（stdio 传输，JSON-RPC 2.0，按行分隔）。
   只暴露两个工具：web_search（走博查）与 get_current_time。
   由 lib/mcp-client.ts 以子进程方式连接；连接失败时调用方退回本地直调。 */

import { createInterface } from 'node:readline';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'swarm-tool-server', version: '0.1.0' };
const BOCHA_ENDPOINT = 'https://api.bochaai.com/v1/web-search';
const SEARCH_TIMEOUT_MS = 8000;

const TOOLS = [
  {
    name: 'web_search',
    description: 'Search the live web and return titles, snippets and source URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords' },
        count: { type: 'number', description: 'How many results, 1 to 10', default: 5 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_current_time',
    description: 'Return the current date and time in ISO 8601 with timezone offset.',
    inputSchema: {
      type: 'object',
      properties: {
        timezone: { type: 'string', description: 'IANA timezone, defaults to Asia/Shanghai' },
      },
    },
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
  const timezone = typeof args?.timezone === 'string' && args.timezone ? args.timezone : 'Asia/Shanghai';
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
  return textResult(JSON.stringify({ iso: now.toISOString(), local, timezone }), { iso: now.toISOString(), timezone });
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
      capabilities: { tools: { listChanged: false } },
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

process.stdout.on('error', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
