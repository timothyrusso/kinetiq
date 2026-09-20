#!/usr/bin/env node
// Do the QA scripts actually agree with the harness they import?
//
// This exists because the same bug happened twice: a script was rewritten against a harness
// API that had changed under it — one destructured `pressText` before lib exported it, another
// used `TABS.home` when the keys are the visible labels (`Home`). Both are invisible to
// `tsc`, because these are plain node scripts importing a CommonJS module, and both killed a
// device run ten minutes in, after the simulator had already been driven into a specific
// state. Ten minutes of device time to discover a typo is the worst possible feedback loop for
// the tooling that is supposed to make device testing cheap.
//
// It is not a type checker and does not try to be. It answers one question, in well under a
// second and with no simulator: does every symbol these scripts destructure from lib exist,
// and does every TABS key name a real tab?
const fs = require('node:fs');
const path = require('node:path');
const L = require('./lib');

const ROOT = path.join(__dirname, '..', '..');
const scripts = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith('.js') && f !== 'check-refs.js' && f !== 'lib.js')
  .map((f) => path.join('scripts/qa', f));
if (fs.existsSync(path.join(ROOT, 'scripts/network-check.js'))) scripts.push('scripts/network-check.js');

let bad = 0;
const fail = (msg) => { console.error(`  !! ${msg}`); bad += 1; };

for (const rel of scripts) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');

  const destructure = src.match(/const \{([^}]*)\} = require\([^)]*lib[^)]*\)/s);
  if (destructure) {
    for (const name of destructure[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!(name in L)) fail(`${rel}: lib exports no "${name}"`);
    }
  }

  // The other half of the same bug: lib exports the name, the script calls it, and the
  // destructure at the top simply never mentions it. `pressText` was imported and unused while
  // `nodes` was called and absent — bothCommonJS skew tsc cannot see, and both die at runtime.
  if (destructure) {
    const have = new Set(destructure[1].split(',').map((x) => x.trim()).filter(Boolean));
    const libFns = Object.keys(L).filter((k) => typeof L[k] === 'function');
    for (const name of libFns) {
      const called = new RegExp(`(^|[^.\\w$])${name}\\s*\\(`).test(src.replace(/\/\/[^\n]*/g, ''));
      if (called && !have.has(name)) fail(`${rel}: calls ${name}() without importing it`);
    }
  }

  for (const key of [...src.matchAll(/TABS\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1])) {
    if (!(key in L.TABS)) {
      fail(`${rel}: TABS has no "${key}" — the keys are the visible tab labels: ${Object.keys(L.TABS).join(', ')}`);
    }
  }

  // A deep-link route that does not exist is the other slow-failing typo: the app renders its
  // not-found screen and the script times out waiting for a heading. The route names are the
  // ones the app's own navigation module exports.
  const routes = new Set([...src.matchAll(/open\(\s*'([\w[\]/.-]*)'/g)].map((m) => m[1]));
  const known = new Set(['dev', 'home', 'activities', 'workout', 'exercises', 'profile', 'settings']);
  for (const r of routes) if (!known.has(r)) fail(`${rel}: open('${r}') is not a known route name`);
}

console.log(bad ? `\nFAIL — ${bad} broken reference(s)` : 'PASS — every QA script resolves against the harness');
process.exit(bad ? 1 : 0);
