#!/usr/bin/env tsx
/**
 * Does the exercise search actually debounce?
 *
 * Why this runs in node rather than on the simulator. The device probe typed a 7-character
 * word with `--delay-ms 20` and saw six requests, which looks exactly like a broken
 * debounce. But it is not evidence: iOS character delivery through the automation layer has
 * its own pace, and `--delay-ms` is a floor, not a metronome. If the characters arrive more
 * than 220 ms apart, one commit per character is the debounce WORKING. The two hypotheses —
 * "the debounce is broken" and "the automator types slower than the debounce window" —
 * produce identical ledgers on a device and cannot be separated there.
 *
 * They can be separated here, because exerciseFilters.ts imports nothing platform-specific:
 * keystrokes can be delivered on a schedule this file controls, to the microsecond.
 *
 * What must be true, straight from the module's own contract:
 *   - keystrokes inside the window collapse to ONE commit, carrying the final text;
 *   - a chip or sheet selection commits immediately (a tap that waits 220 ms reads as lag);
 *   - "Clear filters" cancels a commit that was already scheduled;
 *   - the draft runs ahead of the committed filter, which is what lets the input honestly
 *     say "Searching…" instead of pretending the results are current.
 *
 * Usage: npm run check:debounce
 */
import {
  getExerciseFilterState,
  resetExerciseFilter,
  setExerciseEquipmentId,
  setExerciseMuscleId,
  setExerciseQuery,
} from '../src/queries/exerciseFilters';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/**
 * Records each query as it commits, so "how many requests would this cause" is a count.
 *
 * Polls rather than subscribes: `subscribe` is deliberately not exported (the only caller
 * is the hook), and exporting it for a script would widen a module's public surface for no
 * product reason. Reading the same accessor the hook reads observes exactly the same
 * transitions.
 */
function watchCommits(): { queries: string[]; stop: () => void } {
  const queries: string[] = [];
  let seen = getExerciseFilterState().filter.query;
  const id = setInterval(() => {
    const next = getExerciseFilterState().filter.query;
    if (next !== seen) {
      seen = next;
      queries.push(next);
    }
  }, 1);
  return { queries, stop: () => clearInterval(id) };
}

async function main(): Promise<void> {
  const WORD = 'lateral raise';

  console.log('\n— keystrokes inside the window must collapse to one commit —');
  resetExerciseFilter();
  let w = watchCommits();
  // 30 ms apart: a third of the 220 ms window, i.e. continuous typing by any standard.
  for (let i = 1; i <= WORD.length; i += 1) {
    setExerciseQuery(WORD.slice(0, i));
    await sleep(30);
  }
  // The draft must be ahead immediately — the input shows this, not the committed value.
  check(
    'draft runs ahead of the committed filter while typing',
    getExerciseFilterState().draft === WORD && getExerciseFilterState().filter.query === '',
    `draft="${getExerciseFilterState().draft}" committed="${getExerciseFilterState().filter.query}"`,
  );
  await sleep(400); // past the window, once
  check(
    `continuous typing of "${WORD}" (${WORD.length} chars) committed once`,
    w.queries.length === 1,
    `committed ${w.queries.length} times: ${JSON.stringify(w.queries)}`,
  );
  check(
    'the one commit carries the whole word, not a prefix',
    w.queries[0] === WORD,
    `committed ${JSON.stringify(w.queries[0])}`,
  );
  w.stop();

  console.log('\n— typing slower than the window commits per pause (correct, not a bug) —');
  resetExerciseFilter();
  w = watchCommits();
  for (const part of ['lat', 'eral', ' raise']) {
    setExerciseQuery(getExerciseFilterState().draft + part);
    await sleep(400); // longer than the window: each pause is a settled search
  }
  check('three settled pauses produce three commits', w.queries.length === 3, `got ${w.queries.length}`);
  w.stop();

  console.log('\n— a tap must not wait for the debounce —');
  resetExerciseFilter();
  w = watchCommits();
  setExerciseMuscleId(7);
  check(
    'muscle chip commits synchronously',
    getExerciseFilterState().filter.muscleId === 7 && w.queries.length === 0,
    `muscleId=${getExerciseFilterState().filter.muscleId}`,
  );
  setExerciseEquipmentId(3);
  check('equipment chip commits synchronously', getExerciseFilterState().filter.equipmentId === 3);
  w.stop();

  console.log('\n— clearing must cancel a commit that was already scheduled —');
  resetExerciseFilter();
  w = watchCommits();
  setExerciseQuery('deadlift');
  await sleep(60); // inside the window: a commit is pending
  resetExerciseFilter();
  await sleep(400);
  check(
    'reset cancels the pending commit',
    w.queries.length === 0,
    `committed after reset: ${JSON.stringify(w.queries)}`,
  );
  check(
    'reset leaves both draft and filter empty',
    getExerciseFilterState().draft === '' && getExerciseFilterState().filter.query === '',
  );
  w.stop();

  console.log('\n— a word typed then cleared inside the window must never reach the network —');
  resetExerciseFilter();
  w = watchCommits();
  for (const ch of 'squat') {
    setExerciseQuery(getExerciseFilterState().draft + ch);
    await sleep(30);
  }
  setExerciseQuery('');
  await sleep(400);
  check(
    'a typed-then-erased term commits nothing',
    w.queries.length === 0,
    `committed: ${JSON.stringify(w.queries)}`,
  );
  w.stop();

  const total = passed + failed;
  console.log(`\n${failed === 0 ? 'all' : `${failed} of`} ${total} assertions passed`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
