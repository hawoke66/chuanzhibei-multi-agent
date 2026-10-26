import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const task = typeof body?.task === 'string' ? body.task.trim() : '';
  if (!task) {
    return NextResponse.json({ error: '请先输入任务' }, { status: 400 });
  }
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: '未配置 DEEPSEEK_API_KEY，请在项目根目录新建 .env.local 并写入该变量，然后重启开发服务器' },
      { status: 500 }
    );
  }
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: task }],
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `DeepSeek 调用失败：${res.status} ${text.slice(0, 200)}` },
      { status: 502 }
    );
  }
  const data = await res.json();
  const output = data?.choices?.[0]?.message?.content ?? '';
  return NextResponse.json({ output });
}
