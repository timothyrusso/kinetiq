#!/usr/bin/env node
/**
 * Network-hygiene check: "normal navigation must not generate unnecessary repeated API
 * requests", "no infinite refetch loops", "sensible caching".
 *
 * The instrument is the dev screen's request ledger (src/api/devFaults.ts, called from
 * src/api/http.ts), which counts every HTTP call in module state, grouped by path. It is
 * the only way to see this on a device: a screen looks identical whether it fired one
 * request or forty.
 *
 * Three things this script must not get wrong, each learned the hard way:
 *
 *  1. METRO IS A PER-CALL FLAG. This machine also runs an unrelated project's dev server
 *     on 8081. A single flagless `open` clears the session's dev-server binding, after
 *     which the client can load THAT bundle — where every kinetiq link shows expo's dev
 *     panel and the ledger reads empty for reasons that have nothing to do with kinetiq.
 *     Every open here passes the flags, and open() refuses to interpret two look-alike
 *     screens as a routing bug.
 *  2. THE LEDGER MUST BE ON SCREEN TO BE READ. React Native does not put never-rendered
 *     content in the accessibility tree, so a snapshot taken on arrival can show an empty
 *     ledger that is merely an unrendered one — precisely the false pass this check exists
 *     to prevent. ledger() scrolls until the card's own prose appears, and fails if it
 *     never does.
 *  3. NO --relaunch. It rejects URL targets and Metro flags alike, and a new process
 *     zeroes the ledger by forgetting it. The baseline comes from the screen's own "Reset"
 *     instead, which zeroes the counters and keeps everything already fetched.
 *
 * Usage: node scripts/network-check.js
 */
const { execSync } = require('child_process');

const CWD = '/Users/trusso/Desktop/Projects/kinetiq';
const METRO = '--metro-host 127.0.0.1 --metro-port 8083';
// Tab-bar centres read off a snapshot rather than assumed: the items are `Other` nodes, so
// agent-device cannot press them by label and they must be tapped by coordinate.
const TABS = { Home: '50 810', Activities: '125 810', Workout: '201 810', Exercises: '277 810', Profile: '352 810' };

