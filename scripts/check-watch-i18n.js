#!/usr/bin/env node
/**
 * The watch app's string catalog, held to the same rules as the phone's (`check-i18n.js`).
 *
 *   node scripts/check-watch-i18n.js        (part of `npm run check:watch`)
 *
 * `targets/watch/Localizable.xcstrings` is the only place the watch keeps copy. Keys are
 * semantic (`routines.empty.title`) rather than the English sentence, so English is a
 * translation like Italian and both can be checked the same way:
 *
 *   - every key has a translated `en` and `it` value, with the same placeholders;
 *   - every key a Swift file names in a localising call exists in the catalog;
 *   - every catalog key is named by some Swift file.
 *
 * The Swift scan knows the SwiftUI initialisers that take a `LocalizedStringKey` and
 * `String(localized:)`. A key built at runtime would read as missing, which is deliberate, as
 * on the phone: a key nobody can search for is a key nobody can safely rename.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WATCH = path.join(ROOT, 'targets/watch');
const CATALOG = path.join(WATCH, 'Localizable.xcstrings');
const LANGUAGES = ['en', 'it'];

const problems = [];
const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const entries = Object.entries(catalog.strings ?? {});

/** `%@`, `%lld`, `%1$@` and friends, in order, so a swapped or missing one is caught. */
const slots = (s) => [...s.matchAll(/%(\d+\$)?[-+ #0]*\d*(\.\d+)?(ll|l|h)?[@dDuUxXoOfeEgGcCsSaAp]/g)].map((m) => m[0]).sort().join(',');

/** Each plural or plain value of one language, flattened to `[label, text]`. */
function values(localization) {
  if (!localization) return [];
  if (localization.stringUnit) return [['', localization.stringUnit]];
  const plural = localization.variations?.plural ?? {};
  return Object.entries(plural).map(([form, v]) => [form, v.stringUnit]);
}

for (const [key, entry] of entries) {
  const byLanguage = {};
  for (const lang of LANGUAGES) {
    const list = values(entry.localizations?.[lang]);
    if (list.length === 0) {
      problems.push(`${key}: no ${lang} value`);
      continue;
    }
    for (const [form, unit] of list) {
      if (!unit || unit.state !== 'translated' || !unit.value) {
        problems.push(`${key}${form ? ` (${form})` : ''}: ${lang} is not translated`);
      }
    }
    byLanguage[lang] = list;
  }
  if (byLanguage.en && byLanguage.it) {
    const en = byLanguage.en.map(([, u]) => slots(u?.value ?? '')).join('|');
    const it = byLanguage.it.map(([, u]) => slots(u?.value ?? '')).join('|');
    if ([...new Set(en.split('|'))].join() !== [...new Set(it.split('|'))].join()) {
      problems.push(`${key}: placeholders differ (en "${en}" against it "${it}")`);
    }
  }
}

const swift = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.swift')) swift.push([full, fs.readFileSync(full, 'utf8')]);
  }
})(WATCH);

/** The calls whose first string literal is a catalog key. */
const CALLS = [
  /\bText\(\s*"([^"\\]+)"/g,
  /\bButton\(\s*"([^"\\]+)"/g,
  /\bLabel\(\s*"([^"\\]+)"/g,
  /\bToggle\(\s*"([^"\\]+)"/g,
  /\bLocalizedStringKey\(\s*"([^"\\]+)"/g,
  /\bLocalizedStringResource\(\s*"([^"\\]+)"/g,
  /\.navigationTitle\(\s*"([^"\\]+)"/g,
  /\.accessibilityLabel\(\s*"([^"\\]+)"/g,
  /\.accessibilityHint\(\s*"([^"\\]+)"/g,
  /\.confirmationDialog\(\s*"([^"\\]+)"/g,
  /\.alert\(\s*"([^"\\]+)"/g,
  /String\(\s*localized:\s*"([^"\\]+)"/g,
  // A `Loc("key")` style helper, or a literal typed as a key: `let title: LocalizedStringKey = "a.b"`.
  /LocalizedStringKey\s*=\s*"([^"\\]+)"/g,
  /LocalizedStringResource\s*=\s*"([^"\\]+)"/g,
];

const keys = new Set(entries.map(([k]) => k));
const used = new Set();
for (const [file, text] of swift) {
  const code = text.replace(/^\s*\/\/.*$/gm, '');
  for (const re of CALLS) {
    for (const m of code.matchAll(re)) {
      used.add(m[1]);
      if (!keys.has(m[1])) problems.push(`${path.relative(ROOT, file)}: "${m[1]}" is not in Localizable.xcstrings`);
    }
  }
  // A bare semantic key anywhere else in code (a table of keys, a ternary) counts as a use.
  for (const m of code.matchAll(/"([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)"/g)) if (keys.has(m[1])) used.add(m[1]);
}
for (const key of keys) if (!used.has(key)) problems.push(`${key}: in Localizable.xcstrings but no Swift file reads it`);

if (problems.length === 0) {
  console.log(`PASS: ${keys.size} watch keys, English and Italian agree, and every key is read`);
  process.exit(0);
}
console.error(`FAIL: ${problems.length} watch i18n problem(s)\n`);
for (const p of problems) console.error(`  ${p}`);
process.exit(1);
