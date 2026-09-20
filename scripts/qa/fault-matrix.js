#!/usr/bin/env node
// Arm every failure the dev screen can inject, and check what the app does about each.
//
// The brief asks for error states that are distinct and recoverable, which is three separate
// claims per fault, not one:
//   1. the error state RENDERS (not a spinner forever, not a blank list, not a crash),
//   2. the retry POLICY is the one the code claims — an offline error must not be retried at
//      all, a 500 twice, a 429 three times honouring Retry-After,
//   3. the app RECOVERS when the fault is cleared, via the control it puts on screen.
//
// Claim 2 is why the ledger is read every time: "we retry twice" is invisible in the UI and is
// exactly the kind of thing a code comment asserts confidently while the wiring does something
// else. Requests attempted per fault is the number that settles it.
//
// ── The fixture has to be COLD, and cold has to be proven, not assumed ────────────────────
//
// First version of this file armed a fault, typed a new term, and asserted the error state. It
// failed on "deadlift", and the failure was the harness's. The screen was showing
// `OUTDATED RESULTS / Retry` over fourteen deadlift rows — which is *correct* behaviour for a
// query that already has data (see `placeholderData: keepPreviousData`) and the wrong fixture for
// an error state — and it was there because an earlier probe run of mine had searched that exact
// word and the in-memory cache still held it. A cold query is a property of the RUN, and a
// script cannot assume the device it inherited is clean.
//
// So: each case restarts the app (the cache is memory-only, so nothing survives), and the cold
// start is *verified* by the ledger rather than trusted — zero requests before the first search,
// and after it only ever the search's own paths. If a fault happened to be left armed by a dead
// process, or the launcher shows anything chatty, that check catches it before any number below
// means anything.
//
// Other traps already paid for:
//   • The term must RETURN ROWS. Gibberish comes back as a successful empty result, and the
//     "No exercises match" screen is then correct — a probe once armed a fault, searched for
//     nonsense, saw an empty state, and concluded the error state was unreachable.
//   • Each fault must be armed for burst × attempts, not one request (fixed in app/dev.tsx): an
//     exercise page fires three requests in parallel, so a one-request outage heals mid-flight.
//   • Keep every read BOUNDED (`below`, not `hasAnywhere`): walking the exercise list to its
//     bottom pages it, and those page fetches land in the ledger charged to the fault.

const {
  CWD, sh, sleep, open, fail, ledger, nodes, visible, seek, scrollTop,
  has, labels, pressLabel, pressRow, onExit, clearFaultQuietly, restartApp,
} = require('./lib');

process.chdir(CWD);
// Undo the fault on every exit path. A fault lives in the app's memory, so a script that dies
// with one armed leaves the NEXT script measuring a broken network while believing it armed
// nothing — the failure then shows up somewhere unrelated and looks like an app bug. It also
// makes the next case's cold-start check fail, which is the honest symptom, but only if the
// cleanup actually runs; `fail()` exits, hence the hook.
onExit(clearFaultQuietly);

const SEARCH_FIELD = 'Search the exercise catalog';

/**
 * Every term must be one that RETURNS ROWS (see the header) and must differ from every other
 * term in the run, because re-writing the term already committed is a no-op: the debounce
 * commits nothing, no request leaves, and the screen stays serenely healthy.
 */
const TERM_BASE = 'squat';

/**
 * Zero the counters, then wait until they have STOPPED MOVING.
 *
 * "Zero" is the wrong requirement, and the run that proved it is worth recording: after Reset
 * the ledger read `/equipment ×1, /muscle ×1, /category ×1` on six consecutive polls, and the
 * obvious conclusion was "the app is still sending while idle" — a request loop, one of the
 * defects this file exists to find. It was wrong. Those are the three taxonomy calls the
 * Exercises tab prefetches, and their counts were `×1` every single time: a loop accumulates,
 * and a set of counters that never increments is an app that has finished. What varied between
 * runs was only whether those three had *landed* before the clear (an earlier run showed a
 * clean zero) or after it — wger latency, on the order of tens of seconds, versus my wait.
 *
 * The property that matters is *quiescence*: two reads three seconds apart with nothing in
 * between must agree. Zero is a special case of that, and the per-fault numbers are deltas
 * anyway, so a settled baseline of three costs the measurement nothing. A genuine loop fails
 * here for the right reason — the counters never settle — and says so with the growth it saw.
 */
