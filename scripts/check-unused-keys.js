#!/usr/bin/env node
/**
 * Every English catalog key must be read somewhere in `app/` or `src/`.
 *
 * knip finds unused files, exports and dependencies, but a catalog key is a property of one
 * big object, which no dead-code tool follows. So this reads the flattened key set and looks
 * for each key as a quoted string in the source: `t('home.title')`, `tr('home.title')`, or a
 * module-level table of keys. A plural key (`_one` / `_other`) counts as used when its base
 * is, because `t()` picks the form from `count`.
 *
 * A key built at runtime from pieces (`t(\`a.${b}\`)`) would read as unused here. None exist,
 * and that is deliberate: a key that cannot be found by searching for it is a key nobody can
 * safely rename.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const script = `
  const { en } = require('${path.join(ROOT, 'src/i18n/en.ts')}');
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'string' ? [p + k] : flat(v, p + k + '.'));
  console.log(JSON.stringify(flat(en)));
`;
const out = execFileSync('npx', ['tsx', '-e', script], { cwd: ROOT, encoding: 'utf8' });
const keys = JSON.parse(out.trim().split('\n').pop());

const CATALOGS = new Set(['src/i18n/en.ts', 'src/i18n/it.ts'].map((p) => path.join(ROOT, p)));
const sources = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !CATALOGS.has(full)) sources.push(fs.readFileSync(full, 'utf8'));
  }
})(path.join(ROOT, 'app'));
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !CATALOGS.has(full)) sources.push(fs.readFileSync(full, 'utf8'));
  }
})(path.join(ROOT, 'src'));
const text = sources.join('\n');

const unused = keys.filter((key) => {
  const base = key.replace(/_(one|other)$/, '');
  return !text.includes(`'${base}'`) && !text.includes(`"${base}"`) && !text.includes(`\`${base}\``);
});

if (unused.length > 0) {
  console.error(`FAIL: ${unused.length} catalog keys are never read:`);
  for (const key of unused) console.error(`  ${key}`);
  console.error('Delete them from src/i18n/en.ts and src/i18n/it.ts.');
  process.exit(1);
}
console.log(`PASS: all ${keys.length} catalog keys are read`);
