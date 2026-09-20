#!/usr/bin/env node
// Is the app really quiet on the network, or is it refetching behind our back?
//
// The brief's requirement is "normal navigation must not generate unnecessary repeated
// API requests", and the only way to satisfy it honestly is to count flights. This drives
// the real app on the simulator, with the real wger API behind it: tab round trips that a
// user would consider ordinary must add nothing to the ledger, and one new search term
// must add one page, not one per keystroke.
//
// Note what this does NOT prove: keystroke discipline. `fill` produces exactly one
// onChangeText no matter how many characters the term has, so a device run cannot see
// per-keystroke behaviour at all — that is proven in check:debounce, in node, where the
// typing rhythm is a controllable number instead of an artefact of the automator. A run
// like this is corroboration that the wire is quiet, not the measurement.
//
// Why the ledger, and not proxy logs or packet captures: the app counts its own requests
// at the one layer every request passes through (src/api/http.ts). That number is by
// construction the complete set, it needs no proxy trust, and it groups by path, which is
// exactly the granularity the claim is written at.
//
// Traps this script exists to not fall into again:
//   • Metro flags are PER CALL, not sticky, and a fresh `open` without them clears the
//     binding — the client then loads the dev shell of whatever else is on 8081 (the
//     user's other project), which looks like routing is broken when it is the tooling.
//     Every open below passes the flags; step 0 proves 8083 is ours.
//   • The ledger is below the fold, so reading it means scrolling first (see lib.js).
//   • Running a cold process is not free here: the ledger is module state, so a new
//     process zeroes it by forgetting it. That is fine — the baseline is taken after the
//     cold start, from the screen's own Reset, so the measured window is exact.

const { CWD, METRO, sh, sleep, nodes, visible, has, hasAnywhere, open, fail, pressText, ledger, scrollTop, tab } = require('./qa/lib');

process.chdir(CWD);

// ── 0. Whose Metro is this ─────────────────────────────────────────────────
const status = sh('curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:8083/status', { allowFail: true }).trim();
console.log(`0. Metro on 8083 answers ${status || '(no answer)'}`);
if (status !== '200') fail('8083 is not our Metro — refusing to measure someone else\'s app');

// ── 1. Cold start onto the dev screen, and zero the counters there ─────────
console.log('1. cold start');
open('dev', 'Developer');
// The baseline must be zero, or "unchanged" means nothing. Do not trust that the
// terminal was freshly launched to give us that: a `terminate` kills the process but
// leaves the binary's on-disk state, so a re-open can serve a warm Query cache and the
// first Exercises visit legitimately sends nothing. Clearing from the screen's own Reset
// makes the baseline exact regardless of how the process got here.
//
// It can only be pressed when there is something to clear — the button is conditional —
// so an empty ledger is skipped rather than hunted for.
// The Reset button is conditional — it only exists when there is something to clear — and
// it lives mid-screen, so this asks the screen rather than the current viewport.
if (!hasAnywhere('Nothing sent since')) {
  pressText('Reset');
  sleep(1);
}
const base = ledger('baseline');
// A non-zero baseline used to print a note and carry on. That note was doing a lot of quiet
// work: if the Reset press never landed, every number below is cumulative traffic blamed on
// the step that happened to precede it — which is exactly how this file spent an evening
// "proving" that tab navigation cost four requests when the app's very first visit did.
// Subtracting the baseline would be worse, because it is the correction that hides the defect
// it papers over. Refuse to measure instead.
if (base.total > 0) {
  fail(`baseline is not zero (${base.total}) — the ledger's Reset did not take, so no delta below ` +
       'can be attributed to a single action');
}

