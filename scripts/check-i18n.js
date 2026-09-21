#!/usr/bin/env node
/**
 * Every English key must exist in Italian, and vice versa.
 *
 * TypeScript already rejects a MISSING key, because `it` is typed as `Copy`. What it cannot
 * catch is the pair of mistakes that produce a half-translated screen at runtime:
 *
 *   - a plural key present as `_one` but not `_other` in one locale, so a count of 2 falls
 *     back to the key path and renders "workout.set" on screen;
 *   - a `{placeholder}` that differs between locales, so the Italian string renders a literal
 *     "{count}" where the English one interpolates.
 *
 * Both are invisible until someone switches language and counts to two.
 */
const { execFileSync } = require('child_process');
const { join } = require('path');

const ROOT = join(__dirname, '..');

/** Read the catalogs through tsx, so this checks the real objects rather than parsing source. */
function load() {
  const script = `
    const { en } = require('${join(ROOT, 'src/i18n/en.ts')}');
    const { it } = require('${join(ROOT, 'src/i18n/it.ts')}');
    const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
      typeof v === 'string' ? [[p + k, v]] : flat(v, p + k + '.'));
    console.log(JSON.stringify({ en: flat(en), it: flat(it) }));
  `;
  const out = execFileSync('npx', ['tsx', '-e', script], { cwd: ROOT, encoding: 'utf8' });
  return JSON.parse(out.trim().split('\n').pop());
}

const { en, it } = load();
const enMap = new Map(en);
const itMap = new Map(it);
const problems = [];

for (const [key] of en) if (!itMap.has(key)) problems.push(`missing in it: ${key}`);
for (const [key] of it) if (!enMap.has(key)) problems.push(`missing in en: ${key}`);

// Plural pairs must be complete in both.
for (const map of [['en', enMap], ['it', itMap]]) {
  const [name, m] = map;
  for (const key of m.keys()) {
    if (key.endsWith('_one') && !m.has(key.replace(/_one$/, '_other'))) {
      problems.push(`${name}: ${key} has no _other form`);
    }
    if (key.endsWith('_other') && !m.has(key.replace(/_other$/, '_one'))) {
      problems.push(`${name}: ${key} has no _one form`);
    }
  }
}

// Placeholders must match, or one locale silently renders a literal brace.
const slots = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const [key, value] of en) {
  const other = itMap.get(key);
  if (other === undefined) continue;
  if (slots(value) !== slots(other)) {
    problems.push(`${key}: placeholders differ (en "${slots(value)}" against it "${slots(other)}")`);
  }
}

if (problems.length === 0) {
  console.log(`PASS: ${en.length} keys, English and Italian agree`);
  process.exit(0);
}
console.error(`FAIL: ${problems.length} i18n problem(s)\n`);
for (const p of problems.slice(0, 30)) console.error(`  ${p}`);
if (problems.length > 30) console.error(`  ... and ${problems.length - 30} more`);
process.exit(1);
