import { countWords } from './text';

/**
 * Detects where the body of a book starts, so that front matter
 * (title page, copyright, table of contents, cast list, preface...) is skipped.
 *
 * Strategy (all generic, no per-book rules):
 * 1. Scan the first quarter of the pages for a structural heading
 *    (ACT I / SCENE 1 / Chapter 1 / 第 1 章 / PROLOGUE ...).
 * 2. The heading only counts if the text after it looks like body text
 *    (enough words and several prose/verse lines), which filters out
 *    table-of-contents entries that also look like headings.
 * 3. The pages before it must look like front matter (markers such as
 *    "Table of Contents", "Dramatis Personae", "Copyright", "Preface",
 *    or very sparse pages).
 * 4. If no heading is found, fall back to skipping a contiguous front-matter
 *    block at the beginning, stopping at the first substantial page.
 * 5. If neither signal is reliable, return null and the caller keeps the
 *    whole document (never lose the body start).
 */

const STRONG_HEADING: RegExp[] = [
  /^(act|scene)\s+([ivxlcdm]+|\d+)\b/i,
  /^(chapter|part|book|section)\s+([ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/i,
  /^第\s*[一二三四五六七八九十百零〇\d]{1,4}\s*[章节回卷部篇]/,
  /^(the\s+)?prologue\b/i,
  /^(the\s+)?epilogue\b/i,
];

const FRONT_MATTER_MARKERS: RegExp[] = [
  /table of contents/i,
  /^contents\b/i,
  /^目\s*录/,
  /dramatis personae/i,
  /^characters?\b/i,
  /人物表|人物介绍/,
  /copyright|all rights reserved|isbn/i,
  /published (by|in)/i,
  /publisher/i,
  /public domain/i,
  /preface|foreword/i,
  /introduction/i,
  /^前言|^序言|^序$|^简介|内容简介|^导读|出版说明|译者序|^引言/,
];

export type BodyStart = {
  page: number;
  offsetInPage: number;
  reason: string;
};

export function isFrontMatterMarker(text: string): boolean {
  return FRONT_MATTER_MARKERS.some((pattern) => pattern.test(text));
}

export function looksLikeBody(text: string): boolean {
  const words = countWords(text);
  if (words < 40) return false;

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const proseLines = lines.filter((line) => countWords(line) >= 6).length;

  return proseLines >= 3 || (words >= 120 && proseLines >= 2);
}

function hasFrontMatterBefore(pages: string[], pageIndex: number): boolean {
  if (pageIndex === 0) return false;

  let hasMarker = false;
  let sparsePages = 0;

  for (let i = 0; i < pageIndex; i += 1) {
    const text = pages[i] ?? '';
    if (!text.trim()) continue;
    if (isFrontMatterMarker(text)) hasMarker = true;
    if (countWords(text) < 60) sparsePages += 1;
  }

  return hasMarker || sparsePages >= Math.max(1, Math.ceil(pageIndex / 2));
}

/** Skips a contiguous front-matter block at the very beginning. */
function fallbackAfterFrontMatter(pages: string[], limit: number): BodyStart | null {
  let lastFrontMatterPage = -1;

  for (let p = 0; p < limit; p += 1) {
    const text = pages[p] ?? '';
    const marker = isFrontMatterMarker(text);
    const sparse = countWords(text) < 40;
    if (marker || sparse) {
      lastFrontMatterPage = p;
      continue;
    }
    break;
  }

  if (lastFrontMatterPage < 0) return null;

  for (let p = lastFrontMatterPage + 1; p < pages.length; p += 1) {
    if (countWords(pages[p] ?? '') >= 80) {
      return {
        page: p,
        offsetInPage: 0,
        reason: `no structural heading; skipped front matter through page ${p}`,
      };
    }
  }

  return null;
}

export function detectBodyStart(pages: string[]): BodyStart | null {
  if (pages.length === 0) return null;

  const limit = Math.min(pages.length, Math.max(3, Math.ceil(pages.length * 0.25)));

  for (let p = 0; p < limit; p += 1) {
    const page = pages[p] ?? '';
    if (!page) continue;

    let offset = 0;
    for (const rawLine of page.split('\n')) {
      const line = rawLine.trim();
      const lineOffset = offset;
      offset += rawLine.length + 1;

      if (!line) continue;
      if (!STRONG_HEADING.some((pattern) => pattern.test(line))) continue;
      if (!looksLikeBody(page.slice(lineOffset))) continue;
      if (!hasFrontMatterBefore(pages, p)) continue;

      return {
        page: p,
        offsetInPage: lineOffset,
        reason: `heading "${line}" on page ${p + 1} with front matter before`,
      };
    }
  }

  return fallbackAfterFrontMatter(pages, limit);
}

/** Returns a copy of the pages with everything before the body start removed. */
export function trimToBody(pages: string[], start: BodyStart): string[] {
  const trimmed = pages.slice();
  for (let i = 0; i < start.page; i += 1) trimmed[i] = '';
  trimmed[start.page] = (trimmed[start.page] ?? '').slice(start.offsetInPage);
  return trimmed;
}
