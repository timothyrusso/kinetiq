#!/usr/bin/env node
// Kill the network. Then try to work out.
//
// The brief's headline offline claim: "Saved workout routines must remain completely
// usable when the external API is unavailable… The user must never lose a saved routine
// because remote exercise data becomes unavailable."
//
// That claim is easy to fake. The list could render from a TanStack Query cache left warm
// by the last visit and look fine right up to the moment you tap something. So the test is
// not "does a cached list still show". It is the user's whole path with the radio dead:
// open a routine, read the sets they configured, and start a session from it. If any of
// that reaches the network, one lost flight is enough to break a workout plan.
//
// Traps:
//   • The fault has to be proven live before it can prove anything. Step 3 does that by
//     showing Exercises reporting the outage rather than rendering normally — so a passing
//     routine flow can't be the online case wearing a disguise.
//   • The fault rows on the dev screen are custom cards: the title is plain text and the
//     control is a button labelled just `Arm`, so nothing names the row. pressRow() matches
//     them by geometry (lib.js).
//   • Faults live in memory only, so this clears what it armed even when it fails. A fault
//     left armed silently poisons every later run, which reads as a broken app.

const {
  fillField, CWD, sh, sleep, scan, has, open, fail, pressLabel, pressRow, ledger, nodes, visible, scrollTop, hasAnywhere, labels, seek, onExit, clearFaultQuietly, faultArmed,
} = require('./lib');

process.chdir(CWD);
// Undo the fault on every exit path. A fault lives in the app's memory, so a script that dies
// with one armed leaves the NEXT script measuring a broken network while believing it armed
// nothing — the failure then shows up somewhere unrelated and looks like an app bug.
onExit(clearFaultQuietly);


/**
 * The saved routines, as the Workout tab prints them: `Push — Heavy. 5 exercises · 9× done ·
 * 2d ago`, one Button per row (app/(tabs)/workout.tsx:243). Taken by node shape rather than
 * by guessed titles, so this keeps working when the seed data changes and cannot pick up a
 * card from `Last trained` or the library promo.
 *
 * `wholeScreen` is the scan union rather than the current viewport, because with more
 * routines than fit on screen the list scrolls, and a check that counted only the visible
 * rows would report the unmounted ones as lost — which is exactly the failure this script
 * claims to detect, and would be a false positive invented by the harness.
 */
function routineRows(wholeScreen) {
  return wholeScreen.split(/\s{2,}/).filter((l) => /^\D.+\d+ exercises? ·/.test(l));
}

console.log('── saved routines with the network cut ────────────────────────');

// ── 1. Online: name the routines we intend to still have later ─────────────
console.log('1. routines while online');
// Zero the ledger first. Every count in this file is a claim about a specific action, and a
// cumulative number since launch cannot support any of them.
open('dev', 'Developer');
if (seek((n) => (n.label ?? '').trim() === 'Reset')) {
  const r = nodes().find((n) => (n.label ?? '').trim() === 'Reset');
  sh(`npx agent-device press '@${r.ref}' 2>&1`, { allowFail: true });
  sleep(1);
}
if (ledger('baseline').total !== 0) {
  fail('the ledger Reset did not take — no count below is attributable to a single action');
}
open('workout', 'New routine');
sleep(2);
const before = routineRows(scan().text);
if (before.length === 0) fail('no saved routines on the Workout tab — re-seed from kinetiq://dev first');
console.log(`   ${before.length} listed: ${before.map((r) => r.split('.')[0]).join(' | ')}`);
// Prefer a routine with NO session attached to it. The seed leaves one paused, and the app
// correctly refuses to start a second run of a routine already in progress — "'Push — Heavy'
// is already in progress. Finish or discard it before starting another." Picking that one made
// step 5 read a correct refusal as "the session never started". The Resume card names the
// routine in progress, so the list of rows minus that name is the set that can be started.
const inProgress = scan()
  .text.match(/([^|]+?) in progress\./)?.[1]
  ?.trim()
  .split('  ')
  .pop()
  ?.trim();
const startable = before.filter((r) => !inProgress || !r.startsWith(inProgress));
if (startable.length === 0) {
  fail(`every saved routine is mid-session (${inProgress ?? '?'}), so none can be started offline`);
}
const target = startable[0];
const name = target.split('.')[0].trim();
if (inProgress) console.log(`   "${inProgress}" is mid-session; starting "${name}" instead`);

// ── 2. Mount the exercise screen FIRST, then arm ───────────────────────────
// The offline fault has exactly one shot: offline is a permanent failure, so the client does
// not retry it (RETRY_BUDGET in src/query/client.ts), and arming sends budget+1 = 1. Whatever
// request reaches the transport first eats it. Opening Exercises cold fires the provider's
// status probe before any search does, so arming first spent the single failure on a probe and
// let the search through — which this script then reported as "injection is not wired up" for
// the third time running. Mount and settle the screen that will be measured, then arm.
console.log('2. settle the exercise screen, then arm "No connection"');
open('exercises', 'Exercise');
sleep(6);
open('dev', 'Developer');
if (!pressRow('No connection', ['Arm', 'Armed'])) fail('could not arm the offline fault');
// faultSummary() answers with e.g. `Failing the next 3 requests with "offline".` (src/api/devFaults.ts:81)
if (!hasAnywhere('Failing the next')) fail('arming reported no confirmation — the rest of this run would be meaningless');
console.log('   armed');

