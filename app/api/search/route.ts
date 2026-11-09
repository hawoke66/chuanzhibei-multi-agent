import { NextResponse } from 'next/server';
import { searchWeb } from '../../../lib/search';


/** 联网搜索路由：服务端调用博查，Key 只读环境变量。 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return NextResponse.json({ configured: true, results: [], error: 'query required' }, { status: 400 });
  }
  const count = typeof body?.count === 'number' ? Math.min(Math.max(body.count, 1), 10) : 5;
  const outcome = await searchWeb(query, count);
  return NextResponse.json(outcome, { headers: { 'Cache-Control': 'no-store' } });
}
