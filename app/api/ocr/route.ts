import { NextResponse } from 'next/server';
import { isOcrConfigured, recognizeImage } from '../../../lib/ocr';


const MAX_DATA_URL_BYTES = 8 * 1024 * 1024;

/** 图片 OCR 路由：浏览器端 Tesseract 失败时的服务端备选，Key 只读环境变量。 */
export async function POST(request: Request) {
  if (!isOcrConfigured()) {
    return NextResponse.json({ configured: false, text: '', error: 'ocr not configured' }, { status: 200 });
  }
  const body = await request.json().catch(() => ({}));
  const image = typeof body?.image === 'string' ? body.image : '';
  const lang = body?.lang === 'en' ? 'en' : 'zh';
  if (!image.startsWith('data:image/')) {
    return NextResponse.json({ configured: true, text: '', error: 'image data url required' }, { status: 400 });
  }
  if (image.length > MAX_DATA_URL_BYTES) {
    return NextResponse.json({ configured: true, text: '', error: 'image too large' }, { status: 413 });
  }
  const outcome = await recognizeImage(image, lang);
  return NextResponse.json(outcome, { headers: { 'Cache-Control': 'no-store' } });
}