// ── 3. Prove the fault is live ─────────────────────────────────────────────
// Without this, steps 4-6 would only prove that nothing happened. The offline fault gets ONE
// shot — offline is not retried, so arming sends RETRY_BUDGET.offline+1 = 1 — which means
// whichever request reaches the transport first spends it. Three guesses at which one that is
// has already cost three red runs, so this step stops guessing: it arms, searches, and if the
// search came back fine it re-arms with a brand-new term and tries again, then reports what it
// actually saw. What it cannot do is pass silently.
console.log('3. prove the radio is actually dead');
const attempts = [];
let cut = false;
for (let attempt = 1; attempt <= 3 && !cut; attempt++) {
  const probe = `zzz${Math.floor(Math.random() * 90000 + 10000)}`;
  open('dev', 'Developer');
  if (!pressRow('No connection', ['Arm', 'Armed'])) fail('could not re-arm the offline fault');
  if (!hasAnywhere('Failing the next')) {
    fail('arming reported success but the dev screen does not show an armed fault');
  }
  open('exercises', 'Exercise');
  scrollTop();
  const field = nodes().find((n) => n.type === 'TextField' && visible(n));
  if (!field) fail('no visible search field to type into');
  fillField(field.ref, probe);
  sleep(7);
  const typed = (nodes().find((n) => n.type === 'TextField' && visible(n)) ?? {}).value;
  if (typed !== probe) {
    fail(`search field reads "${typed}" not "${probe}" — the keystroke, not the network, failed`);
  }
  // hasAnywhere, not a viewport read: the error state replaces the LIST, whose heading sits
  // under the pinned "Exercises" header, and this run has panned the list around. A
  // viewport-only check here read "y=154..760: nothing" while the error copy sat at y=1100 —
  // mounted, off-screen, and on the screen the user was looking at.
  cut = hasAnywhere('Exercise search unavailable') || hasAnywhere('Try again');
  if (!cut) {
    // Name what the screen actually said. "It worked" is not a diagnosis, and every wrong guess
    // at this step so far has been a guess about which request ate the fault.
    const l = ledger(`failed attempt ${attempt}`);
    // `rows`, not a `by` map that does not exist — reading it produced `undefined` in the
    // middle of a failure message, which is the worst time to discover a typo.
    const hits = l.rows.filter(([path]) => path.includes('exercise')).map(([p, c]) => `${p}x${c}`).join(',');
    attempts.push(
      `[${probe}] ${l.total} req${hits ? ` (${hits})` : ''} → "${labels().slice(0, 8).join(' / ')}"`,
    );
  }
}
if (!cut) {
  fail(
    `three forced searches succeeded with the fault armed (${attempts.join('; ')}) — either ` +
      'injection is not wired into the transport, in which case every green result after this ' +
      'is a lie, or the one-shot fault is spent by a request the harness cannot order. Either ' +
      'way the offline claim below is unproven.',
  );
}
console.log('   search failed as it must');

// ── 4. The claim: the routines are all still there, and still openable ─────
console.log('4. routines while offline');
open('workout', 'New routine');
sleep(2);
const during = routineRows(scan().text);
const lost = before.filter((r) => !during.includes(r));
if (lost.length) fail(`routine(s) vanished with no network: ${lost.map((r) => r.split('.')[0]).join(', ')}`);
console.log(`   all ${before.length} still listed`);

// The row, not anything that merely starts with the name. A paused session puts a Resume card
// above the list labelled "<name> in progress. 5 of 18 sets done. Resume.", and a prefix match
// on the bare name hits THAT first — which resumed the workout and left this check reading the
// session screen, then reporting that the routine detail "does not show its exercise rows".
// The list row's label is "<name>. <subtitle>", so the period is what distinguishes them.
if (!pressLabel(`text^="${name}. "`)) fail(`could not open "${name}" offline`);
sleep(3);
// The sets the user configured can be below the fold on a five-exercise routine, so this
// reads the whole screen — a viewport-only read would report a healthy routine as broken.
const detail = scan().text;
// What "survived the outage" has to mean here, stated as the app's own arithmetic rather than
// as a string I happened to notice: this screen lists the exercises the user chose AND a
// estimated volume that is Σ sets×reps×weight over those rows. A screen that can still produce
// 690 kg still holds every set, rep and weight locally. Requiring a literal "3×8" instead
// asked a summary screen to render a per-row format it never uses, and reported a perfectly
// intact routine as corrupted.
const listed = (detail.match(/\b\d+\s+ROWS\b/) ?? [])[0];
if (!listed) fail(`offline detail for "${name}" does not show its exercise rows at all:\n   ${detail.slice(0, 500)}`);
if (!/\d[\d,\.]*\s*(kg|lb)/.test(detail)) {
  fail(`offline detail for "${name}" shows no computed volume, so the sets/reps/weight are not ` +
       `demonstrably intact:\n   ${detail.slice(0, 500)}`);
}
const exerciseNames = ['Bench', 'Squat', 'Deadlift', 'Press', 'Row', 'Raise', 'Curl', 'Pushdown'];
const named = exerciseNames.filter((e) => detail.includes(e));
if (named.length === 0) {
  fail(`offline detail for "${name}" lists rows but names none of them:\n   ${detail.slice(0, 500)}`);
}
if (!detail.includes('Start this workout')) fail(`offline detail for "${name}" has no way to start the session:\n   ${detail.slice(0, 400)}`);
console.log(`   "${name}" opens offline: ${listed}, volume and ${named.length} exercise names intact`);

