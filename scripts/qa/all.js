#!/usr/bin/env node
// Everything that needs the running app, in one command, in the order that keeps each honest.
//
// Why an order exists at all: these scripts share one device and one app process, and each
// leaves state behind. The offline check ends by clearing its fault, the pagination check ends
// with the list scrolled to its bottom and twenty pages warm in the cache, the network check
// reloads the app and zeroes the ledger. Run in the wrong sequence and a later script inherits
// an earlier one's residue: which is how a check starts reporting the previous check's
// leftovers as a defect in the app.
//
//   1. refs      static, sub-second, catches a typo that would otherwise cost minutes of device
//                time to discover (and did, twice). Before anything that can hang.
//   2. faults    arms and clears every injected failure; must run before anything that reads
//                the request ledger, since it deliberately sends a lot of requests.
//   3. offline   needs a healthy cache to prove routines do NOT use it, so it goes after the
//                fault run warmed things up.
//   4. network   reloads the app and resets the ledger, so it must not be followed by anything
//                that assumes a warm cache.
//   5. pagination ends by leaving the app warm and idle: the friendliest state to hand back.
//
// Fails on the first red script rather than running the rest: each one's premise is that the
// app is healthy enough to be measured, so continuing past a failure produces numbers that look
// like independent findings and are really one fault wearing several hats.

const { spawnSync } = require('node:child_process');

const STEPS = [
  ['refs', ['scripts/qa/check-refs.js']],
  ['faults', ['scripts/qa/fault-matrix.js']],
  ['offline', ['scripts/qa/offline-routines.js']],
  ['network', ['scripts/network-check.js']],
  ['pagination', ['scripts/qa/pagination-check.js']],
  // Last, because it is the only gate that WRITES. It creates, renames, duplicates and deletes
  // its own routines, and it discards an in-progress session as setup; running it earlier would
  // hand every later gate a database and a session state it did not expect.
  ['crud', ['scripts/qa/routine-crud.js']],
];

const only = process.argv[2];
const steps = only ? STEPS.filter(([name]) => name === only) : STEPS;

// Before anything runs. Every gate matches English copy, and this machine's simulator is
// it-CH, so the app's `system` language resolves to Italian and the suite fails on its first
// assertion against a screen it cannot read.
require('./lib').forceEnglishUI();
if (!steps.length) {
  console.error(`unknown step "${only}": known: ${STEPS.map(([n]) => n).join(', ')}`);
  process.exit(2);
}

for (const [name, args] of steps) {
  console.log(`\n╔═ ${name} ${'═'.repeat(Math.max(0, 60 - name.length))}`);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n✗ ${name} failed (exit ${r.status}): stopping, because every later ` +
                  'script assumes the app was healthy enough to measure.');
    process.exit(r.status ?? 1);
  }
}

console.log(`\n✓ all ${steps.length} device check(s) green`);
