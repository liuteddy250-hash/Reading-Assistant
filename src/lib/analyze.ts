import { isCommonWord } from './common-words';
import { dictLookup } from './dictionary';
import { glossaryLookup, guessPos } from './glossary';
import { countWords, normalizeWord, splitSentences } from './text';

export type HardWord = {
  word: string;
  level: number; // 1 = 略难, 2 = 难, 3 = 高难
  count: number;
  pos?: string;
  meaning?: string;
};

export type LongSentence = {
  text: string;
  wordCount: number;
  clauses: number;
  connectors: string[];
};

export type ChapterAnalysis = {
  wordCount: number;
  hardWords: HardWord[];
  longSentences: LongSentence[];
};

const CLAUSE_RE =
  /\b(which|that|who|whom|whose|where|when|while|whereas|although|though|because|since|unless|until|whether|if|so that|even though|in spite of|despite|rather than|not only|as if|as though|after|before|once)\b/gi;

export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const cleaned = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  const groups = cleaned.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/**
 * 0 = easy, 1..4 = increasingly difficult.
 *
 * Primary signal: ECDICT exam tags (zk/gk/cet4 -> 1, cet6/ky -> 2, toefl/ielts
 * -> 3, gre -> 4) and COCA/BNC frequency ranks. Words missing from ECDICT fall
 * back to the morphology heuristic (length / syllables / suffixes).
 */
export function difficultyScore(raw: string): number {
  const word = normalizeWord(raw);
  if (!word || word.length < 6) return 0;
  if (isCommonWord(word)) return 0;

  const entry = dictLookup(word);
  if (entry) {
    const tags = (entry.tag ?? '').split(/\s+/).filter(Boolean);
    if (tags.includes('gre')) return 4;
    if (tags.includes('toefl') || tags.includes('ielts')) return 3;
    if (tags.includes('cet6') || tags.includes('ky')) return 2;
    if (tags.includes('cet4') || tags.includes('gk') || tags.includes('zk')) return 1;

    const rank = entry.frq ?? entry.bnc ?? 0;
    if (rank > 0) {
      if (rank < 8000) return 1;
      if (rank < 15000) return 2;
      if (rank < 25000) return 3;
      return 4;
    }
    return 3;
  }

  // Not in the dictionary (names, coinages): keep the old heuristic.
  let score = 0;
  if (word.length >= 8) score += 1;
  if (word.length >= 11) score += 2;
  if (syllables(word) >= 4) score += 1;
  if (/(tion|sion|ance|ence|ity|ism|ous|ive|ic|al|ary|ory|ate|ify|ize)$/.test(word)) score += 1;
  if (/(ology|ography|aceous|esque|isation|ization|itude|ennial|ferous|escing)/.test(word)) score += 2;
  return Math.min(score, 6);
}

export function difficultyLevel(score: number): number {
  if (score >= 4) return 3;
  if (score >= 2) return 2;
  if (score >= 1) return 1;
  return 0;
}

function looksLikeProperNoun(token: string): boolean {
  return /^[A-Z][a-z'’-]+$/.test(token) && !glossaryLookup(token);
}

function collectLongSentences(paragraphs: string[], limit: number): LongSentence[] {
  const scored: LongSentence[] = [];
  for (const paragraph of paragraphs) {
    for (const sentence of splitSentences(paragraph)) {
      const words = countWords(sentence);
      if (words < 16) continue;
      const connectors = Array.from(
        new Set((sentence.match(CLAUSE_RE) ?? []).map((c) => c.toLowerCase())),
      );
      const commas = (sentence.match(/,/g) ?? []).length;
      const score = words + connectors.length * 5 + commas * 1.5;
      scored.push({
        text: sentence,
        wordCount: words,
        clauses: Math.max(connectors.length, Math.floor(commas / 2)),
        connectors,
      });
      (scored[scored.length - 1] as LongSentence & { score?: number }).score = score;
    }
  }
  scored.sort(
    (a, b) =>
      ((b as LongSentence & { score?: number }).score ?? 0) -
      ((a as LongSentence & { score?: number }).score ?? 0),
  );
  return scored.slice(0, limit).map(({ text, wordCount, clauses, connectors }) => ({
    text,
    wordCount,
    clauses,
    connectors,
  }));
}

export function analyzeChapter(content: string): ChapterAnalysis {
  const paragraphs = content
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const stats = new Map<string, { surface: string; count: number; score: number }>();

  for (const paragraph of paragraphs) {
    const tokens = paragraph.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
    tokens.forEach((token, index) => {
      if (token.length < 6) return;
      if (looksLikeProperNoun(token) && index > 0) return;
      const word = normalizeWord(token);
      if (!word) return;
      const score = difficultyScore(word);
      if (score < 2) return;
      const current = stats.get(word);
      if (current) current.count += 1;
      else stats.set(word, { surface: token, count: 1, score });
    });
  }

  const hardWords: HardWord[] = Array.from(stats.entries())
    .map(([word, info]) => {
      const gloss = glossaryLookup(word);
      return {
        word,
        level: difficultyLevel(info.score),
        count: info.count,
        pos: gloss?.pos || guessPos(word) || undefined,
        meaning: gloss?.zh,
        score: info.score,
      };
    })
    .sort((a, b) => b.score - a.score || b.count - a.count || b.word.length - a.word.length)
    .slice(0, 40)
    .map(({ score, ...rest }) => rest);

  return {
    wordCount: countWords(content),
    hardWords,
    longSentences: collectLongSentences(paragraphs, 6),
  };
}

/** Compact map used by the reader to highlight words. */
export function highlightIndex(content: string): Record<string, { level: number; meaning?: string }> {
  const index: Record<string, { level: number; meaning?: string }> = {};
  for (const item of analyzeChapter(content).hardWords) {
    if (item.level >= 2) index[item.word] = { level: item.level, meaning: item.meaning };
  }
  return index;
}

const analysisCache = new Map<string, ChapterAnalysis>();
const ANALYSIS_CACHE_LIMIT = 120;

/**
 * Chapter content is immutable for a given chapter id (re-splitting creates new
 * rows), so the analysis can be memoised safely.
 */
export function analyzeChapterCached(chapterId: string, content: string): ChapterAnalysis {
  const hit = analysisCache.get(chapterId);
  if (hit) return hit;

  if (analysisCache.size >= ANALYSIS_CACHE_LIMIT) analysisCache.clear();
  const result = analyzeChapter(content);
  analysisCache.set(chapterId, result);
  return result;
}

/** Cached variant of {@link highlightIndex}. */
export function highlightIndexFor(
  chapterId: string,
  content: string,
): Record<string, { level: number; meaning?: string }> {
  const index: Record<string, { level: number; meaning?: string }> = {};
  for (const item of analyzeChapterCached(chapterId, content).hardWords) {
    if (item.level >= 2) index[item.word] = { level: item.level, meaning: item.meaning };
  }
  return index;
}
