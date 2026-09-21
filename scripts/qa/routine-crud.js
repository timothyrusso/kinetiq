#!/usr/bin/env node
/**
 * Routine CRUD and persistence, asserted against the database rather than the screen.
 *
 *   node scripts/qa/routine-crud.js      (npm run qa:crud)
 *
 * ── Why the database is the oracle here ────────────────────────────────────────────────────
 * "The routine is still in the list after a restart" is nearly vacuous: the list is rendered from
 * whatever the app loaded, so a screen that re-derives routines from a stale cache looks identical
 * to one that read them from disk. And "deleted" is invisible from the UI in the interesting case, * a row filtered out of a list and a row removed by a `DELETE` render the same nothing. The file
 * the app actually wrote is the only witness with standing for either claim, so every assertion
 * below is a SELECT, and the UI steps exist to produce state for those SELECTs to describe.
 *
 * ── What this is really testing ────────────────────────────────────────────────────────────
 * The brief's hardest persistence promise: a routine built from a REMOTE exercise must stay usable
 * forever, even after wger disappears. That works here because `routine_items.exercise_name` is a
 * denormalised copy taken at add-time: so the check asserts the copy exists and equals what the
 * picker showed, which is the exact property that makes an offline routine possible. A routine
 * whose name column were empty would render as a blank row the moment the network failed.
 *
 * ── Seeded data is never touched ───────────────────────────────────────────────────────────
 * The seeder's three routines (`Push · Heavy`, `Pull · Heavy`, `Legs · Squat Focus`) carry the
 * other checks' fixtures, and one of them has a paused session attached. Everything this script
 * creates is named with a `QA ` prefix plus a run stamp, and the cleanup deletes BY THAT NAME and
 * by nothing else. `DELETE` with no `LIKE 'QA %'` in it is a bug in this file.
 *
 * ── Eager writes, so no "save" step to wait for ────────────────────────────────────────────
 * The detail screen commits every edit through a mutation the moment it happens (app/routine/
 * [id].tsx: moveItem, setItem, removeItem, duplicate, delete all `mutateAsync` inline), and the
 * create screen commits on `Done`. There is no debounce to outwait: but there IS a round trip, so
 * every DB read after an edit is preceded by the same `dbWait` settle loop, which re-reads rather
 * than sleeping a guessed number of seconds.
 */
const {
  fillField, tab, fail, onExit, pressLabel, seek, nodes, visible, sh, open,
  sleep, restartApp, dbQuery, dbCol, dbExec,
} = require('./lib');

const PREFIX = 'QA Circuit';
const NAME = `${PREFIX} ${Date.now().toString().slice(-6)}`;
/** Any term the remote catalog answers with at least two rows for. */
const TERM = 'squat';
/** What must never change. */
const SEEDED = ['Push · Heavy', 'Pull · Heavy', 'Legs · Squat Focus'];