// ── 2. Warm the exercise cache once, then measure against that baseline ────
// An hour-old run may have left this key fresh in the cache. A warm visit that sends
// nothing is the correct behaviour, not a passed assertion, so the baseline is taken
// *after* a visit and the claim is measured as a relationship, never an absolute count.
console.log('2. one Exercises visit — establishes the cache state we measure against');
open('exercises', 'Exercise');
sleep(4);
const afterWarm = ledger('after first visit');
const firstDelta = afterWarm.total - base.total;
// Zero here is NOT a failure, and an earlier version of this line asserted that it was. The
// Query cache outlives a JS-context restart if the process was only backgrounded, so a visit
// can legitimately cost nothing — that is the cache doing its job, and demanding a request
// would make the check fail on the behaviour it exists to protect. What IS a defect is a
// visit that costs a pile: pages fetched far ahead of anything the user asked for.
if (firstDelta > 4) {
  fail(`a single Exercises visit cost ${firstDelta} requests (budget 4) — prefetch is running far ` +
       'ahead of the user, or one screen is asking for the same page repeatedly');
}
if (firstDelta === 0) {
  console.log('   (cache was already warm — nothing fetched; navigation below measures a warm app, ' +
              'which is the ordinary case)');
}

// ── 3. Tab round trips: three times Home↔Exercises, which is ordinary use ──
console.log('3. tab round trips');
for (let i = 0; i < 3; i += 1) {
  tab('home');
  sleep(2);
  tab('exercises');
  sleep(2);
}
open('dev', 'Developer');
const afterNav = ledger('after 3 round trips');

// ── 4. One new search term, typed in one action ───────────────────────────
console.log('4. one new search term');
const term = `chest${Math.floor(Math.random() * 900 + 100)}`;
open('exercises', 'Exercise');
// The field lives in the list header, so it is only reachable from the top of the list.
scrollTop();
const field = nodes().find((n) => n.type === 'TextField' && visible(n));
if (!field) fail('search field not found — cannot run the search half of this check');
// `fill` replaces the field; `type` appends to it, which on a second run would measure
// `chest703chest812` and attribute the difference to the app. Read back afterwards: the
// node does carry `value`, so there is no need to hope the keystrokes landed.
sh(`npx agent-device fill @${field.ref} ${term} 2>&1`, { allowFail: true });
sleep(6);
const typed = (nodes().find((n) => n.type === 'TextField' && visible(n)) ?? {}).value;
if (typed !== term) fail(`the search field reads "${typed}" not "${term}" — the ledger delta below would be measuring something else`);
open('dev', 'Developer');
const afterSearch = ledger(`after "${term}"`);

// ── Verdict ────────────────────────────────────────────────────────────────
// One new search must cost a page plus the settle-time commit — so one or two requests,
// and never anything resembling one per character.
const navDelta = afterNav.total - afterWarm.total;
const searchDelta = afterSearch.total - afterNav.total;
console.log(`\n   navigation added ${navDelta} request(s) over 3 round trips`);
console.log(`   one new search term added ${searchDelta} request(s)`);

// Path-level attribution, printed before the verdict: "navigation cost 6" is a symptom, and
// the row that repeats is the diagnosis. Without this the next reader re-runs the whole check
// to find out which endpoint is talking.
const byPath = new Map();
for (const [p, c] of afterSearch.rows) byPath.set(p, c);
console.log('\n   per-path totals:');
for (const [p, c] of [...byPath].sort((a, b) => b[1] - a[1])) {
  console.log(`     ${String(c).padStart(3)}  ${p}`);
}

let ok = true;
if (navDelta !== 0) { console.error(`   !! FAILED: ${navDelta} request(s) for ordinary tab navigation — expected 0`); ok = false; }
if (searchDelta < 1) { console.error(`   !! FAILED: a new search sent nothing — the term never reached the query`); ok = false; }
if (searchDelta > 2) { console.error(`   !! FAILED: a new search sent ${searchDelta}, expected one page (+1 settle commit at most)`); ok = false; }
if (base.total > 0) console.log(`   note: baseline was ${base.total} — the ledger was not empty when we took it; deltas above are what count`);
if (afterSearch.rows.some(([, c]) => c > 3)) console.error('   !! FAILED: a path fired >3× — see the ledger above');

console.log(ok ? '\nPASS' : '\nFAIL');
process.exit(ok ? 0 : 1);
