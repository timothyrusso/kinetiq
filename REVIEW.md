# Kinetiq: engineering review

A review of the code as built, written to be useful to whoever picks it up next. It is
organised by what would cost the most to get wrong, not by feature.

## What this is

An Expo SDK 57 fitness tracker: SQLite for everything, TanStack Query as the cache in front of
it, and a hard line between what the user owns (routines, history) and what the wger catalog
owns (the exercise library). The line is the point of the architecture, and most of the
decisions below fall out of it.

## The one decision everything else rests on

**A routine stores a snapshot of every exercise in it, not a reference to one.**

`routine_items` carries an `exercise_id`, and `exercises` carries the name, muscles,
equipment and image URL captured at the moment the user added it. The alternative, storing an
id and resolving it from the catalog at read time, is smaller and is how this usually gets
built. It also means a routine cannot be opened on a plane, and that wger renaming or
retiring an exercise silently rewrites a training plan the user wrote.

The cost is real: the snapshot table is the second-largest in the schema, a snapshot can go
stale against the catalog, and the write path has to insert snapshots and items in one
transaction in the right order. That ordering was a genuine bug (items were inserted first,
with foreign keys on, so saving a newly discovered exercise failed while saving an already
stored one worked), and it is exactly the kind of bug that only appears against real data.

## The exercise catalog is local, and the network only refreshes it

The whole wger catalog (912 exercises, English and Italian) lives in `catalog_*` tables, and a
local provider answers search, filters, detail and variations with SQL. A trimmed snapshot is
committed at `assets/catalog/wger.json` and installed on first launch, so a fresh install works
in airplane mode. When the catalog is more than 30 days old and the device is online, a
background download replaces it: every page into memory first, then one exclusive transaction
swaps the tables, so a failure at any point leaves the old catalog untouched. `replaceCatalog`
is the only writer, for both the snapshot and the download.

Search is `LIKE` over a lowercase, accent-folded name, ranked exact, then prefix, then word
start, the app's language before English. That ranking matters beyond the picker: the routine
importer takes the top row as the closest match for a name it cannot find exactly.

Routines still store snapshots, and a refresh never reconciles them. Images are the one thing
not bundled: they are cached on disk the first time they are seen.

## Where I think the code is strong

**The offline claim is tested rather than asserted.** The catalog repository's tests run its
SQL against a real in-memory SQLite (`node:sqlite`), including installing the committed
snapshot with foreign keys on and proving that a download failing halfway leaves the previous
catalog whole.

**Retry policy is per fault kind, and the numbers are measured.** Offline is permanent, so it
is not retried; a 500 is retried twice; a timeout is retried twice with backoff. The fault
matrix asserts the request counts, so "retry a dead radio forever" shows up as a failing gate
rather than as a battery complaint months later.

**Persistence has migrations and they run.** `PRAGMA user_version`, six migrations, and the
About screen shows the version the install actually migrated to rather than the constant the
binary was built with.

**One source of truth per measurement.** Spacing, bottom insets and type all come from single
tables. This was learned the expensive way: fifteen conflicting `BOTTOM_SPACE` constants and
two header components with different vertical-centring maths.

## Where it is weak

**The QA harness is as complex as a feature, and it earned that complexity.** Nearly every bug
it had reported something *present* as *absent*: unpaired ledger rows, failed snapshots read
as blank screens, scroll steps that jumped a whole viewport, presses that hit a container
instead of a button, taps that landed on chrome drawn over the target. Absence is what
assertions key on, so every one of those produced a confident, wrong bug report about the app.
If this harness is extended, the rule that pays for itself is: never let "I did not find it"
and "it is not there" be the same return value.

**The gates match on user-visible copy.** That is what makes them honest, and it also means a
copy edit can fail a gate. Adding Italian broke the fault matrix because the search subtitle's
curly quotes became straight ones. The gates should match on structure where they can.

**Snapshots can go stale and nothing reconciles them.** An exercise renamed upstream keeps its
old name inside a routine forever. That is the correct default (the user's plan should not
change under them) but there is no "refresh this snapshot" affordance, so there is no way to
take the update if you want it.

**`tr()` is easy to misuse.** It reads the language at call time, which is right for services
and wrong inside a memoised component: the component does not subscribe, so if its props do
not change it keeps the words it first rendered. The rule is `useT()` in components, `tr()`
outside React, and it is not currently enforced by anything but review.

**Two header implementations.** Settings-style screens use the platform large title; screens
with a subtitle or full-bleed media keep the custom bar, because a native bar cannot show a
second line. Defensible, documented, and still two things to keep in step.

## What I would do first, in order

1. **Reconcile stale snapshots.** A per-routine "check the library for updates" that diffs
   the snapshot against the catalog and lets the user take or ignore each change.
2. **Make the gates structural.** Match on testIDs, not on sentences.
3. **Enforce the `useT` / `tr` rule in `npm run check`.** The analysis is not hard: a
   memoised component whose body calls `tr()` is the bug.
4. **Decide what a subtitle is worth.** If the answer is "less than a native header", the
   remaining screens can move and the custom bar can go.

## What is deliberately not here

No account, no sync, no backend of the app's own. Everything the user creates is on the
device. The only network traffic is the monthly catalog download and exercise images. That is a product decision
with an engineering consequence: there is no server to reconcile against, so there is also no
conflict resolution, no auth, and no privacy policy to write.
