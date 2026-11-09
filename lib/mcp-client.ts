import { spawn } from 'node:child_process';
import path from 'node:path';

/* MCP 客户端：以子进程启动 mcp/server.mjs，走 stdio + JSON-RPC 2.0。
   一次调用一个短会话：initialize → notifications/initialized → tools/call → 结束进程。
   任何一步失败都返回 ok=false，调用方退回本地直调（lib/search.ts）。 */

export interface McpCallResult {
  ok: boolean;
  via: 'mcp' | 'local';
  result?: unknown;
  error?: string;
}

interface Pending {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
}

export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 7000,
): Promise<McpCallResult> {
  const serverPath = path.join(process.cwd(), 'mcp', 'server.mjs');
  return new Promise<McpCallResult>((resolve) => {
    let settled = false;
    let buffer = '';
    let nextId = 1;
    const pending = new Map<number, Pending>();

    const child = spawn(process.execPath, [serverPath], {
      stdio: ['pipe', 'pipe', 'ignore'],
      env: process.env,
      cwd: process.cwd(),
    });

    const finish = (result: McpCallResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const entry of pending.values()) entry.reject(new Error('mcp session closed'));
      pending.clear();
      try {
        child.kill();
      } catch {
        // 进程可能已退出
      }
      resolve(result);
    };

    const timer = setTimeout(() => finish({ ok: false, via: 'mcp', error: 'mcp timeout' }), timeoutMs);

    child.on('error', (error) => finish({ ok: false, via: 'mcp', error: error.message }));
    child.on('exit', (code) => {
      if (!settled) finish({ ok: false, via: 'mcp', error: `mcp exited with ${code}` });
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
        let message: Record<string, unknown>;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        const id = typeof message.id === 'number' ? message.id : null;
        if (id === null) continue;
        const entry = pending.get(id);
        if (!entry) continue;
        pending.delete(id);
        if (message.error) entry.reject(new Error(String((message.error as { message?: string }).message ?? 'mcp error')));
        else entry.resolve((message.result ?? {}) as Record<string, unknown>);
      }
    });

    const call = (method: string, params: Record<string, unknown>) =>
      new Promise<Record<string, unknown>>((resolveCall, rejectCall) => {
        const id = nextId++;
        pending.set(id, { resolve: resolveCall, reject: rejectCall });
        child.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      });

    (async () => {
      try {
        await call('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'swarm-workbench', version: '1.0.0' },
        });
        child.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
        const result = await call('tools/call', { name, arguments: args });
        finish({ ok: true, via: 'mcp', result });
      } catch (error) {
        finish({ ok: false, via: 'mcp', error: error instanceof Error ? error.message : 'mcp failed' });
      }
    })();
  });
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
