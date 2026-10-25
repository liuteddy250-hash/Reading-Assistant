/**
 * Creates the SQLite schema without the Prisma schema-engine binary.
 *
 * `npm run db:push` (prisma db push) is the normal path. This script exists for
 * environments where Prisma cannot spawn its engine binary (restricted sandboxes,
 * some CI images). The DDL below mirrors prisma/schema.prisma.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const raw = (process.env.DATABASE_URL || 'file:./prisma/dev.db').replace(/^file:/, '');
const dbPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Book" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "filePath" TEXT NOT NULL,
  "pageCount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ready',
  "statusNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Book_userId_idx" ON "Book"("userId");

CREATE TABLE IF NOT EXISTS "Chapter" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "pageStart" INTEGER NOT NULL,
  "pageEnd" INTEGER NOT NULL,
  "wordCount" INTEGER NOT NULL,
  CONSTRAINT "Chapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Chapter_bookId_position_key" ON "Chapter"("bookId", "position");
CREATE INDEX IF NOT EXISTS "Chapter_bookId_idx" ON "Chapter"("bookId");

CREATE TABLE IF NOT EXISTS "Prestudy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chapterId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ready',
  "source" TEXT NOT NULL DEFAULT 'offline',
  "model" TEXT,
  "payload" TEXT NOT NULL,
  "studiedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Prestudy_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Prestudy_chapterId_key" ON "Prestudy"("chapterId");

CREATE TABLE IF NOT EXISTS "Annotation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'underline',
  "quote" TEXT NOT NULL,
  "paragraph" INTEGER NOT NULL,
  "startInP" INTEGER NOT NULL,
  "translation" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Annotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Annotation_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Annotation_userId_chapterId_idx" ON "Annotation"("userId", "chapterId");

CREATE TABLE IF NOT EXISTS "Word" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "chapterId" TEXT,
  "term" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "context" TEXT,
  "meaning" TEXT,
  "phonetic" TEXT,
  "pos" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Word_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Word_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Word_userId_term_key" ON "Word"("userId", "term");
CREATE INDEX IF NOT EXISTS "Word_userId_idx" ON "Word"("userId");

CREATE TABLE IF NOT EXISTS "ReadingProgress" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "percent" REAL NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReadingProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReadingProgress_userId_chapterId_key" ON "ReadingProgress"("userId", "chapterId");
CREATE INDEX IF NOT EXISTS "ReadingProgress_userId_idx" ON "ReadingProgress"("userId");
`);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((row) => row.name);

db.close();
console.log(`[db:init] ${dbPath}`);
console.log(`[db:init] tables: ${tables.join(', ')}`);
