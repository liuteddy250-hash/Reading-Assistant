import { requireUser } from '@/lib/auth';
import { HttpError, errorResponse } from '@/lib/errors';
import { lookupWord, translateText } from '@/lib/translate';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireUser();

    const body = (await request.json().catch(() => ({}))) as {
      text?: string;
      context?: string;
      mode?: 'word' | 'sentence';
    };

    const text = String(body.text ?? '').trim();
    if (!text) throw new HttpError(400, '缺少要翻译的文本');
    if (text.length > 2000) throw new HttpError(413, '选中文本过长，请分段翻译');

    if (body.mode === 'word' || (/^[A-Za-z][A-Za-z'’-]*$/.test(text) && text.length < 40)) {
      const info = await lookupWord(text, body.context);
      return Response.json({ mode: 'word', ...info });
    }

    const result = await translateText(text, body.context);
    return Response.json({ mode: 'sentence', ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
