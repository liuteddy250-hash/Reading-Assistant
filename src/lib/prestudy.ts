import { prisma } from './db';
import { HttpError } from './errors';
import { analyzeChapter, type ChapterAnalysis, type LongSentence } from './analyze';
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

function structureFor(text: string, analysis: ChapterAnalysis): string {
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
  const target = normalize(text);
  const match = analysis.longSentences.find(
    (item) => normalize(item.text) === target || normalize(item.text).includes(target) || target.includes(normalize(item.text)),
  );
  if (match) return describeStructure(match);

  CLAUSE_MARKER.lastIndex = 0;
  const connectors = Array.from(new Set((text.match(CLAUSE_MARKER) ?? []).map((c) => c.toLowerCase())));
  const words = text.split(/\s+/).filter(Boolean).length;
  return connectors.length > 0
    ? `含引导词：${connectors.slice(0, 5).join('、')}；共 ${words} 词，先找主句谓语，再按连接词切分意群。`
    : `共 ${words} 词，先找主句谓语，再处理插入语与并列成分。`;
}

function offlineSentences(analysis: ChapterAnalysis): PrestudySentence[] {
  return analysis.longSentences.map((item) => ({
    text: item.text,
    structure: describeStructure(item),
    translation: '（本地规则模式未生成参考译文；启动本地模型后点「重新生成预习材料」即可补充）',
    chunks: chunkSentence(item.text),
  }));
}

function offlineWords(analysis: ChapterAnalysis): PrestudyWord[] {
  return analysis.hardWords.slice(0, 18).map((item) => {
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
}

function offlinePrestudy(chapter: { title: string; content: string }): PrestudyPayload {
  const analysis = analyzeChapter(chapter.content);
  const sentences = offlineSentences(analysis);
  const words = offlineWords(analysis);

  const summary =
    `本章约 ${analysis.wordCount} 词，系统自动挑出 ${sentences.length} 个长难句与 ${words.length} 个高难度词汇。` +
    (llmEnabled()
      ? '（大模型调用失败，已回退到本地规则分析）'
      : '（本地规则模式：未调用大模型）') +
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

/**
 * Two small calls instead of one big JSON: small local models (3B) often
 * truncate or loop when asked for summary + sentences + words at once.
 */
async function llmPrestudy(chapter: { title: string; content: string }): Promise<PrestudyPayload> {
  const analysis = analyzeChapter(chapter.content);
  const excerpt = chapter.content.slice(0, MAX_CONTENT_CHARS);
  const candidates = analysis.longSentences.map((s, i) => `${i + 1}. ${s.text}`).join('\n');

  const sentencePart = await chatJSON<{
    summary?: string;
    sentences?: { text?: string; translation?: string }[];
  }>(
    [
      '你是一位资深英语翻译与阅读教师，为中国学习者翻译英文书中的长难句。',
      '只输出一个 JSON 对象，不要 markdown、不要解释。',
      '格式：{"summary":"80-120字中文导读：本章主题、难点与阅读建议",',
      '"sentences":[{"text":"原文句子（必须逐字摘自正文）","translation":"准确、通顺的中文译文"}]}',
      '只取 2-3 句最长最难的句子；translation 不能为空，不要保留英文单词。',
    ].join('\n'),
    [
      `章节标题：${chapter.title}`,
      `全章词数：${analysis.wordCount}`,
      '候选长难句（可替换）：',
      candidates || '（无，请从正文中自行挑选最难的句子）',
      `正文（可能截断）：\n${excerpt}`,
    ].join('\n'),
  );

  const sentences: PrestudySentence[] = (sentencePart.sentences ?? [])
    .filter((item) => item.text && item.translation)
    .slice(0, 3)
    .map((item) => {
      const text = String(item.text).trim();
      return {
        text,
        structure: structureFor(text, analysis),
        translation: String(item.translation).trim(),
        chunks: chunkSentence(text),
      };
    });

  if (sentences.length === 0) {
    throw new Error('LLM returned no usable long sentences');
  }

  // Words are a separate, smaller request; a failure here only degrades that part.
  let words: PrestudyWord[] = [];
  try {
    const wordPart = await chatJSON<{
      words?: { word?: string; phonetic?: string; pos?: string; meaning?: string; example?: string }[];
    }>(
      [
        '你是英语词汇教师。只输出一个 JSON 对象，不要解释。',
        '格式：{"words":[{"word":"原文词形","phonetic":"IPA音标","pos":"词性缩写","meaning":"结合语境的中文释义","example":"英文例句 + 中文翻译"}]}',
        '只取 6-8 个最可能阻碍理解的词；每个词必须有 meaning。',
      ].join('\n'),
      [
        `章节标题：${chapter.title}`,
        `候选难词：${analysis.hardWords.slice(0, 25).map((w) => w.word).join(', ')}`,
        `正文（可能截断）：\n${excerpt}`,
      ].join('\n'),
    );

    words = (wordPart.words ?? [])
      .filter((item) => item.word && item.meaning)
      .slice(0, 10)
      .map((item) => ({
        word: String(item.word).trim(),
        phonetic: item.phonetic ? String(item.phonetic).trim() : undefined,
        pos: item.pos ? String(item.pos).trim() : undefined,
        meaning: String(item.meaning).trim(),
        example: item.example ? String(item.example).trim() : undefined,
      }));
  } catch (error) {
    console.warn('[prestudy] word generation failed, using dictionary:', (error as Error).message);
  }

  // Small models often return too few words; fill up from ECDICT instead of failing.
  if (words.length < 5) {
    const seen = new Set(words.map((item) => item.word.toLowerCase()));
    for (const fallback of offlineWords(analysis)) {
      if (words.length >= 10) break;
      if (seen.has(fallback.word.toLowerCase())) continue;
      seen.add(fallback.word.toLowerCase());
      words.push(fallback);
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'llm',
    model: llmModel(),
    summary:
      String(sentencePart.summary ?? '').trim() ||
      `本章约 ${analysis.wordCount} 词，已生成 ${sentences.length} 个长难句讲解与 ${words.length} 个重点词。`,
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
