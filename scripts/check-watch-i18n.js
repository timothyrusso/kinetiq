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

/**
 * A Swift string literal, interpolations included: `"routine.exerciseCount \(n)"`. SwiftUI turns
 * each `\(...)` into a format specifier when it looks the key up, so the catalog holds
 * `routine.exerciseCount %lld`. `normalise` maps both spellings to the same text.
 */
// An interpolation may hold one level of parentheses: `\(count(entry))`.
const INTERPOLATION = String.raw`\\\((?:[^()]|\([^()]*\))*\)`;
const LITERAL = String.raw`"((?:[^"\\]|${INTERPOLATION})+)"`;
const normalise = (key) =>
  key.replace(new RegExp(INTERPOLATION, 'g'), '%@').replace(/%(\d+\$)?(ll|l|h)?[@dDuUxXoOfeEgGcCsSaAp]/g, '%@');

/** The calls whose first string literal is a catalog key. */
const CALLS = [
  String.raw`\bText\(\s*`,
  String.raw`\bButton\(\s*`,
  String.raw`\bLabel\(\s*`,
  String.raw`\bToggle\(\s*`,
  String.raw`\bLocalizedStringKey\(\s*`,
  String.raw`\bLocalizedStringResource\(\s*`,
  String.raw`\.navigationTitle\(\s*`,
  String.raw`\.accessibilityLabel\(\s*`,
  String.raw`\.accessibilityHint\(\s*`,
  String.raw`\.confirmationDialog\(\s*`,
  String.raw`\.alert\(\s*`,
  String.raw`String\(\s*localized:\s*`,
  // A literal typed as a key: `let title: LocalizedStringKey = "a.b"`.
  String.raw`LocalizedStringKey\s*=\s*`,
  String.raw`LocalizedStringResource\s*=\s*`,
  // A literal where a `LocalizedStringKey` is expected: `.failed("sync.unreachable")`.
  String.raw`\.(?:done|failed)\(\s*`,
].map((prefix) => new RegExp(prefix + LITERAL, 'g'));

const keys = new Map(entries.map(([k]) => [normalise(k), k]));
const used = new Set();
for (const [file, text] of swift) {
  const code = text.replace(/^\s*\/\/.*$/gm, '');
  for (const re of CALLS) {
    for (const m of code.matchAll(re)) {
      const key = keys.get(normalise(m[1]));
      if (key) used.add(key);
      else problems.push(`${path.relative(ROOT, file)}: "${m[1]}" is not in Localizable.xcstrings`);
    }
  }
  // A bare semantic key anywhere else in code (a table of keys, a ternary) counts as a use.
  for (const m of code.matchAll(/"([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)"/g)) {
    const key = keys.get(normalise(m[1]));
    if (key) used.add(key);
  }
}
for (const key of keys.values()) if (!used.has(key)) problems.push(`${key}: in Localizable.xcstrings but no Swift file reads it`);

if (problems.length === 0) {
  console.log(`PASS: ${keys.size} watch keys, English and Italian agree, and every key is read`);
  process.exit(0);
}
console.error(`FAIL: ${problems.length} watch i18n problem(s)\n`);
for (const p of problems) console.error(`  ${p}`);
process.exit(1);
