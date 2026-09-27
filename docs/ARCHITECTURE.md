# Architecture deltas

Kinetiq follows the agentic-kit `ARCHITECTURE.md`, `ERROR_HANDLING.md` and `TESTING.md` (shipped
in the plugin as `${CLAUDE_PLUGIN_ROOT}/docs/`). This file lists only what Kinetiq decides on top
of them; where the two disagree, this file wins. `CLAUDE.md` holds the product rules (icons,
native controls, layout, performance, i18n) and `docs/EFFECT_NOTES.md` points at the kit primer
section that applies to each part of the app.

## Layout

`featuresRoot` is `features`, `appRoot` is `app`, and `@/` points at the repository root
(`@/features/...`, `@/app/...`). There is no `src/`. Route files in `app/` are thin: each
re-exports a page from a feature's `pages.ts` and sets nothing else.

## Tiers

Every feature declares `FEATURE_TIER` in its `index.ts`; `npm run arch` checks the graph.

| Tier | Features | What they own |
| --- | --- | --- |
| 0 | `core/*` (below) | the shared concerns |
| 1 | `settings`, `watch-bridge` | the settings store and its SQLite rows; the WatchConnectivity bridge, its envelopes and `bounds.json` |
| 2 | `exercises`, `notifications` | the SQLite exercise catalog, its bundled install, 30-day refresh and wger source, the stored snapshots; local notifications, the training reminder and the rest alert |
| 3 | `routines`, `workouts` | routines, items and the routine draft; the session engine, history, records and progress |
| 4 | `bootstrap`, `home`, `profile`, `transfer`, `watch-sync` | the launch; the Home and Workout tabs and the pickers; the profile tab and its settings screens; import and export; the watch mirror and inbox |
| 5 | `core/runtime` | the app Layer and the one runtime |

`notifications` is tier 2, not the 1 the epic's table gave it: it reads the settings (tier 1).

`workouts` never imports `routines` (they are peers). The two meet in `home`:

- `workouts` declares the `RoutineUsage` port (count a finished workout against its routine);
  `home` fills it over `RoutineRepository` (`home/data/services/routineUsageLive.ts`), and
  `core/runtime` provides `HomeLive` under `WorkoutsLive`.
- `routines` declares `WorkoutLauncher` (what the routine screen needs to start a workout);
  `home` maps a `Routine` to the `SessionPlan` owned by `workouts`
  (`home/facades/useStartWorkoutFromRoutine.ts`) and hands it to the routine page.

## Core concerns

| Concern | What it holds |
| --- | --- |
| `core/error` | the `AppError` union over `AppErrorRegistry`, `errorTagToMessageKey`, `useErrorMessage`, the HTTP retry budget and delay (`httpRetryDelayMs`, which caps an honoured `Retry-After` at one minute) |
| `core/config` | `AppConfig` from `makeConfig`, decoding `extra` in `app.json` (the wger base URL) |
| `core/logger` | `LoggerLive` and `logBackgroundFailure`, the one logging helper outside the boundary (see Exceptions) |
| `core/sqlite` | `SqliteLive` (expo-sqlite, WAL, foreign keys), the per-version migrations `v001` to `v010`, `SchemaStatus`, `clearAllUserData` and `resetLocalData` |
| `core/lifecycle` | `BackgroundSync`, the port the bootstrap installs and `watch-sync` fills (below) |
| `core/query` | `queryClient` (no TanStack retry for app errors), `useEffectQuery` and `useEffectMutation` re-exported for facades, the app-state and network adapters |
| `core/state` | `createStore`, `createSelectors`, `resetAllStores` |
| `core/translations` | the hand-rolled catalog (`en`, `it`), `useT`, `tr`; a module-level map holds catalog keys, never words |
| `core/theme` | tokens, `spacing`, `screenGutter`, the accent, `themeFor` |
| `core/design-system` | controls (`controls/<Name>/index.ios.tsx`, `index.android.tsx`, `types.ts`), layout, charts, display, states, icons, insets |
| `core/navigation` | `routes`, header options and actions (`headerActions.ts`, one `sf` and one `material` name per action), the not-found page |
| `core/haptics` | the `Haptics` Tag and the plain `haptics` vocabulary views call through `useHaptics` |
| `core/network`, `core/clock`, `core/utils` | the connectivity probe; clock helpers; formatting, relative time, colour and small pure helpers |
| `core/testing` | `makeTestAppLayer`, `makeTestRuntime`, `makeMigratedSqliteLayer`, `renderWithLayer`, `routerFake`, `makeHapticsFake` |
| `core/runtime` | `AppLayer`, `runtime` and the `Register` augmentation |

