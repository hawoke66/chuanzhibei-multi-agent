/* 服务端图片 OCR：走硅基流动（SiliconFlow）免费层的 deepseek-ai/DeepSeek-OCR。
   浏览器端优先用 Tesseract.js（无需 Key）；只有浏览器 OCR 失败且配置了
   SILICONFLOW_API_KEY 时才回退到这里。没有 Key 时返回 configured=false，不报错。 */

export interface OcrOutcome {
  configured: boolean;
  text: string;
  error?: string;
}

const ENDPOINT = 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-OCR';
const TIMEOUT_MS = 45000;

export function isOcrConfigured(): boolean {
  return Boolean(process.env.SILICONFLOW_API_KEY);
}

export async function recognizeImage(imageDataUrl: string, lang: 'zh' | 'en' = 'zh'): Promise<OcrOutcome> {
  const key = process.env.SILICONFLOW_API_KEY;
  if (!key) return { configured: false, text: '', error: 'SILICONFLOW_API_KEY 未配置' };

  const instruction =
    lang === 'en'
      ? 'Extract every readable character from this image as plain text. Keep line breaks. Output text only.'
      : '把这张图片里所有可读文字提取成纯文本，保留换行，只输出文字本身。';

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageDataUrl } },
              { type: 'text', text: instruction },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return { configured: true, text: '', error: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = (data.choices?.[0]?.message?.content ?? '').trim();
    return { configured: true, text };
  } catch (error) {
    return {
      configured: true,
      text: '',
      error: error instanceof Error ? error.message : 'ocr failed',
    };
  }
}
