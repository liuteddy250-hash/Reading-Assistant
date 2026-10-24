/**
 * Generates a text-layer PDF used by the end-to-end test.
 * Hand-written PDF (no external dependency) so the sample is reproducible offline.
 *
 * Usage: node scripts/make-sample-pdf.mjs [outputPath]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const chapters = [
  {
    heading: 'Chapter One',
    title: 'The Habit of Reading',
    paragraphs: [
      'Reading in a second language is rarely a matter of understanding every single word. Most successful readers tolerate a certain amount of ambiguity, allowing an unfamiliar expression to remain obscure until the surrounding sentence quietly explains it. This tolerance is not laziness; it is a strategy, and like every strategy it improves with deliberate practice.',
      'Although the digital age has made access to information almost ubiquitous, the capacity to sit with a difficult paragraph, to resist the temptation to skim, and to return to a sentence until its architecture becomes visible remains the rarest and most decisive skill in educated life. The habit is not glamorous. It is meticulous, repetitive, and occasionally tedious, yet its cumulative effect is substantial.',
      'A reader who pauses to ask why a writer chose one verb rather than another is already doing something different from a reader who merely consumes pages. The first reader perceives structure; the second perceives only content. Over a year, the difference between them is not a matter of talent but of attention, and attention can be trained.',
    ],
  },
  {
    heading: 'Chapter Two',
    title: 'The Architecture of Attention',
    paragraphs: [
      'Every long sentence is a small building. It has a foundation, which is the main clause, and it has extensions, which are the subordinate clauses, the participial phrases, and the parenthetical remarks that cluster around the foundation like scaffolding. When the building collapses under the weight of its own decoration, the reader must reconstruct it deliberately, beam by beam.',
      'Consider a sentence that begins with a concession and ends with a qualification. The concession prepares the ground, the main clause delivers the claim, and the qualification limits it. If you can identify those three movements, you can usually paraphrase the sentence even when several words remain unknown. This is why structural awareness is more valuable than vocabulary size alone.',
      'The most resilient readers are those who have learned to tolerate uncertainty without losing the thread. They do not stop at the first unfamiliar word, and they do not pretend that the word is unimportant. Instead they mark it, continue reading, and return later with a hypothesis that the rest of the paragraph can confirm or reject. Such a reader is skeptical but not paralyzed.',
    ],
  },
  {
    heading: 'Chapter Three',
    title: 'Learning to Notice',
    paragraphs: [
      'Noticing is the moment when an input becomes an object of attention. A reader may see the word "inevitable" a hundred times and never notice it, and then one day, because a teacher circled it or because a character used it in an argument, the word becomes visible. From that moment it is available for learning.',
      'Teachers can accelerate this process by preparing students before they read. A short pre-study of the hardest sentences and the most opaque vocabulary gives the reader a map, and a map changes the experience of a difficult terrain. The reader still has to walk, but no longer has to guess where the path might be.',
      'The aim is not to eliminate difficulty, since difficulty is where learning happens. The aim is to make difficulty navigable. A chapter that once felt impenetrable becomes a sequence of problems that can be solved one at a time, and the confidence that follows is not an illusion but evidence, accumulated sentence by sentence, that the reader is becoming capable.',
    ],
  },
];

function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const PAGE_LINES = 40;
const pages = [];
let current = [];

function flushPage() {
  if (current.length > 0) pages.push(current);
  current = [];
}

for (const chapter of chapters) {
  flushPage();
  current.push(chapter.heading);
  current.push('');
  current.push(chapter.title);
  current.push('');

  for (const paragraph of chapter.paragraphs) {
    for (const line of wrap(paragraph, 82)) {
      if (current.length >= PAGE_LINES) flushPage();
      current.push(line);
    }
    current.push('');
  }
}
flushPage();

const escapePdf = (value) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function contentStream(lines) {
  const body = lines.map((line) => `(${escapePdf(line)}) Tj T*`).join('\n');
  return `BT\n/F1 11 Tf\n16 TL\n60 760 Td\n${body}\nET`;
}

const fontId = 3 + pages.length * 2;
const objects = [];
objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`;

pages.forEach((lines, index) => {
  const pageId = 3 + index * 2;
  const contentId = 4 + index * 2;
  objects[pageId] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
    `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
  const stream = contentStream(lines);
  objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
});

objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

let pdf = '%PDF-1.4\n';
const offsets = [];
for (let id = 1; id < objects.length; id += 1) {
  offsets[id] = Buffer.byteLength(pdf, 'latin1');
  pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
}

const xrefOffset = Buffer.byteLength(pdf, 'latin1');
pdf += `xref\n0 ${objects.length}\n`;
pdf += '0000000000 65535 f \n';
for (let id = 1; id < objects.length; id += 1) {
  pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

const output = process.argv[2] || path.join(process.cwd(), 'samples', 'sample-book.pdf');
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, Buffer.from(pdf, 'latin1'));
console.log(`[sample] wrote ${output} (${pages.length} pages)`);
