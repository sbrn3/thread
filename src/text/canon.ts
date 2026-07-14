// The 66 books in canonical order. `id` is the stable key used in
// the bundled JSON and the event log's `book` column; `name` is what
// the next-book chooser renders (§03 — a plain searchable list);
// `usfm` is the USFM code API.Bible uses in chapter ids.

export interface Book {
  id: string;
  name: string;
  usfm: string;
}

export const CANON: Book[] = [
  { id: 'genesis', name: 'Genesis', usfm: 'GEN' },
  { id: 'exodus', name: 'Exodus', usfm: 'EXO' },
  { id: 'leviticus', name: 'Leviticus', usfm: 'LEV' },
  { id: 'numbers', name: 'Numbers', usfm: 'NUM' },
  { id: 'deuteronomy', name: 'Deuteronomy', usfm: 'DEU' },
  { id: 'joshua', name: 'Joshua', usfm: 'JOS' },
  { id: 'judges', name: 'Judges', usfm: 'JDG' },
  { id: 'ruth', name: 'Ruth', usfm: 'RUT' },
  { id: '1samuel', name: '1 Samuel', usfm: '1SA' },
  { id: '2samuel', name: '2 Samuel', usfm: '2SA' },
  { id: '1kings', name: '1 Kings', usfm: '1KI' },
  { id: '2kings', name: '2 Kings', usfm: '2KI' },
  { id: '1chronicles', name: '1 Chronicles', usfm: '1CH' },
  { id: '2chronicles', name: '2 Chronicles', usfm: '2CH' },
  { id: 'ezra', name: 'Ezra', usfm: 'EZR' },
  { id: 'nehemiah', name: 'Nehemiah', usfm: 'NEH' },
  { id: 'esther', name: 'Esther', usfm: 'EST' },
  { id: 'job', name: 'Job', usfm: 'JOB' },
  { id: 'psalms', name: 'Psalms', usfm: 'PSA' },
  { id: 'proverbs', name: 'Proverbs', usfm: 'PRO' },
  { id: 'ecclesiastes', name: 'Ecclesiastes', usfm: 'ECC' },
  { id: 'songofsolomon', name: 'Song of Solomon', usfm: 'SNG' },
  { id: 'isaiah', name: 'Isaiah', usfm: 'ISA' },
  { id: 'jeremiah', name: 'Jeremiah', usfm: 'JER' },
  { id: 'lamentations', name: 'Lamentations', usfm: 'LAM' },
  { id: 'ezekiel', name: 'Ezekiel', usfm: 'EZK' },
  { id: 'daniel', name: 'Daniel', usfm: 'DAN' },
  { id: 'hosea', name: 'Hosea', usfm: 'HOS' },
  { id: 'joel', name: 'Joel', usfm: 'JOL' },
  { id: 'amos', name: 'Amos', usfm: 'AMO' },
  { id: 'obadiah', name: 'Obadiah', usfm: 'OBA' },
  { id: 'jonah', name: 'Jonah', usfm: 'JON' },
  { id: 'micah', name: 'Micah', usfm: 'MIC' },
  { id: 'nahum', name: 'Nahum', usfm: 'NAM' },
  { id: 'habakkuk', name: 'Habakkuk', usfm: 'HAB' },
  { id: 'zephaniah', name: 'Zephaniah', usfm: 'ZEP' },
  { id: 'haggai', name: 'Haggai', usfm: 'HAG' },
  { id: 'zechariah', name: 'Zechariah', usfm: 'ZEC' },
  { id: 'malachi', name: 'Malachi', usfm: 'MAL' },
  { id: 'matthew', name: 'Matthew', usfm: 'MAT' },
  { id: 'mark', name: 'Mark', usfm: 'MRK' },
  { id: 'luke', name: 'Luke', usfm: 'LUK' },
  { id: 'john', name: 'John', usfm: 'JHN' },
  { id: 'acts', name: 'Acts', usfm: 'ACT' },
  { id: 'romans', name: 'Romans', usfm: 'ROM' },
  { id: '1corinthians', name: '1 Corinthians', usfm: '1CO' },
  { id: '2corinthians', name: '2 Corinthians', usfm: '2CO' },
  { id: 'galatians', name: 'Galatians', usfm: 'GAL' },
  { id: 'ephesians', name: 'Ephesians', usfm: 'EPH' },
  { id: 'philippians', name: 'Philippians', usfm: 'PHP' },
  { id: 'colossians', name: 'Colossians', usfm: 'COL' },
  { id: '1thessalonians', name: '1 Thessalonians', usfm: '1TH' },
  { id: '2thessalonians', name: '2 Thessalonians', usfm: '2TH' },
  { id: '1timothy', name: '1 Timothy', usfm: '1TI' },
  { id: '2timothy', name: '2 Timothy', usfm: '2TI' },
  { id: 'titus', name: 'Titus', usfm: 'TIT' },
  { id: 'philemon', name: 'Philemon', usfm: 'PHM' },
  { id: 'hebrews', name: 'Hebrews', usfm: 'HEB' },
  { id: 'james', name: 'James', usfm: 'JAS' },
  { id: '1peter', name: '1 Peter', usfm: '1PE' },
  { id: '2peter', name: '2 Peter', usfm: '2PE' },
  { id: '1john', name: '1 John', usfm: '1JN' },
  { id: '2john', name: '2 John', usfm: '2JN' },
  { id: '3john', name: '3 John', usfm: '3JN' },
  { id: 'jude', name: 'Jude', usfm: 'JUD' },
  { id: 'revelation', name: 'Revelation', usfm: 'REV' },
];

export function bookName(id: string): string {
  return CANON.find((b) => b.id === id)?.name ?? id;
}

export function nextBook(id: string): Book | null {
  const i = CANON.findIndex((b) => b.id === id);
  return i >= 0 && i + 1 < CANON.length ? CANON[i + 1] : null;
}
