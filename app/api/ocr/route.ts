import { NextResponse } from 'next/server';
import {
  DEFAULT_OCR_MODE,
  isOcrConfigured,
  normalizeOcrMode,
  recognizeImage,
} from '../../../lib/ocr';

const MAX_DATA_URL_BYTES = 8 * 1024 * 1024;
const ALLOWED_PREFIXES = ['data:image/png', 'data:image/jpeg', 'data:image/jpg', 'data:image/webp'];

/** 图片 OCR 路由：浏览器端 Tesseract 失败时的服务端备选（DeepSeek-OCR）。
    与 deepseek-ocr skill 对齐：支持 mode，Key 走环境变量或密钥文件，只读不写。 */
export async function POST(request: Request) {
  if (!isOcrConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        text: '',
        mode: DEFAULT_OCR_MODE,
        error:
          'DeepSeek-OCR 未配置：需要 DEEPSEEK_OCR_API_KEY（或 SILICONFLOW_API_KEY，或 ~/.config/deepseek-ocr/key）',
      },
      { status: 200 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const image = typeof body?.image === 'string' ? body.image : '';
  const mode = normalizeOcrMode(body?.mode);
  const lang = body?.lang === 'en' ? 'en' : 'zh';

  if (!image) {
    return NextResponse.json({ configured: true, text: '', mode, error: 'image data url required' }, { status: 400 });
  }
  if (!ALLOWED_PREFIXES.some((prefix) => image.startsWith(prefix))) {
    return NextResponse.json(
      { configured: true, text: '', mode, error: 'image must be a PNG / JPEG / WebP data URL' },
      { status: 415 },
    );
  }
  if (image.length > MAX_DATA_URL_BYTES) {
    return NextResponse.json({ configured: true, text: '', mode, error: 'image too large (8MB)' }, { status: 413 });
  }

  const outcome = await recognizeImage(image, lang, mode);
  return NextResponse.json(outcome, { headers: { 'Cache-Control': 'no-store' } });
}
