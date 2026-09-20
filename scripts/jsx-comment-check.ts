/**
 * Finds comments written as JSX children — which typecheck clean and then crash at runtime.
 *
 *   npm run check:jsx
 *
 * Why this exists when `tsc --noEmit` already runs: inside JSX, `//` is not a comment. The parser
 * reads it as two characters of *text*, React Native then throws "Text strings must be rendered
 * within a <Text> component", and the user meets a red box on a screen they were trying to use —
 * with the type checker entirely green. It happened in `app/workout/cardio.tsx` while removing a
 * `SectionHeader` eyebrow: the comment explaining why the prop was gone was itself rendered. A
 * first version of this script guessed at it from line shapes and missed the very case it was
 * written for, so it asks the TypeScript parser instead, which cannot guess wrong.
 *
 * What it detects: a `JsxText` node whose content begins with `//` or `/*` — i.e. the characters
 * actually reached a text position. `{/* … *\/}` is a `JsxExpression`, not `JsxText`, so correct
 * JSX comments are not flagged, and comments outside JSX are invisible to this walk.
 *
 * What it does not detect: ordinary stray text in JSX that is *not* comment-shaped (`<View>oops</View>`
 * on separate lines), which is the same runtime error from a different typo. That class needs
 * `react/jsx-no-leaked-render`-style linting and has not bitten yet; this file covers the one that did.
 */

import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DIRS = ['app', 'src'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

type Finding = { file: string; line: number; text: string };
const findings: Finding[] = [];
let filesScanned = 0;

for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const text = readFileSync(file, 'utf8');
    // Skip parsing entirely for files with no comment start — the common case, and this stays fast.
    if (!text.includes('//') && !text.includes('/*')) {
      filesScanned += 1;
      continue;
    }
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.ESNext,
      /* setParentNodes */ true,
      ts.ScriptKind.TSX,
    );
    (function visit(node: ts.Node): void {
      if (node.kind === ts.SyntaxKind.JsxText) {
        const content = (node as ts.JsxText).getText(source).trim();
        if (content.startsWith('//') || content.startsWith('/*')) {
          findings.push({
            file: relative(ROOT, file),
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
            text: content.slice(0, 72),
          });
        }
      }
      node.forEachChild(visit);
    })(source);
    filesScanned += 1;
  }
}

if (findings.length === 0) {
  console.log(`no comments rendered as JSX text (${filesScanned} .tsx files)`);
  process.exit(0);
}

console.log(`${findings.length} comment(s) sit in a JSX text position and would render as literal text:\n`);
for (const f of findings) console.log(`  ${f.file}:${f.line}\n      ${f.text}`);
console.log('\nWrap them in {/* … */} or lift them above the enclosing element.');
process.exit(1);