## Views

- `lint.allowedHooksInViews`: `useAppTheme`, `useStyles`, `useT`, `useHaptics` and the Reanimated
  hooks (`useAnimatedStyle`, `useSharedValue`, `useDerivedValue`, `useAnimatedReaction`,
  `useAnimatedScrollHandler`, `useReducedMotion`). A view may call `useT` directly for copy.
- `lint.layoutTokens` is on: the gutter is `screenGutter`, spacing comes from
  `@/features/core/theme`, and `layout.allow` lists the chart internals exempt from
  `arch/no-literal-gutter`.
- Platform rules are `CLAUDE.md`'s: Expo UI first, a platform file per native control, the React
  Native fallback in its own file, `Platform.select` for single values only.
- **Home renders lower features' pages.** `home` (tier 4) composes screens from the `pages.ts` of
  `exercises`, `routines` and `workouts`: the exercise detail with the history section, the
  routine page with the launcher, the pickers into a draft, a routine or a session. The tier rule
  allows it (a strictly lower feature's public page surface), and it keeps a peer-to-peer page
  import (routines to workouts) out of the graph.

## Patterns

- **A service Tag over a lower feature's use cases.** A tier-4 use case that needs a lower
  feature's behaviour gets it through a Tag the lower feature declares in `domain/services/` and
  fills in `di/` over its own use cases, never by importing the use cases (they are not public
  API): `ExerciseCatalog` (install, refresh, find, search), `TrainingReminder`, `WorkoutRecorder`.
  The runBootstrap and watch-sync tests fake the Tag.
- **`BackgroundSync` port.** `core/lifecycle` declares `install`, `sync` (push and inbox drain)
  and `push` (push only). The bootstrap installs it after the migrations and syncs on every return
  to the foreground; `watch-sync` provides it over `WatchBridge` (a no-op without a watch bridge).
  An erase pushes only, so a workout waiting in the watch inbox is not saved straight back into
  the history the user just erased. A failed install is retried by the next launch attempt; the
  install subscribes to the bridge before it forks the debounced push, so a retry leaves one
  stream.
- **Failed migration.** `SqliteClientLive` fails the boot only when the database cannot open. A
  failed migration step rolls back and is reported through `SchemaStatus` (`current`), so the
  runtime still builds: settings autosave, notifications and the erase path all work. The
  bootstrap fails with the step's `SqlError`, and the fatal screen offers Try again, the device
  settings, and, for any launch failure that is a `SqlError`, a confirmed Reset local data:
  `resetLocalData` wipes the user tables (keeping the schema and the catalog), runs the migrations
  again through `SchemaStatus.remigrate`, and the launch runs again. The slow-launch screen offers
  the same reset.
- **`useExerciseSearch` is a widening single query**, not an infinite query: Load more raises the
  limit of one read (`0..n`), so the list is always one consistent read and a catalog swapped
  mid-scroll cannot repeat a row. The picker shows 24 rows of a 50-row read and offers Load more
  while `shown < items.length || hasMore`.
- **A catalog with no row is an answer.** `getExercise` answers `null` for a retired or `local:`
  exercise; `useExercise` falls back to the stored snapshot and logs nothing.
- **Stored rows read tolerantly**, as `main` did: an `entries_json` entry missing a nullable field
  reads with it empty (rest defaults to 90 s), an entry with no exercise or no sets is dropped
  alone, and a `records.kind` this build does not know is left out, not failed. Writes are
  unchanged byte for byte.
- **Device capabilities are Tags.** Opening a web page (`exercises` `ExternalPages`) and keeping
  the screen on (`workouts` `ScreenWake`) run through the boundary, which logs a refusal once.
- **The training reminder** is re-scheduled on every sync. A `cancelAll` that fails does not stop
  the schedule (as on `main`); its `NotificationScheduleFailed` is the result once the reminder is
  scheduled, so the boundary logs it.

## Exceptions

Each is a deliberate departure from a kit rule, with the reason.

1. **Logging at fork points.** `logBackgroundFailure` (`core/logger`) logs through `Logger` inside
   `runBootstrap`, `installWatchSync` and `WatchBackgroundSyncLive`. These steps run on daemon
   fibers or as best-effort launch steps with no caller to hand a failure to; logging where the
   fiber forks is the boundary for that work. Nothing else logs outside the hooks.
2. **Settings autosave logs inside its Layer.** `SettingsAutosaveLive` is a scoped Layer whose
   debounced stream persists every settings write for the life of the runtime; a failed write has
   no caller, so it logs `settings could not be persisted` there and keeps the values in memory.
3. **Console, three places.** `RootErrorBoundary.componentDidCatch` (above the navigator, where
   nothing else is guaranteed to work), the query client's `MutationCache` for a plain mutation
   with no Effect boundary, and `translate.ts`'s development-only missing-key warning. Each has a
   `biome-ignore` with its reason.
4. **Bootstrap best-effort swallows.** The native splash (`splash.ts`), the chrome colour in
   `LaunchEnvironmentLive.paintChrome`, and `Linking.openSettings` on the fatal screen and the root
   boundary drop their rejection with a `// NOTE:` codetag: each is cosmetic or a way out that has
   nothing to report to. These are the only lines the `catch(() => undefined)` grep returns
   outside tests.
5. **Fallback catches with a reason.** The network probe (treated as online), the liquid-glass
   check, the Android header glyph render, the root layout's appearance read, the haptics fire and
   the notification channel set-up keep a fallback value and say why in a `// NOTE:` codetag.
6. **Routine snapshot writes are not in the routine's transaction.** `createRoutine` and
   `addRoutineItem` upsert the exercise snapshots through `ExerciseSnapshotRepository` before the routine
   save, outside its transaction: a snapshot is an idempotent upsert keyed by exercise, and one
   left behind by a failed save is harmless reference data. `setItem` and `removeItem` renumber
   positions outside a transaction, as on `main`. The name-taken check reads, then writes: two
   saves racing with the same name could both pass. Accepted: one user, one device, one screen.

## Tests

- Use case tests fake Tags as Layers; Live Layer and migration tests run on
  `makeMigratedSqliteLayer()` or `makeNodeSqliteLayer()`. A v9 database fixture with legacy-shaped
  rows pins the tolerant reads (`workouts/data/repositories/__tests__/legacyRows.test.ts`).
- ViewModel and facade tests render with `renderWithLayer(layer, hook, props, around?)`: a test
  runtime of `layer` over the core test services, a fresh query client, a safe area with iPhone 17
  Pro metrics; `done` unmounts and disposes. `routerFake` is the router every test sees (the root
  `__mocks__/expo-router.ts` hands it out), reset before each test; a test sets params and reads
  `routerFake.history`.
- `effect-only-in-inner-layers` applies to tests: a `ui/` or `facades/` test runs no Effect, so the
  Effect seeding helpers and fake Layers they use live in the feature's `di/__tests__/`
  (`workoutsTestData.ts`, `homeTestLayer.ts`, `profileTestLayer.ts`, `bootstrapTestData.ts`).
- `jest.config.cjs` deltas: Reanimated's and worklets' own mocks in `__mocks__/` so the design
  system and navigation barrels load; `expo-asset` mapped to its copy nested under `expo` (knip
  ignores it for that reason); the coverage measurement and the kit's global floors (70 percent
  lines, functions, statements, 55 branches), which the installed preset predates.