function sh(cmd, { allowFail = false } = {}) {
  try {
    return execSync(cmd, { cwd: CWD, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    if (allowFail) return String(e.stdout ?? '') + String(e.stderr ?? '');
    throw e;
  }
}
const sleep = (s) => sh(`sleep ${s}`);

function nodes() {
  try {
    return (JSON.parse(sh('npx agent-device snapshot --json 2>/dev/null')).data ?? {}).nodes ?? [];
  } catch {
    return [];
  }
}
/**
 * Every label, whatever the node type. An earlier version filtered to StaticText and then
 * reported "ledger never scrolled into view" while the ledger sat plainly on screen: the
 * card body renders through Txt, which shows up as an `Other` node here, so a filter
 * written for headings cannot see the sentence that proves the card is present. Reading an
 * empty ledger you cannot see is the failure mode this whole script is built around, so it
 * reads all labels and matches on the words rather than on a role.
 */
const texts = () => nodes().filter((n) => (n.label ?? '').trim()).map((n) => (n.label ?? '').trim());

/**
 * Open a kinetiq route and confirm we landed somewhere real.
 *
 * Two screens are not the app, and they have different causes, so each is named rather
 * than reported as "the route failed":
 *   - expo's dev panel ("Source code explorer") => the link did not route, or the client is
 *     attached to a foreign bundle (see constraint 1).
 *   - expo-dev-launcher's server picker ("DEVELOPMENT SERVERS") => the app is running but
 *     has no dev server attached, which is what any restart leaves behind. Recoverable by
 *     pressing the saved 8083 row; mistaking it for a routing bug cost a full diagnosis
 *     cycle, so it is handled here rather than failed on.
 */
function open(route, expectText) {
  let dismissedPanel = false;
  sh(`npx agent-device open "kinetiq://${route}" ${METRO} 2>&1`, { allowFail: true });
  for (let i = 0; i < 10; i += 1) {
    const t = texts();
    if (t.some((x) => /DEVELOPMENT SERVERS|RECENTLY OPENED/.test(x))) {
      console.log('   app is on the dev-server picker — reconnecting to 8083');
      sh(`npx agent-device press 'text^="http://127.0.0.1:8083"' 2>&1`, { allowFail: true });
      sleep(18);
      continue;
    }
    if (t.some((x) => /Source code explorer/.test(x))) {
      // expo's dev menu, which rapid tapping summons. It renders over the app, so it is not
      // evidence about routing at all — and earlier work on this app already established
      // that the gearshape.fill artifact behind it is RN's own dev-only menu. Dismiss it
      // once and keep looking; only a second sighting is treated as a real problem.
      if (dismissedPanel) {
        console.error(`   !! expo dev panel again after opening "${route}" — the link really is`);
        console.error('      unrouted, or the client is attached to the wrong bundle.');
        process.exit(1);
      }
      dismissedPanel = true;
      console.log('   expo dev menu is covering the app — dismissing it');
      sh(`npx agent-device press 'text="Close"' 2>&1`, { allowFail: true });
      sleep(2);
      sh(`npx agent-device open "kinetiq://${route}" ${METRO} 2>&1`, { allowFail: true });
      sleep(4);
      continue;
    }
    if (!expectText || t.some((x) => x.includes(expectText))) return true;
    sleep(2);
  }
  console.error(`   !! never saw "${expectText}" after opening "${route}"`);
  process.exit(1);
}

/** Scroll the dev screen's ledger into view, then read it. Fails rather than guessing. */
function ledger(label) {
  const MARKERS = ['Grouped by path', 'The repeated-request check', 'Nothing sent since'];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const t = texts();
    if (t.some((x) => MARKERS.some((m) => x.includes(m)))) {
      const rows = [];
      let total = null;
      for (let i = 0; i < t.length; i += 1) {
        const m = /^(\d+) requests?$/.exec(t[i]);
        if (m) total = Number(m[1]);
        // LedgerRow renders the path, then ×count as the next text node (dev.tsx:499).
        if (/^\//.test(t[i]) && /^×\d+$/.test(t[i + 1] ?? '')) rows.push([t[i], Number(t[i + 1].slice(1))]);
      }
      // The header eyebrow ("5 requests") is the screens own total, but it is a styled
      // variant that does not always surface as its own label. The rows are the authority
      // either way — they are what the check compares — so the total is their sum and the
      // eyebrow, when present, is only a cross-check worth complaining about.
      const sum = rows.reduce((n, [, c]) => n + c, 0);
      if (total !== null && total !== sum) {
        console.log(`   note: header says ${total} but rows sum to ${sum}; trusting the rows`);
      }
      const body = rows.length
        ? `total=${sum}  ${rows.sort((a, b) => a[0].localeCompare(b[0])).map(([p, c]) => `${p} ×${c}`).join('   ')}`
        : '(none sent)';
      console.log(`   ${label.padEnd(22)} ${body}`);
      return { total: sum, rows };
    }
    // A bounded pan: one large swipe overshoots the card in a list this long.
    sh('npx agent-device swipe 201 620 201 340 --pause-ms 150 2>/dev/null', { allowFail: true });
    sleep(1);
  }
  console.error(`   ${label.padEnd(22)} !! ledger never scrolled into view`);
  process.exit(1);
}

/** Press a control by label, scrolling it into view first (agent-device will not press off-screen). */
function pressLabel(label) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const ref = nodes().find((n) => (n.label ?? '').trim() === label)?.ref;
    if (ref) {
      const out = sh(`npx agent-device press "@${ref}" 2>&1`, { allowFail: true });
      if (/Error|INVALID|FAILED/.test(out)) {
        console.error(`   !! press ${label}: ${(out.split('\n').find((l) => /Error/.test(l)) ?? out).trim()}`);
        return false;
      }
      return true;
    }
    sh('npx agent-device swipe 201 620 201 340 --pause-ms 150 2>/dev/null', { allowFail: true });
    sleep(1);
  }
  console.error(`   !! never found "${label}" on screen`);
  return false;
}

/**
 * Put a search term into the exercises search box.
 *
 * `fill` replaces rather than appends, so a word left in the box by an earlier run cannot
 * quietly turn this into a search for something else. No read-back is attempted: the
 * snapshot exposes this TextField with no value and no label, so nothing here could prove
 * the text landed. The verification is downstream instead — a term never typed before is a
 * new query key and must cause exactly one page request, and a fill that silently failed
 * would cause none, which the verdict below reads as a failure rather than as a pass.
 */
function searchFor(term) {
  const field = nodes().find((n) => n.type === 'TextField');
  if (!field?.ref) return false;
  const out = sh(`npx agent-device fill "@${field.ref}" "${term}" 2>&1`, { allowFail: true });
  if (/Error|INVALID|FAILED/.test(out)) {
    console.error(`   !! fill failed: ${(out.split('\n').find((l) => /Error/.test(l)) ?? out).trim()}`);
    return false;
  }
  return true;
}

const tab = (name) => sh(`npx agent-device tap ${TABS[name]} 2>&1`, { allowFail: true });

