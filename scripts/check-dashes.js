#!/usr/bin/env node
/**
 * No em dashes. Anywhere.
 *
 *   node scripts/check-dashes.js        (part of `npm run check`)
 *
 * The rule is in CLAUDE.md and this is what makes it stick. A style rule that lives only in a
 * document is a rule that comes back the next time someone writes a paragraph, and this file
 * had 750 of them when the rule was made: 672 in comments, 78 in shipped copy, 4 in seed data
 * that were rendering inside routine names on the Workout tab.
 *
 * Checked everywhere rather than in copy alone, deliberately. Comments are read by people too,
 * and a codebase whose prose disagrees with its own style rule teaches the rule is optional.
 *
 * The en dash is checked in the same pass. A numeric range wants a plain hyphen (`8-12` reps),
 * which is also what the rep strings in the seed data already use.
 */
const { readdirSync, readFileSync, statSync } = require('fs');
const { join, relative, extname } = require('path');

const ROOT = join(__dirname, '..');
// Built from code points on purpose: written as literal characters, this file fails its
// own check, and a text transform run across the repo would silently rewrite the very
// constants the check depends on. That happened once.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
/**
 * Where shipped code lives. `scripts/` is checked too: its console output is read by people.
 * `targets/` is the native watch app (Swift, its string catalog, its lint config) and
 * `modules/` the local Expo modules. `assets/catalog/` is the bundled exercise catalog: wger's text,
 * but shown in the app, so the mapper folds its dashes and this proves it did.
 */
const ROOTS = ['app', 'src', 'scripts', 'targets', 'modules', 'assets/catalog'];
const EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.md',
  '.json',
  '.swift',
  '.xcstrings',
  '.plist',
  '.yml',
  '.kt',
]);
const SKIP_DIRS = new Set(['node_modules', 'ios', 'android', '.git', '.expo', 'dist', '.build']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.has(extname(entry))) out.push(full);
  }
  return out;
}

const files = [];
for (const r of ROOTS) {
  try {
    walk(join(ROOT, r), files);
  } catch {
    // A root that does not exist is not a failure; the repo may not have all of them.
  }
}
// The rule applies to the rule's own home as well.
try {
  files.push(join(ROOT, 'CLAUDE.md'));
} catch {
  /* optional */
}

const hits = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes(EM) && !text.includes(EN)) continue;
  text.split('\n').forEach((line, i) => {
    for (const [ch, name] of [
      [EM, 'em dash'],
      [EN, 'en dash'],
    ]) {
      if (!line.includes(ch)) continue;
      hits.push({
        file: relative(ROOT, file),
        line: i + 1,
        name,
        // Enough context to fix it without opening the file.
        excerpt: line.trim().slice(0, 96),
      });
    }
  });
}

if (hits.length === 0) {
  console.log(`PASS: no em or en dashes in ${ROOTS.join('/, ')}/ or CLAUDE.md`);
  process.exit(0);
}

console.error(`FAIL, ${hits.length} dash(es) found. Use a colon, comma, parentheses or "·".\n`);
const byFile = new Map();
for (const h of hits) byFile.set(h.file, [...(byFile.get(h.file) ?? []), h]);
for (const [file, list] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.error(`  ${file}  (${list.length})`);
  for (const h of list.slice(0, 4)) console.error(`    ${h.line}: ${h.excerpt}`);
  if (list.length > 4) console.error(`    ... and ${list.length - 4} more`);
}
process.exit(1);