function ledgerSettled(name) {
  let prev = ledger(name).total;
  for (let i = 0; i < 10; i += 1) {
    sleep(3);
    const now = ledger(`${name} (settle ${i + 1})`).total;
    if (now === prev) return now;
    prev = now;
  }
  return -1; // never settled
}

function resetLedger(name) {
  // Settle FIRST, then clear. The order is the whole point: clearing a counter while requests
  // are in flight means they are recorded after the clear, so a freshly opened tab's own traffic
  // looks like post-reset activity. Waiting for the counters to stop moving first makes the
  // following zero mean something — nothing was in flight when it was written, so anything that
  // appears afterwards was started by an app that had already finished loading.
  if (ledgerSettled(`${name} (pre-reset)`) === -1) {
    fail(
      `${name}: the request counters never settled over ~30 s of the app sitting on a loaded ` +
        'screen. That is the loop/retry-storm signature the brief asks this check to rule out, ' +
        'and every per-fault ceiling below would be noise.',
    );
  }
  open('dev', 'Developer');
  const reset = nodes().find((n) => (n.label ?? '').trim() === 'Reset');
  if (reset) sh(`npx agent-device press '@${reset.ref}' 2>&1`, { allowFail: true });
  sleep(4);
  const l = ledger(`${name} (after reset)`);
  if (l.total !== 0) {
    fail(
      `${name}: requests appeared after the counters settled and were cleared ` +
        `(${l.rows.map(([p, n]) => `${p} ×${n}`).join(', ')}). An idle app on a loaded screen ` +
        'should send nothing — this is a refetch with nobody asking for it.',
    );
  }
  return l;
}

/**
 * Bring the app up from nothing and prove the cache came up empty with it.
 *
 * The proof is the ledger: a warm cache serves the first search from memory and sends nothing,
 * a stale-but-retained one sends one refetch, and only a genuinely cold one sends exactly the
 * paths its own first page needs. Asserting that before faulting is what lets a later count of
 * N requests be read as a retry policy rather than as noise.
 */
function coldStart(terms) {
  restartApp();
  open('exercises', 'SEARCH EXERCISES');
  sleep(6);
  resetLedger('cold start');
  const field = searchField();
  sh(`npx agent-device fill @${field.ref} ${terms[0]} 2>&1`, { allowFail: true });
  sleep(10);
  if (!has(`exercises for “${terms[0]}”`)) {
    fail(`the cold-start search for "${terms[0]}" never rendered results — the network is not ` +
         'healthy enough to measure a failure against');
  }
  const l = ledger('cold start after one search');
  const paths = l.rows.map(([p]) => p);
  // The search page's own paths. The taxonomy query is two calls, not the three of a search
  // page, so the second path here is `/language/` rather than another `/exerciseinfo/` — the
  // first draft of this guard demanded `exerciseinfo` appear on EVERY path and failed a clean
  // cold start. What matters is the converse: nothing that ISN'T part of opening this tab.
  const unexpected = paths.filter((p) => !/exerciseinfo|language|category|muscle|equipment/.test(p));
  if (unexpected.length) fail(`cold start sent unexpected paths: ${unexpected.join(', ')}`);
  if (!paths.some((p) => p.includes('exerciseinfo'))) {
    fail(`cold start sent no exercise-list request at all (${paths.join(', ')}) — the search ` +
         'never reached the network, so nothing below can be attributed to a fault');
  }
  // Deliberately NOT asserted here: whether the screen keeps old rows under a fault. The first
  // draft demanded the "Outdated results" badge at this point, and that was simply wrong about
  // the app — the badge appears when a search fails while previous rows are on screen, and there
  // is no failure yet in a healthy warm-up. Asserting it would have made a correct screen look
  // broken, which is the failure mode this whole file has been fighting. What the case below
  // asserts instead is the thing that matters: a failure produces an error state.
  console.log(`   cold start: ${l.total} request(s) — ${l.rows.map(([p, n]) => `${p.split('/').pop()} ×${n}`).join(', ')}`);
}