// ── 0. which bundle are we on? ────────────────────────────────────────────────
console.log('--- 0. kinetiq’s Metro answers (8081 belongs to a different project) ---');
const status = sh('curl -s -o /dev/null -w "%{http_code}" --max-time 6 http://127.0.0.1:8083/status || echo down');
console.log(`   metro 8083: ${status}`);
if (status !== '200') {
  console.error('   !! kinetiq’s Metro is not answering; nothing below this would mean anything');
  process.exit(1);
}

// ── 1. baseline ───────────────────────────────────────────────────────────────
console.log('--- 1. dev screen, counters zeroed by its own Reset control ---');
open('dev');  // arrival is proven by ledger() scrolling to the card
let base = ledger('arriving:');
if (base.total > 0) {
  // "Reset" exists only while the log is non-empty. Re-entering the screen re-reads through
  // useFocusEffect, so what comes back is the zeroed state and not a stale render.
  pressLabel('Reset');
  sleep(1);
  open('dev');  // arrival is proven by ledger() scrolling to the card
  base = ledger('after-Reset:');
}
if (base.total !== 0) {
  console.error('   !! could not reach a zero baseline; a non-zero start makes every later reading ambiguous');
  process.exit(1);
}

// ── 2. navigation over a warm cache must be silent ────────────────────────────
//     The cache is neither forced cold nor forced warm: there is no --relaunch in this
//     script, so it is whatever the running process happens to hold. That is fine, because
//     what is being asserted is a relationship — arriving at a screen whose data is
//     already held must add nothing. If it *was* cold, this step shows one request per
//     endpoint and the round trips that follow are the real test.
console.log('--- 2. first Exercises visit: at most one request per endpoint ---');
open('exercises');
sleep(7);
open('dev');
const first = ledger('first-visit:');
const perPath = first.rows.map(([, c]) => c);
if (perPath.some((c) => c > 1)) {
  console.log('   note: a path repeated on first arrival — a list and its detail page can');
  console.log('         legitimately both need it, so this is a note, not a failure');
}

// ── 3. the actual claim: ordinary navigation must not re-fetch ────────────────
console.log('--- 3. three Home<->Exercises round trips on the real tab bar ---');
for (let i = 1; i <= 3; i += 1) {
  tab('Home');
  sleep(2);
  tab('Exercises');
  sleep(3);
  process.stdout.write(`   round trip ${i} done\n`);
}
open('dev');
const afterNav = ledger('after-round-trips:');

// ── 4. a search for a term never typed is a NEW query key, so it must fetch ────
console.log('--- 4. one search for a term never typed before ---');
open('exercises');
sleep(4);
const term = `chest${Math.floor(Math.random() * 900 + 100)}`;
if (!searchFor(term)) { console.error('   !! could not reach the search field'); process.exit(1); }
sleep(7);
open('dev');
const afterSearch = ledger(`search(${term}):`);

// ── verdict ───────────────────────────────────────────────────────────────────
const navDelta = afterNav.total - first.total;
const searchDelta = afterSearch.total - afterNav.total;
console.log('--- verdict ---');
console.log(`   first visit ${first.total}   +3 round trips -> ${afterNav.total} (extra ${navDelta})   + one search -> ${afterSearch.total} (extra ${searchDelta})`);
for (const [p0, c] of first.rows) {
  const now = afterNav.rows.find(([q]) => q === p0)?.[1];
  if (now !== c) console.log(`   ${p0}: ${c} -> ${now}`);
}

let failed = false;
if (navDelta === 0) {
  console.log('   PASS — navigation alone sent nothing: the five-minute cache held');
} else {
  console.log(`   FAIL — ${navDelta} request(s) fired by navigation alone`);
  failed = true;
}
// One new term is one commit (`fill` replaces the value in a single write), so one page
// request is the expected cost. The ceiling of 2 leaves room for the previous query being
// re-satisfied after the box is cleared. Note what this does NOT prove: keystroke
// discipline. `fill` produces exactly one onChangeText no matter how many characters the
// term has, so a device run cannot see per-keystroke behaviour at all — that is proven in
// check:debounce, where keystrokes are delivered on a schedule the test controls.
if (searchDelta === 0) {
  console.log('   FAIL — a brand new search term fetched nothing, so results cannot be current');
  failed = true;
} else if (searchDelta > 2) {
  console.log(`   FAIL — one committed search caused ${searchDelta} requests; something is refetching per commit`);
  failed = true;
} else {
  console.log(`   PASS — one new term cost ${searchDelta} request(s)`);
}
process.exit(failed ? 1 : 0);
