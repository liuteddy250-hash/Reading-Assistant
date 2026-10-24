import { glossaryLookup, guessPos, offlineMeaning } from './glossary';
import { chatJSON, chatText, llmEnabled } from './llm';

export type TranslationResult = {
  translation: string | null;
  provider: 'llm' | 'libretranslate' | 'offline' | 'none';
  degraded: boolean;
  message?: string;
};

export type WordInfo = {
  word: string;
  phonetic?: string;
  pos?: string;
  meaning: string;
  example?: string;
  provider: 'llm' | 'offline';
  degraded: boolean;
};

function libretranslateConfigured(): boolean {
  return Boolean((process.env.LIBRETRANSLATE_URL ?? '').trim());
}

async function viaLibreTranslate(text: string): Promise<string | null> {
  const url = (process.env.LIBRETRANSLATE_URL ?? '').trim().replace(/\/+$/, '');
  if (!url) return null;
  try {
    const res = await fetch(`${url}/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: 'zh',
        format: 'text',
        api_key: process.env.LIBRETRANSLATE_API_KEY || undefined,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { translatedText?: string };
    return data.translatedText?.trim() || null;
  } catch {
    return null;
  }
}

function offlineWord(text: string): string | null {
  const tokens = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  if (tokens.length === 0) return null;

  if (tokens.length <= 3) {
    const parts = tokens
      .map((token) => {
        const info = offlineMeaning(token);
        return info.found ? `${token}：${info.zh}` : null;
      })
      .filter(Boolean);
    if (parts.length > 0) return `${parts.join('；')}（离线词典）`;
    return null;
  }

  const glossed = tokens
    .map((token) => {
      const hit = glossaryLookup(token);
      return hit ? `${token}（${hit.zh}）` : null;
    })
    .filter(Boolean)
    .slice(0, 12);

  if (glossed.length === 0) return null;
  return `离线模式仅能提供词条释义：${glossed.join('；')}`;
}

/**
 * Sentence/phrase translation with graceful degradation:
 * LLM -> LibreTranslate -> bundled dictionary -> explicit failure.
 */
export async function translateText(text: string, context?: string): Promise<TranslationResult> {
  const clean = text.trim();
  if (!clean) {
    return { translation: null, provider: 'none', degraded: false, message: '没有可翻译的内容' };
  }

  if (llmEnabled()) {
    try {
      const translation = await chatText(
        '你是专业的英汉翻译。只输出中文译文，不要解释、不要加引号。若输入是单词或短语，输出简洁的词义。',
        `待翻译内容：${clean}\n${context ? `所在句子：${context.slice(0, 600)}` : ''}`,
      );
      return { translation, provider: 'llm', degraded: false };
    } catch (error) {
      console.warn('[translate] LLM failed, falling back:', (error as Error).message);
    }
  }

  if (libretranslateConfigured()) {
    const translation = await viaLibreTranslate(clean);
    if (translation) {
      return {
        translation,
        provider: 'libretranslate',
        degraded: true,
        message: '大模型不可用，已改用 LibreTranslate',
      };
    }
  }

  const fallback = offlineWord(clean);
  if (fallback) {
    return {
      translation: fallback,
      provider: 'offline',
      degraded: true,
      message: '翻译服务不可用，已降级为内置离线词典（词级释义）',
    };
  }

  return {
    translation: null,
    provider: 'none',
    degraded: true,
    message: '翻译服务当前不可用，请稍后重试，或在 .env 中配置 LLM_API_KEY',
  };
}

export async function lookupWord(word: string, context?: string): Promise<WordInfo> {
  const clean = word.replace(/[^A-Za-z'’-]/g, '');
  if (!clean) {
    return { word, meaning: '无效的单词', provider: 'offline', degraded: true };
  }

  if (llmEnabled()) {
    try {
      const data = await chatJSON<{
        phonetic?: string;
        pos?: string;
        meaning?: string;
        example?: string;
      }>(
        '你是英语词典。只输出 JSON，字段为 phonetic(IPA 音标)、pos(词性缩写)、meaning(结合语境的中文释义)、example(一个英文例句，可留空)。',
        `单词：${clean}\n${context ? `语境：${context.slice(0, 400)}` : ''}`,
      );
      if (data.meaning) {
        return {
          word: clean,
          phonetic: data.phonetic,
          pos: data.pos,
          meaning: data.meaning,
          example: data.example,
          provider: 'llm',
          degraded: false,
        };
      }
    } catch (error) {
      console.warn('[lookupWord] LLM failed, falling back:', (error as Error).message);
    }
  }

  const offline = offlineMeaning(clean);
  return {
    word: clean,
    pos: offline.pos,
    meaning: offline.zh,
    provider: 'offline',
    degraded: true,
  };
}

export function offlineGlossPreview(word: string): string | undefined {
  const hit = glossaryLookup(word);
  if (hit) return `${hit.pos} ${hit.zh}`.trim();
  const pos = guessPos(word);
  return pos || undefined;
}
