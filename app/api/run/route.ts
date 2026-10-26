import { NextResponse } from 'next/server';
import { dispatchTask } from '../../../lib/dispatcher';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const task = typeof body?.task === 'string' ? body.task.trim() : '';
  if (!task) {
    return NextResponse.json({ error: '请先输入任务' }, { status: 400 });
  }
  try {
    const plan = await dispatchTask(task);
    return NextResponse.json({ plan });
  } catch (e) {
    const message = e instanceof Error ? e.message : '调度失败';
    const status = message.includes('DEEPSEEK_API_KEY') ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