- `npm run test:coverage` runs jest with coverage and `scripts/check-coverage.js`, which requires
  80 percent of the lines of `features/**/useCases/**` and `features/**/data/**`. CI runs it after
  `npm run check`.

## Tooling notes

- knip ignores `expo-updates`: the dependency is gone, but knip's Expo plugin infers it from
  `app.json`. It also ignores `expo-asset` (above) and `@commitlint/config-conventional` (loaded
  by the kit's commitlint config).
- `verbatimModuleSyntax` is on; `@/*` maps to `./*` in `tsconfig.json`, jest and knip.

## Kit gaps

What the kit (0.1.1) does not cover yet, and what Kinetiq does meanwhile:

- No `useEffectInfiniteQuery`: the exercise search widens one query instead (above).
- `makeTestWrapper` needs a runtime of the full `AppServices`: `renderWithLayer` casts a partial
  test runtime to `ProvidedRuntime`, with a `// NOTE:` saying so.
- The `core/error` and `core/config` indexes do not load under `tsx` (the kit's ES modules and the
  `@/` alias), so `scripts/build-catalog.ts` imports the modules it needs directly.
- `arch/no-inline-comments` rejects `{/* NOTE: */}` in JSX: such a note moves to the TSDoc of the
  component or a `// NOTE:` above the JSX expression.
- The installed jest preset spreads its `withKitTransforms` helper into the config (a jest
  validation warning) and has no coverage settings; `jest.config.cjs` drops the one and adds the
  other.
