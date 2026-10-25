import { prisma } from './db';
import { HttpError } from './errors';
import { analyzeChapter, type LongSentence } from './analyze';
import { glossaryLookup, guessPos } from './glossary';
import { chatJSON, llmEnabled, llmModel } from './llm';
import { truncate } from './text';
import type { PrestudyPayload, PrestudySentence, PrestudyWord } from './types';

const MAX_CONTENT_CHARS = 6000;

const CLAUSE_MARKER =
  /\b(which|that|who|whom|whose|where|when|while|whereas|although|though|because|since|unless|until|whether|if|so that|even though|in spite of|despite|rather than|not only|as if|as though)\b/gi;

function chunkSentence(sentence: string): string[] {
  const chunks: string[] = [];
  let lastIndex = 0;
  CLAUSE_MARKER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CLAUSE_MARKER.exec(sentence)) !== null) {
    const start = match.index;
    if (start - lastIndex > 3) {
      chunks.push(sentence.slice(lastIndex, start).trim());
      lastIndex = start;
    }
  }
  const tail = sentence.slice(lastIndex).trim();
  if (tail) chunks.push(tail);
  return chunks.filter(Boolean).slice(0, 8);
}

function describeStructure(item: LongSentence): string {
  const bits: string[] = [];
  if (item.connectors.length > 0) {
    bits.push(`含从句/修饰引导词：${item.connectors.slice(0, 5).join('、')}`);
  }
  if (item.clauses >= 2) {
    bits.push(`共约 ${item.clauses} 个从句层次，注意主句谓语与修饰成分的挂接关系`);
  } else {
    bits.push('句子较长但层次较少，先找主句的谓语动词，再处理插入语');
  }
  bits.push(`共 ${item.wordCount} 词，可先按连接词切成 ${chunkSentence(item.text).length} 个意群再理解`);
  return bits.join('；');
}

function offlinePrestudy(chapter: { title: string; content: string }): PrestudyPayload {
  const analysis = analyzeChapter(chapter.content);

  const sentences: PrestudySentence[] = analysis.longSentences.map((item) => ({
    text: item.text,
    structure: describeStructure(item),
    translation: '（离线模式未生成参考译文；配置大模型后重新生成即可补充）',
    chunks: chunkSentence(item.text),
  }));

  const words: PrestudyWord[] = analysis.hardWords.slice(0, 18).map((item) => {
    const gloss = glossaryLookup(item.word);
    return {
      word: item.word,
      pos: gloss?.pos || guessPos(item.word) || undefined,
      phonetic: gloss?.phonetic,
      meaning: gloss?.zh
        ? truncate(gloss.zh, 160)
        : `离线词库未收录该词。可先按词形判断词性（${guessPos(item.word) || '未知'}），阅读时点击该词查询在线释义。`,
    };
  });

  const summary =
    `本章约 ${analysis.wordCount} 词，系统自动挑出 ${sentences.length} 个长难句与 ${words.length} 个高难度词汇。` +
    (llmEnabled()
      ? '（大模型调用失败，已回退到离线分析）'
      : '（当前为离线分析模式，未调用大模型）') +
    ' 建议先扫一遍生词，再逐句拆解长难句，最后进入正文阅读。';

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'offline',
    summary,
    sentences,
    words,
  };
}

async function llmPrestudy(
  chapter: { title: string; content: string },
): Promise<PrestudyPayload> {
  const analysis = analyzeChapter(chapter.content);
  const excerpt = chapter.content.slice(0, MAX_CONTENT_CHARS);

  const result = await chatJSON<{
    summary?: string;
    sentences?: { text?: string; structure?: string; translation?: string }[];
    words?: { word?: string; phonetic?: string; pos?: string; meaning?: string; example?: string }[];
  }>(
    [
      '你是一位资深英语阅读教师，为中国学习者准备「课前预习」材料。',
      '只输出 JSON 对象，不要 markdown 代码块，不要额外解释。',
      'JSON 结构：',
      '{"summary":"80-150字中文导读：本章主题、难点分布、阅读建议",',
      '"sentences":[{"text":"原文句子","structure":"中文拆解：主句/从句/修饰关系/难点","translation":"准确流畅的中文译文"}],',
      '"words":[{"word":"原文词形","phonetic":"IPA音标","pos":"词性缩写","meaning":"结合语境的中文释义","example":"英文例句 + 中文翻译"}]}',
      'sentences 取 4-6 句最值得讲的长难句；words 取 10-15 个最可能阻碍理解的词。',
    ].join('\n'),
    [
      `章节标题：${chapter.title}`,
      `全章词数：${analysis.wordCount}`,
      `候选长难句（系统预筛，可替换）：`,
      ...analysis.longSentences.map((s, i) => `${i + 1}. ${s.text}`),
      `候选难词：${analysis.hardWords.slice(0, 25).map((w) => w.word).join(', ')}`,
      `章节正文（可能截断）：\n${excerpt}`,
    ].join('\n'),
  );

  const sentences: PrestudySentence[] = (result.sentences ?? [])
    .filter((s) => s.text && s.translation)
    .slice(0, 8)
    .map((s) => ({
      text: String(s.text).trim(),
      structure: String(s.structure ?? '').trim(),
      translation: String(s.translation).trim(),
    }));

  const words: PrestudyWord[] = (result.words ?? [])
    .filter((w) => w.word && w.meaning)
    .slice(0, 20)
    .map((w) => ({
      word: String(w.word).trim(),
      phonetic: w.phonetic ? String(w.phonetic).trim() : undefined,
      pos: w.pos ? String(w.pos).trim() : undefined,
      meaning: String(w.meaning).trim(),
      example: w.example ? String(w.example).trim() : undefined,
    }));

  if (sentences.length === 0 && words.length === 0) {
    throw new Error('LLM returned an unusable pre-study payload');
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'llm',
    model: llmModel(),
    summary: String(result.summary ?? '').trim() || '本章预习材料已生成。',
    sentences,
    words,
  };
}

export async function buildPrestudy(chapter: { title: string; content: string }): Promise<PrestudyPayload> {
  if (llmEnabled()) {
    try {
      return await llmPrestudy(chapter);
    } catch (error) {
      console.warn('[prestudy] LLM failed, using offline analysis:', (error as Error).message);
    }
  }
  return offlinePrestudy(chapter);
}

export type PrestudyRecord = {
  payload: PrestudyPayload;
  studiedAt: Date | null;
  source: string;
};

export async function ensurePrestudy(chapterId: string, force = false): Promise<PrestudyRecord> {
  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
  if (!chapter) throw new HttpError(404, '章节不存在');

  const existing = await prisma.prestudy.findUnique({ where: { chapterId } });

  if (existing && !force) {
    try {
      return {
        payload: JSON.parse(existing.payload) as PrestudyPayload,
        studiedAt: existing.studiedAt,
        source: existing.source,
      };
    } catch {
      // fall through and regenerate a corrupt payload
    }
  }

  const payload = await buildPrestudy({ title: chapter.title, content: chapter.content });
  const saved = await prisma.prestudy.upsert({
    where: { chapterId },
    create: {
      chapterId,
      payload: JSON.stringify(payload),
      source: payload.source,
      model: payload.model,
      status: 'ready',
      studiedAt: existing?.studiedAt ?? null,
    },
    update: {
      payload: JSON.stringify(payload),
      source: payload.source,
      model: payload.model,
      status: 'ready',
    },
  });

  return { payload, studiedAt: saved.studiedAt, source: saved.source };
}