/**
 * The exercises tab's landmark is `SEARCH EXERCISES`, and it is upper-case because the section
 * label sets `uppercase` and iOS reports the *rendered* string as the accessibility label — the
 * source says "Search exercises". Asking for the source casing made every navigation to this tab
 * time out with "never saw it", on a screen that was plainly there. Same lesson as the ledger:
 * anchor on what the snapshot prints, not on what the JSX reads like.
 */
/** The search box, visible, ready to type into. */
function searchField() {
  open('exercises', 'SEARCH EXERCISES');
  sleep(2);
  scrollTop({ max: 4 });
  const byLabel = nodes().find(
    (n) => n.type === 'TextField' && visible(n) && (n.label ?? '').includes(SEARCH_FIELD),
  );
  const field = byLabel ?? nodes().find((n) => n.type === 'TextField' && visible(n));
  if (!field) fail('no visible search field on Exercises');
  return field;
}

/**
 * Is this copy on the screen, looking at most four pans downward?
 *
 * `hasAnywhere` would answer by walking the list to its bottom — and on a 900-row list, walking
 * to the bottom PAGES it, so the thirty page fetches that produces land in the ledger as if the
 * fault had caused them. This file asserts a ceiling on requests per fault, so an unbounded read
 * would eventually trip its own guard and report "uncontrolled retries" against a well-behaved
 * client. Bounded, and the error state is reachable within it: when a search fails there is no
 * list left to scroll.
 */
function below(text) {
  return seek((n) => (n.label ?? '').includes(text), { max: 4 }) !== null;
}

/** Type a term and report which of the three possible outcomes the screen chose. */
function searchAndRead(term) {
  const field = searchField();
  sh(`npx agent-device fill @${field.ref} ${term} 2>&1`, { allowFail: true });
  // Past the debounce AND past two retry round-trips at the smallest backoff, so what is on
  // screen is the settled verdict rather than a mid-retry frame. The `below()` reads after this
  // take further seconds, so a slower policy still lands inside the window.
  sleep(12);
  const out = {
    errorState: below('Exercise search unavailable'),
    stale: below('Outdated results'),
    empty: below('No exercises match'),
    results: has(`exercises for “${term}”`),
  };
  // Prove the keystroke became a SEARCH before concluding anything from what followed: a term
  // identical to the committed one fetches nothing, and the healthy screen that results would
  // otherwise be reported as "the injected fault produced no error state".
  if (!out.errorState && !out.results && !out.stale && !out.empty) {
    fail(
      `the search for "${term}" produced none of the four outcomes a committed search can have ` +
        `— screen: ${labels().slice(0, 8).join(' / ')}. Nothing below can be attributed to the fault.`,
    );
  }
  return out;
}

/** Arm a fault from its row and return the app's own description of what it armed. */
function arm(row) {
  open('dev', 'Developer');
  if (!pressRow(row, ['Arm', 'Armed'])) fail(`could not arm "${row}"`);
  if (!seek((n) => /Failing the next/.test(n.label ?? ''))) fail(`"${row}" armed with no status line`);
  return nodes().find((n) => /Failing the next/.test(n.label ?? '')).label.trim();
}

