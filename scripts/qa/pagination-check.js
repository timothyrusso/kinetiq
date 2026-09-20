#!/usr/bin/env node
// Offset pagination must not show the same exercise twice.
//
// The brief names this specifically: "Pagination must not create duplicated exercises."
// wger pages by offset over a set we do not control, and the provider orders by id ascending,
// so a row can legitimately appear on two pages if the server's window shifts between calls.
// `dedupe` in src/queries/useExercises.ts folds pages through one id-keyed pass at READ time,
// which is the fix; this proves it on the device rather than in a unit test that assumes the
// list renders what the query returned.
//
// How duplicates are detected, and why not by accumulating labels across the whole scroll:
// panning down and back up legitimately shows the same exercise twice, so "saw it twice"
// proves nothing. A real duplicate is the same row present TWICE IN ONE SNAPSHOT — two nodes
// on screen at the same moment with the same title. FlashList only mounts what is near the
// viewport, so that reading is both cheap and specific.
//
// Prerequisite: paging must actually happen, or "no duplicates" is vacuous. The ledger says
// how many pages were fetched; one page means the scroll never reached the end of page 1 and
// the check would pass by doing nothing. That is the failure mode this file exists to avoid:
// a green run that measured nothing.
const { sh, sleep, nodes, visible, labels, open, fail, ledger, panDown, scan } = require('./lib');

console.log('1. Cold-ish start on the exercise list.');
open('exercises', 'Search the wger catalog');
// A committed search from an earlier run is still in the store (module state, and a warm JS
// context keeps it), narrowing the list until it fits on one page — which would leave the
// paging step below unable to page, and the check passing by doing nothing. The screen has a
// Clear button for exactly this; press it when it is there. Navigating away and back would NOT
// clear it, which is correct for a user and a trap for a script.
// Keyed on the hero's own subtitle — `${total} exercises for “term”` (app/(tabs)/exercises.tsx)
// — rather than on the word "Clear", which could match a chip or a keyboard action and press
// the wrong thing.
// Keyed on the hero's own subtitle — `${total} exercises for “term”` (app/(tabs)/exercises.tsx)
// — rather than on the word "Clear", which could match a chip or a keyboard action and press
// the wrong thing. A viewport read, NOT scan(): scan() scrolls the list to its bottom to read
// labels, which would page it here and then leave step 3 standing at the end of the list with
// nothing left to page — the vacuous-pass guard firing on a defect in this file.
if (has('exercises for “')) {
  console.log('   a search is committed — clearing so the list is long enough to page');
  pressLabel('Clear');
  sleep(4);
}
scrollTop();
sleep(2);

const beforePages = ledger('before scrolling').total;

// ── 2. Scroll to the bottom, checking every stop for a simultaneous duplicate ─────────────
console.log('2. scrolling the list, watching for a row that appears twice at once');

/** Titles of the mounted exercise rows: Buttons whose label is a name plus a subtitle line. */
function rowTitles() {
  return nodes()
    .filter((n) => n.type === 'Button' && visible(n) && n.rect.height > 30)
    .map((n) => (n.label ?? '').split('\n')[0].trim())
    .filter((t) => t.length > 1);
}

const dupes = [];
let stops = 0;
let lastTop = null;
for (let i = 0; i < 40; i += 1) {
  const titles = rowTitles();
  const seen = new Set();
  for (const t of titles) {
    if (seen.has(t) && !dupes.includes(t)) dupes.push(t);
    seen.add(t);
  }
  // Stop when the top row stops moving: the list is at its end, so another pan is noise.
  const top = titles[0] ?? null;
  if (top === lastTop) break;
  lastTop = top;
  stops += 1;
  panDown();
}
sleep(2);

const afterPages = ledger('after scrolling').total;
const fetched = afterPages - beforePages;
console.log(`   panned ${stops} times, ${fetched} request(s) fired while paging`);
if (dupes.length) {
  fail(`the same exercise is on screen twice at once: ${dupes.slice(0, 3).join(' | ')} — ` +
       'the id-keyed dedupe at the read boundary is not holding');
}
// The vacuous-pass guard. One request means we never crossed a page boundary, so no duplicate
// COULD have been observed and the result above means nothing.
if (fetched < 2) {
  fail(`only ${fetched} request(s) fired across ${stops} pans — the list never paged, so ` +
       '"no duplicates" was never actually tested. Scrolling may not be reaching the list.');
}

console.log('\nPASS — multiple pages rendered with no row appearing twice');
void sh;
void labels;
