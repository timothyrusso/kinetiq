#!/usr/bin/env node
/**
 * One horizontal edge, owned in one place.
 *
 *   node scripts/check-layout.js        (part of `npm run check`)
 *
 * `screenGutter` is the only token allowed to decide how far content sits from the screen
 * edge. Before this check, the same 20 pt was spelled `screenGutter` in most screens,
 * `spacing.xl` in five files and `26` in two more, which is three sources for one number and
 * the reason two screens could drift four points apart without anyone noticing.
 *
 * So in `app/**` and `src/ui/**` a horizontal padding or margin must not be a literal number
 * (other than 0, which is a reset rather than a measurement) and must not be `spacing.xl`,
 * the token that kept standing in for the gutter. `px="xl"` on a layout primitive is the same
 * thing spelled as a prop and is caught too. Everything else (`screenGutter`, a smaller
 * spacing step inside a component, `'auto'`) passes.
 *
 * Chart internals position axis labels by measured pixel offsets that are not layout, so
 * the files listed in `scripts/check-layout.allow` are skipped. Add to it only for that kind
 * of reason, and say why beside the entry.
 */
const { readdirSync, readFileSync, statSync } = require('fs');
const { join, relative, extname } = require('path');

const ROOT = join(__dirname, '..');
const ROOTS = ['app', 'src/ui'];
const EXTS = new Set(['.ts', '.tsx']);

const allow = new Set(
  readFileSync(join(__dirname, 'check-layout.allow'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean),
);

const PROPS = 'paddingHorizontal|paddingLeft|paddingRight|marginHorizontal|marginLeft|marginRight';
// A literal number (not 0) or `spacing.xl`, as the whole value of one of those properties.
const STYLE_HIT = new RegExp(
  `\\b(${PROPS})\\s*:\\s*(-?(?:[1-9]\\d*(?:\\.\\d+)?|0\\.\\d+)|spacing\\.xl)\\b(?!\\s*[-+*/.])`,
  'g',
);
const PROP_HIT = /\bpx=(?:"xl"|\{\s*'xl'\s*\}|\{\s*"xl"\s*\})/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.has(extname(entry))) out.push(full);
  }
  return out;
}

const hits = [];
for (const r of ROOTS) {
  for (const file of walk(join(ROOT, r))) {
    const rel = relative(ROOT, file);
    if (allow.has(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // Comments explain old values; they are not layout.
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
      for (const re of [STYLE_HIT, PROP_HIT]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(code)) !== null) {
          hits.push(`${rel}:${i + 1}: ${m[0].trim()}`);
        }
      }
    });
  }
}

if (hits.length > 0) {
  console.error(
    `FAIL: ${hits.length} horizontal padding or margin values bypass screenGutter ` +
      '(a literal number or spacing.xl). Use screenGutter for an edge, a smaller spacing ' +
      'step inside a component, or allowlist a chart file in scripts/check-layout.allow.',
  );
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log('PASS: every horizontal edge in app/ and src/ui/ comes from a token');