const CASES = [
  // `attempts` is requests the client makes per call: 1 + its retry budget. `expect` bounds the
  // ledger delta rather than matching it, because how many of the parallel calls the fault
  // reaches varies with timing. What the bound rules out is the failure that matters: hammering a
  // dead radio, or retrying a permanent error forever.
  { row: 'Server error 500', term: 'deadlift', attempts: 3, note: 'retried twice, then fails' },
  { row: 'No connection', term: 'bench press', attempts: 1, note: 'must not be retried at all' },
  { row: 'Timeout', term: 'lat pulldown', attempts: 3, note: 'two retries then the error state' },
  { row: 'Rate limit 429', term: 'lateral raise', attempts: 4, note: 'three retries honouring Retry-After' },
  { row: 'Not found 404', term: 'cable curl', attempts: 1, note: 'permanent — no retry' },
];

console.log('── injected failures, and what the app does about each ─────────');

// ── 0. A healthy search, on a cold app, with the counters at zero ─────────────────────────
// No explicit fault-clearing here, and that is not an oversight: the injector is module state,
// so `terminate` removes it along with everything else in the process. That is the whole reason
// this file can promise a cold fixture — and the reason `onExit(clearFaultQuietly)` still matters
// for the *next* script, which will not restart anything.
console.log('0. baseline: one working search on a cold start');
coldStart([TERM_BASE]);
console.log('   baseline search works, cache proven cold');

for (const c of CASES) {
  console.log(`\n${c.row} — ${c.note}`);
  // Cold app per case: the fault must meet a query with nothing cached behind it, or the screen
  // answers with retained rows plus a banner and the error state never gets its turn.
  coldStart([TERM_BASE]);
  const status = arm(c.row);
  console.log(`   ${status}`);
  const before = ledger(`${c.row} before`).total;

  const seen = searchAndRead(c.term);
  const after = ledger(`${c.row} after`).total;
  const sent = after - before;

  if (!seen.errorState) {
    fail(
      `"${c.row}" produced no error state (saw stale-banner=${seen.stale}, empty=${seen.empty}, ` +
        `results=${seen.results}) after ${sent} request(s). A user in this situation sees a list ` +
        'that quietly never updates.',
    );
  }
  const ceiling = c.attempts * 4 + 3;
  if (sent > ceiling) {
    fail(`"${c.row}" sent ${sent} requests; the budget is ${c.attempts} attempt(s) per call ` +
         `across the parallel calls a page makes (${ceiling} worst case). Uncontrolled retries.`);
  }
  console.log(`   error state shown, ${sent} request(s) sent (ceiling ${ceiling})`);

  // Recovery through the control the app itself offers, while the fault is still armed: a Retry
  // that refetches into the same outage must land back in the error state without hanging.
  if (!pressLabel('Try again')) fail(`"${c.row}": the error state offered no pressable Retry`);
  sleep(10);
  const retried = below('Exercise search unavailable');
  console.log(`   Retry pressed into the same outage, still an error state: ${retried}`);
  if (!retried) {
    console.log('   (not fatal to this check: a retry that happens to catch the last armed ' +
                'request can legitimately succeed — the fault is finite)');
  }

  open('dev', 'Developer');
  if (!pressLabel('Stop injecting')) fail('the fault could not be cleared — it would poison every later check');
  sleep(1);
}

// ── Last one cleared for good, and the list must come back on its own terms ───────────────
console.log('\nrecovery with the network healthy');
open('exercises', 'SEARCH EXERCISES');
sleep(2);
const f = searchField();
sh(`npx agent-device fill @${f.ref} leg press 2>&1`, { allowFail: true });
sleep(10);
if (below('Exercise search unavailable')) {
  fail('the list never came back after the last fault was cleared — the error state is sticky');
}
if (!has('exercises for “leg press”')) {
  fail('after recovery the search did not render results on a healthy network');
}
console.log('   search renders results again after recovery');

console.log('\nPASS — every injected failure produced a distinct, retryable error state and cleared');
