import { spawn } from 'node:child_process';
import path from 'node:path';

/* MCP 客户端：以子进程启动 mcp/server.mjs，走 stdio + JSON-RPC 2.0。
   对齐 mcp-setup skill：
   - 连接时先 initialize 握手，再 tools/list 做**工具发现**，只调用发现的工具
   - tools/call 返回 isError 时按失败处理（交给调用方降级），不吞错
   - 连接失败、超时、进程异常退出都返回 ok=false，错误信息里带 stderr 摘要
   - 关闭时先结束 stdin，再 SIGTERM，最后 SIGKILL，避免留下孤儿进程
   一次调用一个短会话；任何一步失败都由调用方退回本地直调（lib/search.ts）。 */

export interface McpCallResult {
  ok: boolean;
  via: 'mcp' | 'local';
  result?: unknown;
  error?: string;
  tools?: string[];
}

export interface McpToolInfo {
  name: string;
  description?: string;
}

const DEFAULT_TIMEOUT_MS = 7000;

type Json = Record<string, unknown>;

function unref(handle: unknown): void {
  (handle as { unref?: () => void }).unref?.();
}
type Requester = (method: string, params?: Json) => Promise<Json>;

interface SessionOutcome<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

function startSession<T>(
  handler: (request: Requester, serverInfo: Json) => Promise<T>,
  timeoutMs: number,
): Promise<SessionOutcome<T>> {
  return new Promise<SessionOutcome<T>>((resolve) => {
    const serverPath = path.join(process.cwd(), 'mcp', 'server.mjs');
    const child = spawn(process.execPath, [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
      cwd: process.cwd(),
    });

    let settled = false;
    let buffer = '';
    let stderr = '';
    let nextId = 1;
    const pending = new Map<number, { resolve: (value: Json) => void; reject: (error: Error) => void }>();

    const shutdown = () => {
      try {
        child.stdin?.end();
      } catch {
        // stdin 可能已关闭
      }
      const term = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch {
          // 进程可能已退出
        }
        const kill = setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {
            // 同上
          }
        }, 400);
        unref(kill);
      }, 150);
      unref(term);
    };

    const finish = (outcome: SessionOutcome<T>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const entry of pending.values()) entry.reject(new Error('mcp session closed'));
      pending.clear();
      shutdown();
      resolve(outcome);
    };

    const timer = setTimeout(() => finish({ ok: false, error: 'mcp timeout' }), timeoutMs);

    child.on('error', (error) => finish({ ok: false, error: `mcp spawn failed: ${error.message}` }));
    child.on('exit', (code, signal) => {
      if (!settled) {
        const suffix = stderr.trim() ? ` · ${stderr.trim().slice(0, 200)}` : '';
        finish({ ok: false, error: `mcp exited (${code ?? signal})${suffix}` });
      }
    });

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-600);
    });

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      buffer += chunk;
      let index = buffer.indexOf('\n');
      while (index >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        index = buffer.indexOf('\n');
        if (!line) continue;
        let message: Json;
        try {
          message = JSON.parse(line) as Json;
        } catch {
          continue;
        }
        const id = typeof message.id === 'number' ? message.id : null;
        if (id === null) continue;
        const entry = pending.get(id);
        if (!entry) continue;
        pending.delete(id);
        if (message.error) {
          const detail = message.error as { message?: string };
          entry.reject(new Error(detail.message ?? 'mcp error'));
        } else {
          entry.resolve((message.result ?? {}) as Json);
        }
      }
    });

    const request: Requester = (method, params = {}) =>
      new Promise<Json>((resolveCall, rejectCall) => {
        const id = nextId++;
        pending.set(id, { resolve: resolveCall, reject: rejectCall });
        child.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      });

    (async () => {
      try {
        const serverInfo = await request('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'swarm-workbench', version: '1.0.0' },
        });
        child.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
        const value = await handler(request, serverInfo);
        finish({ ok: true, value });
      } catch (error) {
        finish({ ok: false, error: error instanceof Error ? error.message : 'mcp failed' });
      }
    })();
  });
}

/** 连接后先做工具发现，返回服务器当前暴露的工具列表。 */
export async function listMcpTools(timeoutMs = 5000): Promise<{ ok: boolean; tools: McpToolInfo[]; error?: string }> {
  const outcome = await startSession(async (request) => {
    const result = await request('tools/list');
    const tools = Array.isArray(result.tools) ? (result.tools as Json[]) : [];
    return tools.map((tool) => ({
      name: String(tool.name ?? ''),
      description: typeof tool.description === 'string' ? tool.description : undefined,
    }));
  }, timeoutMs);
  return { ok: outcome.ok, tools: outcome.value ?? [], error: outcome.error };
}

export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<McpCallResult> {
  const outcome = await startSession(async (request) => {
    const listed = await request('tools/list');
    const tools = Array.isArray(listed.tools) ? (listed.tools as Json[]) : [];
    const names = tools.map((tool) => String(tool.name ?? ''));
    if (!names.includes(name)) {
      throw new Error(`tool not found: ${name}${names.length ? ` (available: ${names.join(', ')})` : ''}`);
    }
    const result = await request('tools/call', { name, arguments: args });
    if (result.isError === true) {
      const payload = readMcpPayload(result);
      throw new Error(typeof payload === 'string' && payload.trim() ? payload : `tool ${name} returned an error`);
    }
    return { result, names };
  }, timeoutMs);

  if (!outcome.ok || !outcome.value) {
    return { ok: false, via: 'mcp', error: outcome.error ?? 'mcp failed' };
  }
  return { ok: true, via: 'mcp', result: outcome.value.result, tools: outcome.value.names };
}

/** 从 MCP tools/call 的结果里取出结构化数据（structuredContent 优先，其次解析 text）。 */
export function readMcpPayload(result: unknown): unknown {
  if (!result || typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;
  if (record.structuredContent) return record.structuredContent;
  const content = record.content;
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0] as Record<string, unknown>;
    if (typeof first?.text === 'string') {
      try {
        return JSON.parse(first.text);
      } catch {
        return first.text;
      }
    }
  }
  return null;
}
