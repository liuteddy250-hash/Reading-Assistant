/**
 * Smoke test for the Prisma layer: create a user + book + chapter and read it back.
 * Usage: node scripts/smoke-db.mjs
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

// Prisma Client does not read .env by itself (only the CLI does).
try {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
  // no .env: rely on the ambient environment
}
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';

const prisma = new PrismaClient();

const user = await prisma.user.create({
  data: { email: `smoke-${Date.now()}@example.com`, passwordHash: 'x' },
});

const book = await prisma.book.create({
  data: {
    userId: user.id,
    title: 'Smoke Test Book',
    fileName: 'smoke.pdf',
    fileSize: 123,
    filePath: '/tmp/smoke.pdf',
    pageCount: 2,
    status: 'ready',
    chapters: {
      create: [
        { position: 0, title: 'Chapter One', content: 'Hello world.', pageStart: 0, pageEnd: 0, wordCount: 2 },
      ],
    },
  },
  include: { chapters: true },
});

const chapter = book.chapters[0];

const prestudy = await prisma.prestudy.create({
  data: {
    chapterId: chapter.id,
    payload: JSON.stringify({ ok: true }),
    source: 'offline',
  },
});

const annotation = await prisma.annotation.create({
  data: {
    userId: user.id,
    chapterId: chapter.id,
    kind: 'translation',
    quote: 'Hello',
    paragraph: 0,
    startInP: 0,
    translation: '你好',
  },
});

const word = await prisma.word.upsert({
  where: { userId_term: { userId: user.id, term: 'hello' } },
  create: { userId: user.id, chapterId: chapter.id, term: 'hello', surface: 'Hello' },
  update: {},
});

const reloaded = await prisma.book.findFirst({
  where: { id: book.id },
  include: { chapters: { include: { prestudy: true, notes: true } } },
});

console.log('user:', user.id);
console.log('book:', reloaded.title, 'chapters:', reloaded.chapters.length);
console.log('prestudy studiedAt:', reloaded.chapters[0].prestudy?.studiedAt);
console.log('annotation:', annotation.quote, annotation.translation);
console.log('word:', word.term);
console.log('createdAt type:', user.createdAt instanceof Date ? 'Date' : typeof user.createdAt);

await prisma.book.delete({ where: { id: book.id } });
await prisma.user.delete({ where: { id: user.id } });
await prisma.$disconnect();
console.log('smoke ok');
