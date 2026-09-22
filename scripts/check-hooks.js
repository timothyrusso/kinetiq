#!/usr/bin/env node
/**
 * Two ways translated copy silently freezes, both found in review rather than by a test.
 *
 * 1. A hook that calls `t()` and does not depend on it. `useCallback` keeps the translator it
 *    was created with, so a handler written in English keeps answering in English after the
 *    user switches to Italian. Fifteen of these existed; every one was an error message, which
 *    is the copy a user is least able to work around.
 *
 * 2. A memoised component that calls `tr()`. `tr` reads the language at call time but does not
 *    subscribe, so `memo` sees unchanged props, skips the render, and the words stay as first
 *    drawn. The rule is `useT()` inside components, `tr()` only outside React.
 *
 * Both are cheap to detect and expensive to notice by eye, which is the whole argument for
 * spending forty lines on them.
 */
const fs = require('fs');
const path = require('path');

/** A class component cannot call a hook, and its crash screen is terminal. */
const TR_ALLOWED = [/src\/providers\/RootErrorBoundary\.tsx$/];

const files = [];
for (const root of ['app', 'src']) {
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!/node_modules|\.git/.test(full)) walk(full);
      } else if (/\.tsx?$/.test(full)) {
        files.push(full);
      }
    }
  })(root);
}

const problems = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');

  // 1. Hooks whose body calls t() without listing it.
  for (const m of src.matchAll(/use(?:Memo|Callback)\(/g)) {
    let i = m.index + m[0].length - 1;
    let depth = 0;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (c === '(' || c === '[' || c === '{') depth += 1;
      else if (c === ')' || c === ']' || c === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const call = src.slice(m.index, i + 1);
    const open = call.lastIndexOf('[');
    if (open < 0) continue;
    const close = call.lastIndexOf(']');
    if (close < open) continue;
    const body = call.slice(0, open);
    const deps = call.slice(open, close + 1);
    if (!/\bt\(/.test(body) || /\bt\b/.test(deps)) continue;
    const line = src.slice(0, m.index).split('\n').length;
    problems.push(`${file}:${line}: hook calls t() but does not depend on it, so it keeps one language`);
  }

  // 2. Memoised components reaching for the non-subscribing translator.
  if (!/\btr\(/.test(src)) continue;
  if (TR_ALLOWED.some((re) => re.test(file))) continue;
  if (!/memo\(function/.test(src)) continue;
  if (/useT\(\)/.test(src)) continue;
  const line = src.split('\n').findIndex((l) => /\btr\(/.test(l) && !/^\s*(\*|\/\/)/.test(l)) + 1;
  problems.push(`${file}:${line}: memoised component calls tr(), which does not subscribe: use useT()`);
}

if (problems.length === 0) {
  console.log('PASS: no hook or memoised component holds a stale language');
  process.exit(0);
}
console.error(`FAIL: ${problems.length} stale-language problem(s)\n`);
for (const p of problems) console.error(`  ${p}`);
process.exit(1);