// ── 5. Start a session from it, offline ────────────────────────────────────
console.log('5. start the workout offline');
// Clear any session first. The app allows exactly ONE workout at a time and says so — "'Push —
// Heavy' is already in progress. Finish or discard it before starting another." — and that
// refusal applies to every routine, not just the one mid-session (verified on device). The seed
// leaves a paused session, so without this the step can never start anything, and a correct
// refusal reads as "the session never started".
if (inProgress) {
  console.log(`   discarding the seeded "${inProgress}" session so a new one can start`);
  open('workout/session', undefined, { soft: true });
  sleep(3);
  if (pressLabel('Discard')) {
    sleep(2);
    if (!pressLabel('Discard workout')) fail('the discard confirmation never offered its confirm button');
    sleep(4);
  }
  if (scan().text.includes('in progress.')) {
    fail(`could not clear the "${inProgress}" session, so no workout can be started offline`);
  }
}
if (!pressLabel('Start this workout')) fail('"Start this workout" offline was not pressable');
sleep(5);
const session = scan().text;
if (/Start this workout/.test(session)) fail('tapping "Start this workout" offline left us on the routine — the session never started');
if (!/Rest|REST|Set 1|SET 1/.test(session)) fail(`no live session offline for "${name}":\n   ${session.slice(0, 500)}`);
console.log('   session running offline: sets, rest and progress all present');

// ── 6. Reconnect: the outage has to clear itself, not linger ───────────────
console.log('6. clear the fault');
open('dev', 'Developer');
if (!pressLabel('Stop injecting')) fail('the armed fault could not be cleared — leaving it armed would poison every later run');
sleep(1);
// Recovery here is not automatic, and that is a decision rather than a gap: onlineManager is
// wired but nothing invalidates on reconnect (src/query/client.ts), so a query that errored
// stays errored until the user pulls to refresh or presses Retry. The screen says so out loud
// — "Pick up where you left off with pull-to-refresh or Retry" — and an automatic refetch
// would fight that promise and fire a fleet of requests the instant a signal returned.
// So: the error surviving is the EXPECTED result, and the thing worth asserting is that the
// Retry the screen offers actually works. A dead Retry button is the real defect here, and it
// is exactly the one a user meets after a tunnel.
open('exercises', 'Exercise');
sleep(3);
const errored = hasAnywhere('Exercise search unavailable') || hasAnywhere('Try again');
if (!errored) {
  console.log('   error state already cleared (the query went stale on its own) — nothing to retry');
} else {
  console.log('   error persists after reconnect, as designed — pressing the offered Retry');
  if (!pressLabel('Try again')) fail('the offline screen offered Retry but no such control was pressable');
  sleep(8);
  const back = scan().text;
  const stillStuck = hasAnywhere('Exercise search unavailable');
  if (stillStuck) fail('Retry after reconnect left the screen in the same error state — the button is inert');
  console.log('   Retry recovered the list after reconnect');
}

// ── 7. What it cost ────────────────────────────────────────────────────────
open('dev', 'Developer');
const after = ledger('since launch:');
// Deliberately reported, not asserted: this ledger is cumulative since launch and cannot
// attribute a flight to the offline window versus the online one. What the offline half is
// *proved* by is the flow above succeeding with a fault armed — a routine that needed the
// network would have hit the fault and failed. These numbers are here so a regression that
// makes offline use chatty is visible, and so `retry a dead radio` shows up as a growing
// catalog count rather than as someone noticing a week later.
const catalog = after.rows.filter(([p]) => /exerciseinfo|exercisecategory|muscle|equipment/.test(p));
console.log(`   catalog paths since launch: ${catalog.length ? catalog.map(([p, c]) => `${p} ×${c}`).join('   ') : '(none)'}`);

// Everything above is a hard stop, so reaching here is the verdict.
console.log('\nPASS — saved routines, their sets, and a live session all survived a dead network');
