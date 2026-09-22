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
// per-keystroke behaviour at all: that is proven in check:debounce, in node, where the
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
//     binding: the client then loads the dev shell of whatever else is on 8081 (the
//     user's other project), which looks like routing is broken when it is the tooling.
//     Every open below passes the flags; step 0 proves 8083 is ours.
//   • The ledger is below the fold, so reading it means scrolling first (see lib.js).
//   • Running a cold process is not free here: the ledger is module state, so a new
//     process zeroes it by forgetting it. That is fine: the baseline is taken after the
//     cold start, from the screen's own Reset, so the measured window is exact.

const {
  forceEnglishUI,CWD, METRO, sh, sleep, nodes, visible, has, hasAnywhere, open, fail, pressText, ledger, scrollTop, tab } = require('./qa/lib');

// English, whatever the device or the user's setting: every assertion below matches English copy.
forceEnglishUI();

process.chdir(CWD);

// ── 0. Whose Metro is this ─────────────────────────────────────────────────
const status = sh('curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:8083/status', { allowFail: true }).trim();
console.log(`0. Metro on 8083 answers ${status || '(no answer)'}`);
if (status !== '200') fail('8083 is not our Metro: refusing to measure someone else\'s app');

// ── 1. Cold start onto the dev screen, and zero the counters there ─────────
console.log('1. cold start');
open('dev', 'Developer');
// The baseline must be zero, or "unchanged" means nothing. Do not trust that the
// terminal was freshly launched to give us that: a `terminate` kills the process but
// leaves the binary's on-disk state, so a re-open can serve a warm Query cache and the
// first Exercises visit legitimately sends nothing. Clearing from the screen's own Reset
// makes the baseline exact regardless of how the process got here.
//
// It can only be pressed when there is something to clear: the button is conditional, // so an empty ledger is skipped rather than hunted for.
// The Reset button is conditional: it only exists when there is something to clear: and
// it lives mid-screen, so this asks the screen rather than the current viewport.
if (!hasAnywhere('Nothing sent since')) {
  pressText('Reset');
  sleep(1);
}
const base = ledger('baseline');
// A non-zero baseline used to print a note and carry on. That note was doing a lot of quiet
// work: if the Reset press never landed, every number below is cumulative traffic blamed on
// the step that happened to precede it: which is exactly how this file spent an evening
// "proving" that tab navigation cost four requests when the app's very first visit did.
// Subtracting the baseline would be worse, because it is the correction that hides the defect
// it papers over. Refuse to measure instead.
if (base.total > 0) {
  fail(`baseline is not zero (${base.total}): the ledger's Reset did not take, so no delta below ` +
       'can be attributed to a single action');
}

