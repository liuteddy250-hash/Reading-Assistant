import { countWords, reflowText } from './text';
import { detectBodyStart, trimToBody } from './frontmatter';

export type ChapterDraft = {
  title: string;
  content: string;
  pageStart: number;
  pageEnd: number;
  wordCount: number;
};

type Line = {
  text: string;
  page: number;
  offset: number;
  prevBlank: boolean;
  nextBlank: boolean;
};

const PATTERNS: RegExp[] = [
  /^(chapter|part|section|book)\s+(\d{1,3}|[ivxlcdm]{1,7}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b[\s.:\-—]*(.*)$/i,
  /^第\s*[一二三四五六七八九十百零〇\d]{1,5}\s*[章节回卷部篇][\s.:：\-—]*(.*)$/,
  // Plays: ACT is a chapter-level boundary (scenes stay inside the act).
  /^act\s+(\d{1,3}|[ivxlcdm]{1,7})\b[\s.:\-—]*(.*)$/i,
  /^(the\s+)?(prologue|epilogue|preface|foreword|introduction|conclusion|afterword|appendix|acknowledg(e)?ments|contents|index)\b[\s.:\-—]*(.*)$/i,
];

const PAGE_NUMBER_RE = /^(?:[-–—]\s*)?(?:\d{1,4}|[ivxlcdm]{1,7})(?:\s*[-–—])?$/i;

function normalizeTitle(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function isPatternHeading(text: string): boolean {
  if (text.length > 90) return false;
  if (PAGE_NUMBER_RE.test(text)) return false;
  return PATTERNS.some((re) => re.test(text));
}

function isGenericHeading(line: Line): boolean {
  const text = line.text;
  if (text.length < 3 || text.length > 64) return false;
  if (PAGE_NUMBER_RE.test(text)) return false;
  if (/[.;:,]$/.test(text)) return false;
  if (!/^[A-Z0-9"'“]/.test(text)) return false;
  if (!line.prevBlank || !line.nextBlank) return false;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 10) return false;

  const titleish = words.filter((w) => /^[A-Z]/.test(w) || /^\d+$/.test(w)).length;
  const ratio = titleish / words.length;
  return ratio >= 0.6 || /^[A-Z0-9\s"'“:,&-]+$/.test(text);
}

/** Builds the chapter-level plain text and remembers where each PDF page starts. */
export function buildFullText(pages: string[]) {
  let full = '';
  const pageStarts: number[] = [];
  const pageNumbers: number[] = [];

  pages.forEach((page, index) => {
    const text = page.trim();
    if (!text) return;
    if (full) full += '\n\n';
    pageStarts.push(full.length);
    pageNumbers.push(index);
    full += text;
  });

  return { full, pageStarts, pageNumbers };
}

function pageOfOffset(pageStarts: number[], pageNumbers: number[], offset: number): number {
  if (pageStarts.length === 0) return 0;
  let lo = 0;
  let hi = pageStarts.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (pageStarts[mid] <= offset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return pageNumbers[found] ?? 0;
}

function collectLines(full: string, pageStarts: number[], pageNumbers: number[], pages: string[]): Line[] {
  const lines: Line[] = [];
  for (let i = 0; i < pageStarts.length; i += 1) {
    const pageText = pages[pageNumbers[i]].trim();
    if (!pageText) continue;
    let cursor = 0;
    for (const raw of pageText.split('\n')) {
      const text = raw.trim();
      lines.push({
        text,
        page: pageNumbers[i],
        offset: pageStarts[i] + cursor,
        prevBlank: false,
        nextBlank: false,
      });
      cursor += raw.length + 1;
    }
  }
  // `full` is built from the same page strings, so cursor offsets stay in sync.
  void full;
  lines.forEach((line, index) => {
    line.prevBlank = index === 0 || lines[index - 1].text === '';
    line.nextBlank = index === lines.length - 1 || lines[index + 1].text === '';
  });
  return lines;
}

function cleanContent(raw: string): string {
  return raw
    .replace(/^\s*\d{1,4}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function finalize(drafts: ChapterDraft[]): ChapterDraft[] {
  const kept: ChapterDraft[] = [];
  for (const draft of drafts) {
    const content = reflowText(cleanContent(draft.content));
    if (!content) continue;
    const item: ChapterDraft = {
      ...draft,
      content,
      title: normalizeTitle(draft.title) || `第 ${kept.length + 1} 章`,
      wordCount: countWords(content),
    };
    // Merge very short fragments into the previous chapter.
    if (item.content.length < 200 && kept.length > 0) {
      const prev = kept[kept.length - 1];
      prev.content = `${prev.content}\n\n${item.content}`.trim();
      prev.pageEnd = Math.max(prev.pageEnd, item.pageEnd);
      prev.wordCount = countWords(prev.content);
      continue;
    }
    kept.push(item);
  }
  return kept;
}

function chaptersFromHeadings(lines: Line[], headings: Line[], full: string, pageStarts: number[], pageNumbers: number[]): ChapterDraft[] {
  const drafts: ChapterDraft[] = [];

  const first = headings[0];
  if (first.offset > 400) {
    const front = cleanContent(full.slice(0, first.offset));
    if (front.length > 400) {
      drafts.push({
        title: '开篇 / Front Matter',
        content: front,
        pageStart: pageOfOffset(pageStarts, pageNumbers, 0),
        pageEnd: pageOfOffset(pageStarts, pageNumbers, Math.max(first.offset - 1, 0)),
        wordCount: countWords(front),
      });
    }
  }

  headings.forEach((heading, index) => {
    const next = headings[index + 1];
    const start = heading.offset + heading.text.length;
    const end = next ? next.offset : full.length;
    const content = cleanContent(full.slice(start, end));
    if (!content) return;
    const chapterLabelMatch = heading.text.match(/^(chapter|part|section|book)\s+[^\s.:\-—]+/i);
    const title =
      heading.text.replace(/\s+/g, ' ').length <= 2 && index > 0
        ? `${chapterLabelMatch?.[0] ?? 'Chapter'} ${index + 1}`
        : heading.text;
    drafts.push({
      title,
      content,
      pageStart: pageOfOffset(pageStarts, pageNumbers, heading.offset),
      pageEnd: pageOfOffset(pageStarts, pageNumbers, Math.max(end - 1, heading.offset)),
      wordCount: countWords(content),
    });
  });

  return drafts;
}

function chunkByPages(pages: string[], targetWords = 3200): ChapterDraft[] {
  const drafts: ChapterDraft[] = [];
  let buffer: string[] = [];
  let startPage = 0;
  let words = 0;

  const flush = (endPage: number) => {
    if (buffer.length === 0) return;
    const content = buffer.join('\n\n').trim();
    if (!content) return;
    drafts.push({
      title: `第 ${drafts.length + 1} 部分 · 第 ${startPage + 1}–${endPage + 1} 页`,
      content,
      pageStart: startPage,
      pageEnd: endPage,
      wordCount: countWords(content),
    });
    buffer = [];
    words = 0;
    startPage = endPage + 1;
  };

  pages.forEach((page, index) => {
    const text = page.trim();
    if (!text) return;
    if (buffer.length === 0) startPage = index;
    buffer.push(text);
    words += countWords(text);
    const isLast = pages.slice(index + 1).every((p) => !p.trim());
    if (words >= targetWords || isLast) flush(index);
  });

  return drafts;
}

export function splitIntoChapters(pages: string[]): ChapterDraft[] {
  // Skip front matter (title page, TOC, cast list, preface...) before splitting.
  const bodyStart = detectBodyStart(pages);
  const workingPages = bodyStart ? trimToBody(pages, bodyStart) : pages;
  if (bodyStart) {
    console.info(`[chapters] body starts at page ${bodyStart.page + 1}: ${bodyStart.reason}`);
  }

  const { full, pageStarts, pageNumbers } = buildFullText(workingPages);
  if (!full.trim()) return [];

  const lines = collectLines(full, pageStarts, pageNumbers, workingPages);

  const patternHeadings = lines.filter((line) => isPatternHeading(line.text)).slice(0, 200);
  if (patternHeadings.length >= 2) {
    const result = finalize(chaptersFromHeadings(lines, patternHeadings, full, pageStarts, pageNumbers));
    if (result.length >= 2) return result;
  }

  const genericHeadings = lines.filter((line) => isGenericHeading(line)).slice(0, 200);
  if (genericHeadings.length >= 2) {
    const result = finalize(chaptersFromHeadings(lines, genericHeadings, full, pageStarts, pageNumbers));
    if (result.length >= 2) return result;
  }

  // Fallback: chunk by page count so users always get something readable.
  return finalize(chunkByPages(workingPages));
}

export function splitByRanges(
  pages: string[],
  ranges: { title?: string; start: number; end: number }[],
): ChapterDraft[] {
  const drafts: ChapterDraft[] = [];
  for (const range of ranges) {
    const start = Math.max(0, Math.min(range.start, pages.length - 1));
    const end = Math.max(start, Math.min(range.end, pages.length - 1));
    const content = pages
      .slice(start, end + 1)
      .join('\n\n')
      .trim();
    if (!content) continue;
    drafts.push({
      title: range.title?.trim() || `第 ${drafts.length + 1} 章 · 第 ${start + 1}–${end + 1} 页`,
      content,
      pageStart: start,
      pageEnd: end,
      wordCount: countWords(content),
    });
  }
  return finalize(drafts);
}

export function guessChapterTitle(content: string, index: number): string {
  const firstLine = content.split('\n').find((line) => line.trim().length > 0);
  if (firstLine && firstLine.trim().length <= 80) return firstLine.trim();
  return `第 ${index + 1} 章`;
}
