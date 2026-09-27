#!/usr/bin/env node
/**
 * The coverage floor of issue #55: 80 percent of the lines of `features/<feature>/useCases/` and
 * `features/<feature>/data/`, summed over every file in them (a per-file floor would fail a
 * four-line adapter with one untested branch).
 *
 *   node scripts/check-coverage.js        (after `jest --coverage`, part of `npm run test:coverage`)
 *
 * It reads the `json-summary` report jest wrote to `coverage/coverage-summary.json`. The kit's
 * global floors stay in `jest.config.cjs`; this is the app's stricter floor on the inner layers.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SUMMARY = path.join(ROOT, 'coverage', 'coverage-summary.json');
const FLOOR = 80;
const INNER_LAYER = /\/features\/.+\/(useCases|data)\//;

const summary = JSON.parse(fs.readFileSync(SUMMARY, 'utf8'));
let covered = 0;
let total = 0;
for (const [file, metrics] of Object.entries(summary)) {
  if (file === 'total' || !INNER_LAYER.test(file)) continue;
  covered += metrics.lines.covered;
  total += metrics.lines.total;
}

const percent = total === 0 ? 100 : (covered / total) * 100;
const line = `useCases and data lines: ${percent.toFixed(2)}% (${covered}/${total}), floor ${FLOOR}%`;
if (percent >= FLOOR) {
  console.log(`PASS: ${line}`);
  process.exit(0);
}
console.error(`FAIL: ${line}`);
process.exit(1);