// ── 2. Warm the exercise cache once, then measure against that baseline ────
// An hour-old run may have left this key fresh in the cache. A warm visit that sends
// nothing is the correct behaviour, not a passed assertion, so the baseline is taken
// *after* a visit and the claim is measured as a relationship, never an absolute count.
console.log('2. one Exercises visit: establishes the cache state we measure against');
open('exercises', 'Exercise');
sleep(4);
const afterWarm = ledger('after first visit');
const firstDelta = afterWarm.total - base.total;
// Zero here is NOT a failure, and an earlier version of this line asserted that it was. The
// Query cache outlives a JS-context restart if the process was only backgrounded, so a visit
// can legitimately cost nothing: that is the cache doing its job, and demanding a request
// would make the check fail on the behaviour it exists to protect. What IS a defect is a
// visit that costs a pile: pages fetched far ahead of anything the user asked for.
// The floor for a genuinely cold visit is FIVE, not four: wger exposes its taxonomy as four
// separate endpoints (category, muscle, equipment, language), each fetched once and then
// cached for the life of the app, plus the first page of results. There is no arrangement of
// a correct client that pays less on a cold cache, so a budget of 4 failed the app for doing
// the minimum. What the check is really for is the case above that: a second page nobody
// asked for, or the same page fetched twice.
const COLD_VISIT_BUDGET = 5;
if (firstDelta > COLD_VISIT_BUDGET) {
  fail(`a single Exercises visit cost ${firstDelta} requests (budget ${COLD_VISIT_BUDGET}: four ` +
       'taxonomy endpoints plus one page): prefetch is running ahead of the user, or one screen ' +
       'is asking for the same page repeatedly');
}
if (firstDelta === 0) {
  console.log('   (cache was already warm: nothing fetched; navigation below measures a warm app, ' +
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
// Settle the tab, then start the clock.
//
// Re-entering the tab can refetch the catalog listing: its own query, older than the search
// and quite entitled to go stale while the gates before this one ran. Measuring from the dev
// screen therefore charged that refetch to the search, and the delta read 3 in a full suite
// and 2 standalone for identical app behaviour: the difference being only how stale the
// catalog happened to be. A check that claims to measure ONE SEARCH has to open its window
// once the screen is quiet.
sleep(6);
open('dev', 'Developer');
const beforeType = ledger('tab settled, before typing');
open('exercises', 'Exercise');
// The field lives in the list header, so it is only reachable from the top of the list.
scrollTop();
const field = nodes().find((n) => n.type === 'SearchField' && visible(n));
if (!field) fail('search field not found: cannot run the search half of this check');
// `fill` replaces the field; `type` appends to it, which on a second run would measure
// `chest703chest812` and attribute the difference to the app. Read back afterwards: the
// node does carry `value`, so there is no need to hope the keystrokes landed.
sh(`npx agent-device fill @${field.ref} ${term} 2>&1`, { allowFail: true });
sleep(6);
const typed = (nodes().find((n) => n.type === 'SearchField' && visible(n)) ?? {}).value;
if (typed !== term) fail(`the search field reads "${typed}" not "${term}": the ledger delta below would be measuring something else`);
open('dev', 'Developer');
const afterSearch = ledger(`after "${term}"`);

// ── Verdict ────────────────────────────────────────────────────────────────
// One new search must cost a page plus the settle-time commit: so one or two requests,
// and never anything resembling one per character.
const navDelta = afterNav.total - afterWarm.total;
const searchDelta = afterSearch.total - beforeType.total;
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
if (navDelta !== 0) { console.error(`   !! FAILED: ${navDelta} request(s) for ordinary tab navigation: expected 0`); ok = false; }
if (searchDelta < 1) { console.error(`   !! FAILED: a new search sent nothing: the term never reached the query`); ok = false; }
if (searchDelta > 2) { console.error(`   !! FAILED: a new search sent ${searchDelta}, expected one page (+1 settle commit at most)`); ok = false; }
if (base.total > 0) console.log(`   note: baseline was ${base.total}: the ledger was not empty when we took it; deltas above are what count`);

// A LOOPING path, measured inside one phase rather than summed across the run.
//
// This used to compare the cumulative per-path total against 3, which this script trips by
// construction: it deliberately performs two measured phases (a cold visit, then a search),
// each legitimately costing a page, so `exerciseinfo` reaches 4 with the app behaving
// perfectly. It also printed "FAILED" without setting `ok`, so the run ended "FAILED ... PASS"
// and exited 0. A check that cannot fail the run should not use the word, and one that always
// trips teaches the reader to ignore it.
//
// What it is actually for is a query that repeats: the same endpoint firing again and again
// for one user action. That is a per-phase question, so it is asked per phase.
const perPhase = (before, after) => {
  const prior = new Map(before.rows);
  return after.rows
    .map(([path, count]) => [path, count - (prior.get(path) ?? 0)])
    .filter(([, delta]) => delta > 0);
};
const LOOP_CEILING = 3;
for (const [phase, before, after] of [
  ['the cold Exercises visit', afterWarm, afterNav],
  ['one search', beforeType, afterSearch],
]) {
  for (const [path, delta] of perPhase(before, after)) {
    if (delta > LOOP_CEILING) {
      console.error(`   !! FAILED: ${path} fired ${delta}× during ${phase}: that is a loop, not a page`);
      ok = false;
    }
  }
}

console.log(ok ? '\nPASS' : '\nFAIL');
process.exit(ok ? 0 : 1);
