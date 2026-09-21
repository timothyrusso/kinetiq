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
// proves nothing. A real duplicate is the same row present TWICE IN ONE SNAPSHOT: two nodes
// on screen at the same moment with the same title. FlashList only mounts what is near the
// viewport, so that reading is both cheap and specific.
//
// Prerequisite: paging must actually happen, or "no duplicates" is vacuous. The ledger says
// how many pages were fetched; one page means the scroll never reached the end of page 1 and
// the check would pass by doing nothing. That is the failure mode this file exists to avoid:
// a green run that measured nothing.
const {
  sh, sleep, nodes, visible, open, fail, ledger, panDown, scan,
  has, pressLabel, scrollTop, seek,
} = require('./lib');

console.log('1. Cold-ish start on the exercise list.');
open('exercises', 'Exercise');
// A committed search from an earlier run is still in the store (module state, and a warm JS
// context keeps it), narrowing the list until it fits on one page: which would leave the
// paging step below unable to page, and the check passing by doing nothing. The screen has a
// Clear button for exactly this; press it when it is there. Navigating away and back would NOT
// clear it, which is correct for a user and a trap for a script.
// Keyed on the hero's own subtitle, `${total} exercises for “term”` (app/(tabs)/exercises.tsx)
//: rather than on the word "Clear", which could match a chip or a keyboard action and press
// the wrong thing.
// Keyed on the hero's own subtitle, `${total} exercises for “term”` (app/(tabs)/exercises.tsx)
//: rather than on the word "Clear", which could match a chip or a keyboard action and press
// the wrong thing. A viewport read, NOT scan(): scan() scrolls the list to its bottom to read
// labels, which would page it here and then leave step 3 standing at the end of the list with
// nothing left to page: the vacuous-pass guard firing on a defect in this file.
// Match on ` for “`, not `exercises for “`: the hero pluralises, so a term with a single hit
// renders "1 exercise for “chest192”" and the plural pattern misses it entirely. That is
// exactly the state a previous gate leaves behind: qa:network commits a deliberately
// obscure term: and with one row on screen there is nothing to scroll and nothing to page,
// so this check's own vacuous-pass guard fires and blames the app.
//
// The clear control is labelled `Clear <field label>` ("Clear Search exercises"), so it needs
// a prefix match; `pressLabel('Clear')` compares exactly and never found it.
if (has(' for “')) {
  console.log('   a search is committed: clearing so the list is long enough to page');
  if (!pressLabel('text^="Clear "')) fail('a search is committed and its clear button was not pressable');
  sleep(4);
  if (has(' for “')) fail('pressed the clear control but the search is still committed');
}
scrollTop();
sleep(2);

// Zero the ledger, then prove it took. Two reads of a CUMULATIVE counter attribute everything
// since launch to the scroll, and the delta below went NEGATIVE (-1) until this was fixed.
open('dev', 'Developer');
if (seek((n) => (n.label ?? '').trim() === 'Reset')) {
  const r = nodes().find((n) => (n.label ?? '').trim() === 'Reset');
  sh(`npx agent-device press '@${r.ref}' 2>&1`, { allowFail: true });
  sleep(1);
}
const base = ledger('baseline').total;
if (base !== 0) fail(`baseline is ${base}, not 0: the Reset did not take, so the scroll delta is meaningless`);

// ledger() reads itself by navigating to the dev screen, so the pointer is no longer on the
// list we are about to scroll. Coming back is not ceremony: panning the dev screen for forty
// stops while asserting "the exercise list did not page" is the sort of green that means nothing.
open('exercises', 'Exercise');
sleep(3);
scrollTop();

// ── 2. Scroll to the bottom, checking every stop for a simultaneous duplicate ─────────────
console.log('2. scrolling the list, watching for a row that appears twice at once');

/**
 * The exercise rows currently mounted, as full labels.
 *
 * Height is what separates a row from the chrome: rows are 72 pt tall, the "Filters" chip is
 * 30-38, and the screen's own containers report 874. Filtering on "is a Button taller than 30"
 * counted the Filters chip as the top row: and since that chip never moves, the loop concluded
 * on its FIRST pan that the list had stopped scrolling and reported "the list never paged".
 *
 * The whole label is the key, not the first line: wger really does hold two exercises with the
 * same name, and a name collision is not the defect under test. Overlapping pages would repeat
 * a row including its category line, which is what this compares.
 */
function rowLabels() {
  return nodes()
    .filter((n) => n.type === 'Button' && visible(n) && n.rect.height >= 50 && n.rect.height <= 140)
    // SORTED BY POSITION. A recycling list reuses its cells, so tree order is the order the
    // cells were created in, not the order they appear on screen, "the first row in the tree"
    // is a stable slot whose content changes underneath it. Comparing that across pans said
    // the list had stopped moving on the first pan, and the check reported "the list never
    // paged" for a list that was scrolling perfectly well.
    .sort((a, b) => a.rect.y - b.rect.y)
    .map((n) => (n.label ?? '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 1);
}

const dupes = [];
let stops = 0;
let lastTop = null;
for (let i = 0; i < 40; i += 1) {
  const titles = rowLabels();
  const seen = new Set();
  for (const t of titles) {
    if (seen.has(t) && !dupes.includes(t)) dupes.push(t);
    seen.add(t);
  }
  // Stop when the whole visible window stops changing, not when one row repeats: at the end
  // of the list a pan moves nothing, and that is the only reliable signal. A single row is
  // too weak a fingerprint: two adjacent windows can share their topmost item.
  const top = titles.join('|') || null;
  if (top === lastTop) break;
  lastTop = top;
  stops += 1;
  panDown();
}
sleep(2);

const afterPages = ledger('after scrolling').total;
const fetched = afterPages - base;
console.log(`   panned ${stops} times, ${fetched} request(s) fired while paging`);
if (dupes.length) {
  fail(`the same exercise is on screen twice at once: ${dupes.slice(0, 3).join(' | ')}, ` +
       'the id-keyed dedupe at the read boundary is not holding');
}
// The vacuous-pass guard. One request means we never crossed a page boundary, so no duplicate
// COULD have been observed and the result above means nothing.
if (fetched < 2) {
  fail(`only ${fetched} request(s) fired across ${stops} pans: the list never paged, so ` +
       '"no duplicates" was never actually tested. Scrolling may not be reaching the list.');
}

console.log('\nPASS: multiple pages rendered with no row appearing twice');
