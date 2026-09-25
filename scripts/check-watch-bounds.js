#!/usr/bin/env node
/**
 * The routine bounds exist once, in `src/transfer/bounds.json`, and the watch app ships a copy.
 *
 *   node scripts/check-watch-bounds.js        (part of `npm run check:watch`)
 *
 * The watch validates every snapshot against the same limits the phone's editor and importer
 * use (Stability rule 3 in issue #27). Xcode cannot reach outside the target folder for a
 * bundle resource, so the watch target holds `targets/watch/bounds.json`; this fails when the
 * two copies are not the same document.
 */
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');

const ROOT = path.join(__dirname, '..');
const PHONE = 'src/transfer/bounds.json';
const WATCH = 'targets/watch/bounds.json';

const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
if (isDeepStrictEqual(read(PHONE), read(WATCH))) {
  console.log(`PASS: ${WATCH} matches ${PHONE}`);
  process.exit(0);
}
console.error(`FAIL: ${WATCH} differs from ${PHONE}. Copy the phone file over the watch one.`);
process.exit(1);