const sql = (s) => s.replace(/'/g, "''");
const like = (n) => `QA ${n}`;

let created = false;
onExit(() => {
  if (!created) return;
  try {
    dbExec(`delete from routines where name like '${sql(like('%'))}';`);
    const left = dbCol(`select name from routines where name like '${sql(like('%'))}';`);
    console.log(`   cleanup: ${left.length ? `COULD NOT REMOVE ${left.join(', ')}` : 'test routines removed'}`);
  } catch (e) {
    console.log(`   cleanup: skipped (${String(e.message).slice(0, 60)})`);
  }
});

/**
 * Read a query until it stabilises, because writes are async in the app.
 * `want` is the row count we expect; returning early on the first match would read a partially
 * applied multi-row write as a complete one, so this waits for the value to be seen twice.
 */
function dbWait(query, want, { tries = 10 } = {}) {
  let last = null;
  for (let i = 0; i < tries; i += 1) {
    const rows = dbQuery(query);
    if (rows.length === want && last !== null && JSON.stringify(rows) === JSON.stringify(last)) return rows;
    last = rows;
    sleep(1.2);
  }
  return last;
}

const routineRow = (n) =>
  `select r.id, r.name, (select count(*) from routine_items i where i.routine_id = r.id)
     from routines r where r.name = '${sql(n)}';`;

console.log('\n── routine CRUD and persistence, read from the database ─────────');

// ── 0. The oracle is the app's own file ──────────────────────────────────────────────────────
const before = dbCol('select name from routines order by created_at;');
for (const s of SEEDED) {
  if (!before.includes(s)) fail(`the database does not look like this app's (no "${s}"): [${before.join(', ')}]`);
}
console.log(`0. oracle: ${before.length} routines on disk, seeded fixtures present`);
if (before.some((n) => n.startsWith('QA '))) {
  dbExec(`delete from routines where name like 'QA %';`);
  console.log('   cleared routines left by an earlier aborted run');
}

// ── 1. Create, with an exercise taken from the REMOTE catalog ────────────────────────────────
// Name FIRST, add the exercise second. The other order loses the name: opening the picker mounts
// a sheet over the form, and the field that `nodes()` then reports as "the visible TextField" is
// the picker's search box, so a fill meant for the name lands in the search instead.
// Start from a cold app. This script drives sheets and pushed screens, and a previous run
// that failed mid-flow leaves one of them on top: after which `tab()` has no tab bar to
// press and the very first step reports "never found New routine", which reads as the Workout
// tab being broken. The cache is memory-only, so a restart costs nothing but the launch.
restartApp();
tab('Workout');
sleep(2);
if (!pressLabel('New routine')) fail('could not reach the routine builder from the Workout tab');
sleep(2);
if (!seek((n) => (n.label ?? '') === 'Routine name')) fail('the routine builder never opened');
const nameField = nodes().find((n) => n.type === 'TextField' && visible(n));
if (!nameField?.ref) fail('the routine builder has no visible field to name the routine');
fillField(nameField.ref, NAME);
sleep(1);

// An EMPTY routine offers "Add exercise" (the empty state's own call to action); the compact
// "Add" button in the Exercises section header only exists once there is a row to sit above.
// A new routine is always the first case, but both are tried so this step does not depend on
// which one the screen happens to be in.
if (!pressLabel('Add exercise') && !pressLabel('Add')) {
  fail('could not open the exercise picker: neither "Add exercise" nor "Add" was pressable');
}
sleep(3);
const pickerTitle = seek((n) => (n.label ?? '').trim() === 'Add exercises');
if (!pickerTitle) fail('the exercise picker did not open');
// Pick the field by its LABEL, not by where it sits. The picker is presented over the builder
// and the builder's own "Routine name" input stays in the tree behind it, so "the first visible
// TextField" is the wrong one: that typed the search term into the routine's name and left the
// picker empty, which then read as "the remote catalog never loaded".
//
// Geometry was the second wrong answer: "below the sheet title" held only until the builder's
// own top inset was fixed, after which the name field moved to y=162 and the sheet title was at
// y=138: so the name field was below the title too. Measured, this screen has exactly two
// visible fields, labelled "Routine name" and "Search"; the label is the thing that actually
// distinguishes them.
const pick = nodes().find(
  (n) => n.type === 'TextField' && visible(n) && (n.label ?? '').trim() === 'Search',
);
if (!pick?.ref) {
  fail(
    'the picker is open but has no field labelled "Search": visible fields: ' +
      nodes()
        .filter((n) => n.type === 'TextField' && visible(n))
        .map((n) => JSON.stringify(n.label))
        .join(', '),
  );
}
// Blur inside the sheet: the default tap point is above it, on the screen behind.
fillField(pick.ref, TERM, { blurAt: `201 ${Math.round(pickerTitle.rect.y)}` });
sleep(12);
// A row already in the routine renders disabled with a check, and pressing it does nothing, // which would read as the picker ignoring the tap. Take the first row that is actually pressable,
// and require it to be a real catalog result rather than the placeholder rows shown while loading.
const row = nodes().find(
  (n) => visible(n)
    && (n.label ?? '').toLowerCase().includes(TERM)
    && n.disabled !== true
    && n.ref,
);
if (!row?.ref) {
  fail(`the picker shows nothing pressable matching "${TERM}": the remote catalog never loaded, ` +
       'so this run cannot prove a REMOTE exercise survives persistence');
}
const pickedName = row.label.trim();
sh(`npx agent-device press '@${row.ref}' 2>&1`, { allowFail: true });
sleep(2);
if (!pressLabel('Done')) fail('could not close the picker after adding an exercise');
sleep(1);
console.log(`1. named it and added remote exercise "${pickedName}"`);

if (!pressLabel('Done')) fail('could not save the new routine');
created = true;
sleep(3);
console.log(`   saved as "${NAME}"`);

let rows = dbWait(routineRow(NAME), 1);
if (!rows.length) fail(`"${NAME}" is not in the database after saving it: the routine was lost`);
const [id, name, itemCount] = rows[0];
if (name !== NAME) fail(`saved name came back as "${name}"`);
if (Number(itemCount) < 1) fail(`"${NAME}" saved with ${itemCount} items: the picked exercise was not stored`);
const items = dbQuery(
  `select position, exercise_name, sets from routine_items where routine_id = '${sql(id)}' order by position;`,
);
console.log(`2. on disk: 1 routine, ${items.length} item(s), ${items.map((i) => `${i[0]}:${i[1]}`).join(', ')}`);
// The denormalised name is the whole offline promise.
if (items.some((i) => !i[1]?.trim())) {
  fail('a routine item has an empty exercise_name: it would render blank the moment wger is unreachable');
}
if (!items.some((i) => i[1] === pickedName)) {
  fail(`the stored item names (${items.map((i) => i[1]).join(', ')}) do not include the one just added ("${pickedName}")`);
}

// ── 3. Survive a force-quit ──────────────────────────────────────────────────────────────────
restartApp();
tab('Workout');
const stillThere = dbWait(routineRow(NAME), 1);
if (!stillThere.length) fail(`"${NAME}" vanished after a cold restart`);
if (!seek((n) => (n.label ?? '').includes(NAME), { max: 6 })) {
  fail(`"${NAME}" is on disk but the Workout tab never listed it after a restart`);
}
console.log('3. survived a cold restart: on disk and listed on the Workout tab');

// ── 4. Rename ────────────────────────────────────────────────────────────────────────────────
// The row's label is `"<name>. <subtitle>"` (src/ui/rows.tsx RoutineRow), NOT
// `"<name>, last trained …"`: that wording belongs to `LastTrainedCard`, a different
// component on the same screen. Verified against the live tree:
//   "Push, Heavy. 5 exercises · 9x done · 3d ago"
if (!pressLabel(`text^="${NAME}. "`)) fail(`could not open "${NAME}" from the list`);
sleep(3);
if (!pressLabel('Routine options')) fail('no options button on the routine screen');
if (!seek((n) => (n.label ?? '') === 'Rename')) fail('the options sheet never appeared');
if (!pressLabel('Rename')) fail('could not choose Rename');
const RENAMED = `${NAME} II`;
const renameField = nodes().find((n) => n.type === 'TextField' && visible(n));
if (!renameField?.ref) fail('the rename sheet has no field');
// No blur here. Above this sheet is the backdrop (tapping it dismisses the sheet and the
// "Save name" button with it); below the field is the keyboard (tapping that types a
// character: one run committed the name as "… IIg"). "Save name" stays reachable with the
// keyboard up and commits the field itself, so pressing it is both the blur and the action.
fillField(renameField.ref, RENAMED, { blurAt: null });
sleep(1);
if (!pressLabel('Save name')) fail('could not commit the rename');
sleep(2);
const renamed = dbWait(`select name from routines where id = '${sql(id)}';`, 1);
if (renamed[0]?.[0] !== RENAMED) fail(`rename did not persist (disk says "${renamed[0]?.[0]}")`);
console.log(`4. renamed on screen and on disk → "${RENAMED}"`);

// ── 5. Duplicate, then delete both ───────────────────────────────────────────────────────────
pressLabel('Routine options');
if (!seek((n) => (n.label ?? '') === 'Duplicate')) fail('the options sheet never appeared for duplication');
if (!pressLabel('Duplicate')) fail('could not choose Duplicate');
sleep(4);
const dup = dbWait(
  `select name from routines where name = '${sql(`${RENAMED} copy`)}';`, 1,
);
if (!dup.length) fail('Duplicate produced no copy on disk');
// The copy must carry the items, or "duplicate a routine" means "duplicate an empty shell".
const dupItems = dbQuery(
  `select count(*) from routine_items i join routines r on r.id = i.routine_id
     where r.name = '${sql(`${RENAMED} copy`)}';`,
);
if (Number(dupItems[0]?.[0]) < items.length) {
  fail(`the copy has ${dupItems[0]?.[0]} items, fewer than the original's ${items.length}`);
}
console.log(`5. duplicated with its ${items.length} item(s) intact`);

for (const target of [`${RENAMED} copy`, RENAMED]) {
  // Deep-link rather than tap the tab. Duplicating ends with `router.replace` onto the COPY's
  // detail screen, which is a pushed route covering the tab bar: so there is no tab button to
  // press, and the coordinate fallback lands on ordinary content. The run then reported the
  // copy as missing from a list it had never navigated back to.
  open('workout', undefined, { soft: true });
  sleep(3);
  if (!pressLabel(`text^="${target}. "`)) fail(`could not reopen "${target}" to delete it`);
  sleep(3);
  if (!pressLabel('Routine options')) fail(`no options button on "${target}"`);
  if (!seek((n) => (n.label ?? '') === 'Delete routine')) fail('the options sheet never appeared for deletion');
  if (!pressLabel('Delete routine')) fail('could not choose Delete routine');
  if (!seek((n) => /^Delete “/.test(n.label ?? ''))) fail('the delete confirmation never appeared');
  if (!pressLabel('Delete routine')) fail('could not confirm the deletion');
  sleep(2);
  const gone = dbWait(`select id from routines where name = '${sql(target)}';`, 0);
  if (gone.length) fail(`"${target}" is still on disk after a confirmed delete`);
}
console.log('6. both deleted: gone from disk, and the confirm sheet was required to do it');

// ── 7. Nothing else was harmed ───────────────────────────────────────────────────────────────
const after = dbCol('select name from routines;');
for (const s of SEEDED) {
  if (!after.includes(s)) fail(`"${s}" disappeared: this script must only ever delete its own rows`);
}
const leftovers = after.filter((n) => n.startsWith('QA '));
if (leftovers.length) fail(`left test routines behind: ${leftovers.join(', ')}`);
console.log(`7. seeded fixtures intact (${SEEDED.length}), no test rows left: ${after.length} routines on disk`);

console.log('\n✓ Routine CRUD and persistence hold, verified against the database.\n');
