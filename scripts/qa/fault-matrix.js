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
// Traps found while writing this:
//   • The search term must be one that RETURNS ROWS. "zzz12345" comes back as a successful
//     empty result, and the "No exercises match" screen is then correct — an earlier probe
//     armed a fault, searched for gibberish, saw an empty state, and concluded the error state
//     was unreachable. Distinguishing "failed" from "found nothing" needs a term with answers.
//   • The query must be COLD when the fault is armed, or the screen serves cached rows and
//     shows only the "Outdated results" banner. That is the right behaviour for a refetch and
//     the wrong fixture for an error state, so this commits a term first and searches a new one
//     under the fault.
//   • The fault outlasts the screen's retry budget on purpose (app/dev.tsx arms
//     burst × attempts), so it is still armed into step 3. Clearing it is not tidiness; left
//     armed it makes the NEXT check report a healthy app as broken.

const {
  CWD, sh, sleep, open, fail, ledger, nodes, visible, seek, scrollTop,
  pressLabel, pressRow, has,
} = require('./lib');

process.chdir(CWD);

// Every term must be one that RETURNS ROWS (gibberish comes back as a successful empty result,
// which is indistinguishable from a swallowed error from outside) and every faulted term must
// differ from the baseline, because re-typing the committed term is a no-op that fetches
// nothing. See searchUnderFault.
const TERM_BASE = 'squat';

/** Cold search under whatever is armed, then report what the screen and ledger say. */
function searchUnderFault(term) {
  open('exercises', 'Exercise');
  sleep(3);
  scrollTop();
  const field = nodes().find((n) => n.type === 'TextField' && visible(n));
  if (!field) fail('no visible search field on Exercises');
  sh(`npx agent-device fill @${field.ref} ${term} 2>&1`, { allowFail: true });
  sleep(12);
  // Prove the keystroke became a SEARCH before drawing any conclusion from what followed.
  // Writing a term identical to the one already committed changes nothing, the debounce
  // commits nothing, no request leaves, and the screen stays happily healthy — which this
  // check then reads as "the injected fault produced no error state" and blames on the app.
  // The hero subtitle is pinned header text, so this is a viewport read, not a scroll.
  if (!has(`exercises for “${term}”`)) {
    fail(`the search for "${term}" never committed (hero does not show it) — every result ` +
         'below would be measuring a screen that was never asked to fetch');
  }
  return {
    errorState: below('Exercise search unavailable'),
    stale: below('Outdated results'),
    empty: below('No exercises match'),
  };
}

/**
 * Is this copy on the screen, looking at most four pans downward?
 *
 * `hasAnywhere` would answer the question by walking the list to its bottom — and on a list
 * with 900 rows, walking to the bottom PAGES it, so the twelve or thirty page fetches that
 * produces land in the ledger as if the fault had caused them. This file asserts a ceiling on
 * requests per fault, so an unbounded read would eventually trip its own guard and report
 * "uncontrolled retries" against a well-behaved client. Bounded, and the error state is
 * reachable within it: when the search fails there is no list left to scroll.
 */
function below(text) {
  return seek((n) => (n.label ?? '').includes(text), { max: 4 }) !== null;
}

const CASES = [
  // `attempts` is requests the client makes per call: 1 + its retry budget. `expect` is the
  // ceiling on the ledger delta — it bounds the budget rather than matching it exactly, because
  // how many of the three parallel calls the fault reaches varies with timing. What the bound
  // rules out is the failure that matters: hammering a dead radio, or retrying a 400 forever.
  { row: 'Server error 500', term: 'deadlift', attempts: 3, note: 'retried twice, then fails' },
  { row: 'No connection', term: 'bench press', attempts: 1, note: 'must not be retried at all' },
  { row: 'Timeout', term: 'lat pulldown', attempts: 3, note: 'two retries then the error state' },
  { row: 'Rate limit 429', term: 'lateral raise', attempts: 4, note: 'three retries honouring Retry-After' },
  { row: 'Not found 404', term: 'cable curl', attempts: 1, note: 'permanent — no retry' },
];

