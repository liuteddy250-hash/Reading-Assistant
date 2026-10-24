/** Shared, dependency-free text helpers used by both server and client code. */

export function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’']s$/, '')
    .replace(/^[^a-z]+|[^a-z]+$/g, '');
}

export function countWords(text: string): number {
  return text.match(/[A-Za-z][A-Za-z'’-]*/g)?.length ?? 0;
}

export function splitSentences(text: string): string[] {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return [];
  const parts = flat.match(/[^.!?]+(?:[.!?]+["'”’)\]]*|$)/g) ?? [flat];
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Splits chapter text into renderable paragraphs.
 * Deterministic output is important: the reader stores underline offsets
 * relative to (paragraph index, character offset), so this function must
 * produce identical results on every render.
 */
export function splitParagraphs(content: string): string[] {
  const blocks = content
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n|\n/)
    .map((block) => block.replace(/[ \t]+/g, ' ').trim())
    .filter((block) => block.length > 0);

  const result: string[] = [];
  for (const block of blocks) {
    if (block.length <= 1400) {
      result.push(block);
      continue;
    }
    // Split very long blocks (common when a PDF has no line breaks) at sentence ends.
    const sentences = block.match(/[^.!?]+[.!?]+["'”’)\]]?|[^.!?]+$/g) ?? [block];
    let buffer = '';
    for (const sentence of sentences) {
      if (buffer && buffer.length + sentence.length > 1400) {
        result.push(buffer.trim());
        buffer = '';
      }
      buffer += sentence;
    }
    if (buffer.trim()) result.push(buffer.trim());
  }
  return result;
}

/**
 * PDF text arrives hard-wrapped (a line break every ~80 characters). Re-join
 * those lines so downstream sentence/paragraph analysis sees real paragraphs.
 * Blank lines are treated as paragraph boundaries.
 */
export function reflowText(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer.trim()) blocks.push(buffer.trim());
    buffer = '';
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (!buffer) {
      buffer = line;
      continue;
    }
    // A hyphen at the end of a line is a split word ("under- standing").
    if (/[a-z]-$/.test(buffer) && /^[a-z]/.test(line)) {
      buffer = buffer.slice(0, -1) + line;
    } else {
      buffer += ` ${line}`;
    }
  }
  flush();

  return blocks.join('\n\n');
}

export type WordToken = { text: string; start: number; end: number };/** Word tokens with character offsets, used for highlighting and selection mapping. */
export function tokenizeWords(paragraph: string): WordToken[] {
  const tokens: WordToken[] = [];
  const re = /[A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(paragraph)) !== null) {
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}
