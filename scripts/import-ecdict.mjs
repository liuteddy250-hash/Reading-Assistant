/**
 * Imports the ECDICT CSV (https://github.com/skywind3000/ECDICT, MIT) into a
 * compact SQLite database used for offline word lookups.
 *
 * Usage:
 *   node scripts/import-ecdict.mjs
 *   node scripts/import-ecdict.mjs --csv data/ecdict.csv --out data/ecdict.db
 *   node scripts/import-ecdict.mjs --limit 5000        # quick smoke import
 *
 * The resulting DB is read at runtime by src/lib/dictionary.ts.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const args = process.argv.slice(2);
const valueOf = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const csvPath = path.resolve(valueOf('--csv', 'data/ecdict.csv'));
const outPath = path.resolve(valueOf('--out', 'data/ecdict.db'));
const limit = Number(valueOf('--limit', '0')) || 0;

if (!existsSync(csvPath)) {
  console.error(`[dict] CSV not found: ${csvPath}`);
  console.error('[dict] Download ecdict.csv first (see README) or pass --csv <path>.');
  process.exit(1);
}

/** True when every `"` in the buffer is closed (handles "" escapes). */
function quotesBalanced(text) {
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char !== '"') continue;
    if (inQuotes && text[i + 1] === '"') {
      i += 1;
      continue;
    }
    inQuotes = !inQuotes;
  }
  return !inQuotes;
}

/** Parses one CSV record: quoted fields, commas and doubled quotes inside quotes. */
function parseRow(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

const toInt = (value) => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? Math.trunc(number) : null;
};

const clean = (value) => {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
};

const db = new DatabaseSync(outPath);
db.exec('PRAGMA journal_mode = OFF;');
db.exec('PRAGMA synchronous = OFF;');
db.exec('DROP TABLE IF EXISTS dict;');
db.exec(`
  CREATE TABLE dict (
    word        TEXT PRIMARY KEY,
    display     TEXT NOT NULL,
    phonetic    TEXT,
    definition  TEXT,
    translation TEXT,
    pos         TEXT,
    collins     INTEGER,
    oxford      INTEGER,
    tag         TEXT,
    bnc         INTEGER,
    frq         INTEGER,
    exchange    TEXT
  ) WITHOUT ROWID;
`);

const insert = db.prepare(`
  INSERT OR REPLACE INTO dict
    (word, display, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq, exchange)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const started = Date.now();
let inserted = 0;
let skipped = 0;
let pending = '';

db.exec('BEGIN');

const reader = createInterface({
  input: createReadStream(csvPath, 'utf8'),
  crlfDelay: Infinity,
});

for await (const line of reader) {
  pending = pending ? `${pending}\n${line}` : line;
  // A record may span lines when a quoted field contains a newline.
  if (!quotesBalanced(pending)) continue;

  const row = pending;
  pending = '';

  if (row.trimStart().startsWith('word,')) continue;

  const fields = parseRow(row);
  if (fields.length < 5) {
    skipped += 1;
    continue;
  }

  const display = clean(fields[0]);
  if (!display) {
    skipped += 1;
    continue;
  }

  // Skip obvious multi-word phrases: the reader looks up single tokens.
  if (/\s/.test(display) && display.length > 40) {
    skipped += 1;
    continue;
  }

  const word = display.toLowerCase();
  insert.run(
    word,
    display,
    clean(fields[1]),
    clean(fields[2]),
    clean(fields[3]),
    clean(fields[4]),
    toInt(fields[5]),
    toInt(fields[6]),
    clean(fields[7]),
    toInt(fields[8]),
    toInt(fields[9]),
    clean(fields[10]),
  );

  inserted += 1;
  if (inserted % 10000 === 0) {
    db.exec('COMMIT');
    db.exec('BEGIN');
    process.stdout.write(`\r[dict] ${inserted.toLocaleString()} entries...`);
  }

  if (limit > 0 && inserted >= limit) break;
}

db.exec('COMMIT');
db.exec('PRAGMA optimize;');
db.close();

const sizeMb = (statSync(outPath).size / 1024 / 1024).toFixed(1);
const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n[dict] imported ${inserted.toLocaleString()} entries (skipped ${skipped}) in ${seconds}s`);
console.log(`[dict] ${outPath} -> ${sizeMb} MB`);
