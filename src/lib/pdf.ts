import { extractText, getDocumentProxy } from 'unpdf';

export type ParsedPdf = {
  totalPages: number;
  pages: string[];
  letterCount: number;
  /** true when the PDF has (almost) no text layer, e.g. a scan */
  scanned: boolean;
};

function cleanPage(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/([A-Za-z])-\n([a-z])/g, '$1$2') // re-join words hyphenated across lines
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export async function parsePdf(data: Uint8Array): Promise<ParsedPdf> {
  const pdf = await getDocumentProxy(data);
  try {
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const raw = Array.isArray(text) ? text : [String(text)];
    const pages = raw.map(cleanPage);
    const letterCount = pages.join('').replace(/[^A-Za-z]/g, '').length;
    // A normal text page carries hundreds of letters; a scan carries ~0.
    const scanned = totalPages > 0 && letterCount / totalPages < 25;
    return { totalPages, pages, letterCount, scanned };
  } finally {
    const closable = pdf as unknown as { destroy?: () => Promise<void> };
    await closable.destroy?.();
  }
}
