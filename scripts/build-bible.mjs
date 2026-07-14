// Downloads the World English Bible (public domain) from
// github.com/TehShrike/world-english-bible and converts it to the
// slim bundled format in /assets/bible/web.json (plan §07, Path B).
//
// Run:  node scripts/build-bible.mjs
// Idempotent; re-run any time. The output is committed so CI and the
// app never need this script at build time.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'https://raw.githubusercontent.com/TehShrike/world-english-bible/master/json';

// Canonical order — keep in sync with src/text/canon.ts
const BOOKS = [
  'genesis','exodus','leviticus','numbers','deuteronomy','joshua','judges','ruth',
  '1samuel','2samuel','1kings','2kings','1chronicles','2chronicles','ezra','nehemiah',
  'esther','job','psalms','proverbs','ecclesiastes','songofsolomon','isaiah','jeremiah',
  'lamentations','ezekiel','daniel','hosea','joel','amos','obadiah','jonah','micah',
  'nahum','habakkuk','zephaniah','haggai','zechariah','malachi',
  'matthew','mark','luke','john','acts','romans','1corinthians','2corinthians',
  'galatians','ephesians','philippians','colossians','1thessalonians','2thessalonians',
  '1timothy','2timothy','titus','philemon','hebrews','james','1peter','2peter',
  '1john','2john','3john','jude','revelation',
];

// Chunk types that carry verse text. Others ("chapter heading",
// "footnote", breaks) are structural or editorial — skipped.
const TEXT_TYPES = new Set(['paragraph text', 'line text']);
const PARA_TYPES = new Set(['paragraph start', 'stanza start']);

function convertBook(chunks) {
  const chapters = []; // chapters[c-1] = [{ v, t, p? }]
  let pendingParagraph = false;
  const unknown = new Set();

  for (const chunk of chunks) {
    if (PARA_TYPES.has(chunk.type)) {
      pendingParagraph = true;
      continue;
    }
    if (!TEXT_TYPES.has(chunk.type)) {
      if (chunk.value && chunk.chapterNumber) unknown.add(chunk.type);
      continue;
    }
    const c = chunk.chapterNumber;
    const v = chunk.verseNumber;
    if (!c || !v) continue;

    chapters[c - 1] ??= [];
    const verses = chapters[c - 1];
    let verse = verses[verses.length - 1];
    if (!verse || verse.v !== v) {
      verse = { v, t: '' };
      if (pendingParagraph) verse.p = 1;
      verses.push(verse);
    }
    pendingParagraph = false;
    verse.t = `${verse.t} ${chunk.value}`.replace(/\s+/g, ' ').trim();
  }

  // Drop verses with no text: WEB relegates some textual-variant
  // verses (e.g. Luke 17:36) to footnotes, leaving an empty shell.
  return {
    chapters: chapters.map((c) => (c ?? []).filter((verse) => verse.t.length > 0)),
    unknown,
  };
}

const out = { translation: 'WEB', attribution: null, books: {} };
const allUnknown = new Set();

for (const book of BOOKS) {
  const res = await fetch(`${SOURCE}/${book}.json`);
  if (!res.ok) throw new Error(`${book}: HTTP ${res.status}`);
  const { chapters, unknown } = convertBook(await res.json());
  for (const u of unknown) allUnknown.add(u);
  if (chapters.length === 0) throw new Error(`${book}: no chapters parsed`);
  out.books[book] = chapters;
  process.stdout.write(`${book}: ${chapters.length} chapters\n`);
}

// Sanity checks before writing — bad data here poisons a year of logs.
const assert = (cond, msg) => {
  if (!cond) throw new Error(`SANITY: ${msg}`);
};
assert(Object.keys(out.books).length === 66, '66 books');
assert(out.books.psalms.length === 150, 'Psalms has 150 chapters');
assert(out.books.psalms[118].length === 176, 'Psalm 119 has 176 verses');
assert(out.books.psalms[116].length === 2, 'Psalm 117 has 2 verses');
assert(out.books.jude.length === 1, 'Jude has 1 chapter');
assert(out.books.john[2].some((x) => x.v === 16 && /loved the world/.test(x.t)), 'John 3:16');
assert(out.books.genesis[0][0].t.startsWith('In the beginning'), 'Genesis 1:1');

mkdirSync(join(ROOT, 'assets', 'bible'), { recursive: true });
const path = join(ROOT, 'assets', 'bible', 'web.json');
writeFileSync(path, JSON.stringify(out));
const mb = (JSON.stringify(out).length / 1024 / 1024).toFixed(1);
console.log(`\nWrote ${path} (${mb} MB)`);
if (allUnknown.size) console.log('Skipped chunk types:', [...allUnknown].join(', '));