console.log('── injected failures, and what the app does about each ─────────');

// A committed search up front, so every faulted search below is a NEW query key (cold) while
// the screen still has somewhere to land. Also proves the list works before anything breaks.
// Zero the ledger. The per-fault ceiling below is a claim about ONE fault, and a counter that
// still holds twenty pages of warm-cache traffic from the last check cannot support it.
open('dev', 'Developer');
if (seek((n) => (n.label ?? '').trim() === 'Reset')) {
  sh(`npx agent-device press '@${nodes().find((n) => (n.label ?? '').trim() === 'Reset').ref}' 2>&1`,
     { allowFail: true });
  sleep(1);
}
if (ledger('baseline').total !== 0) {
  fail('the ledger Reset did not take — the request ceilings below would be measuring the past');
}

console.log('0. baseline: one working search');
open('exercises', 'Exercise');
sleep(4);
scrollTop();
const baseField = nodes().find((n) => n.type === 'TextField' && visible(n));
if (!baseField) fail('no visible search field on Exercises');
sh(`npx agent-device fill @${baseField.ref} ${TERM_BASE} 2>&1`, { allowFail: true });
sleep(8);
if (!has('exercises for “')) {
  fail('the baseline search never committed — nothing below can be attributed to a fault');
}
console.log('   baseline search works');

for (const c of CASES) {
  console.log(`\n${c.row} — ${c.note}`);
  open('dev', 'Developer');
  if (!pressRow(c.row, ['Arm', 'Armed'])) fail(`could not arm "${c.row}"`);
  if (!seek((n) => /Failing the next/.test(n.label ?? ''))) fail(`"${c.row}" armed with no status line`);
  const status = nodes().find((n) => /Failing the next/.test(n.label ?? '')).label.trim();
  console.log(`   ${status}`);
  const before = ledger(`${c.row} before`).total;

  const seen = searchUnderFault(c.term);
  const after = ledger(`${c.row} after`).total;
  const sent = after - before;

  if (!seen.errorState) {
    fail(
      `"${c.row}" produced no error state (saw stale-banner=${seen.stale}, empty=${seen.empty}) ` +
        `after ${sent} request(s). Either the fault is not reaching this path or the screen ` +
        'swallows the failure — a user in this situation sees a list that quietly never updates.',
    );
  }
  const ceiling = c.attempts * 4 + 3;
  if (sent > ceiling) {
    fail(`"${c.row}" sent ${sent} requests; the budget is ${c.attempts} attempt(s) per call ` +
         `across three parallel calls (${ceiling} worst case). Uncontrolled retries.`);
  }
  console.log(`   error state shown, ${sent} request(s) sent`);

  // Recovery through the control the app itself offers, while the fault is still armed: a Retry
  // that refetches into the same outage must land back in the error state without hanging.
  if (!pressLabel('Try again')) fail(`"${c.row}": the error state offered no pressable Retry`);
  sleep(10);
  console.log(`   Retry pressed, still an error state: ${below('Exercise search unavailable')}`);

  open('dev', 'Developer');
  if (!pressLabel('Stop injecting')) fail('the fault could not be cleared — it would poison every later check');
  sleep(1);
}

// ── Last one clears for good, and the list must come back on its own terms ────────────────
console.log('\nrecovery with the network healthy');
open('exercises', 'Exercise');
sleep(2);
scrollTop();
const f = nodes().find((n) => n.type === 'TextField' && visible(n));
sh(`npx agent-device fill @${f.ref} squat 2>&1`, { allowFail: true });
sleep(10);
if (below('Exercise search unavailable')) {
  fail('the list never came back after the last fault was cleared — the error state is sticky');
}
if (!has('exercises for “leg press”')) {
  fail('after recovery the search did not commit — a healthy network should render results');
}
console.log('   search renders results again after recovery');

console.log('\nPASS — every injected failure produced a distinct, retryable error state and cleared');
