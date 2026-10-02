# Effect notes

Where each section of the kit's `EFFECT_PRIMER.md` (in the plugin's `docs/`) applies in Kinetiq,
with the file to read as the worked example. The primer explains the idiom; this file says where
it lives here. `docs/ARCHITECTURE.md` lists the deltas.

| Primer section | Where it applies in Kinetiq | Read first |
| --- | --- | --- |
| Why Effect here | the inner layers of every feature: `domain/`, `data/`, `useCases/`, `di/` | `features/routines/useCases/createRoutine.ts` |
| `Effect<A, E, R>` read aloud | every use case's signature: its `R` names the Tags it needs, its `E` the tagged errors | `features/workouts/useCases/weeklyGoalReached.ts` |
| `Effect.gen` and `yield*` | use cases and Live Layers; `yield* new SomeError(...)` fails | `features/exercises/useCases/getExercise.ts` |
| Tagged errors and the closed union | each feature's `domain/errors/`, joined in `core/error` through `AppErrorRegistry` and mapped to a catalog key in `errorTagToMessageKey` | `features/routines/domain/errors/RoutinesErrors.ts`, `features/core/error/mappers/errorTagToMessageKey.ts` |
| `Context.Tag` services and `Layer` | repositories, `SqliteClient`, `SchemaStatus`, `WatchBridge`, `Notifications`, `Haptics`, `ScreenWake`, `BundledCatalog`, and the ports (`BackgroundSync`, `RoutineUsage`, `ExerciseCatalog`) | `features/workouts/di/layer.ts`, `features/core/runtime/runtime.ts` |
| The runtime and the two React hooks | one `ManagedRuntime` in `core/runtime`; facades hand Effects to `useEffectQuery` and `useEffectMutation` from `core/query` | `features/exercises/facades/useExercise.ts`, `features/bootstrap/facades/useBootstrap.ts` |
| Schema: decode, encode, brand | every SQLite row (`data/adapters/*Rows.ts`), the bundled exercise dataset, the `kinetiq.routines` and `kinetiq.workouts` formats, the watch envelopes, `app.json` extra, branded ids (`RoutineId`, `ActivityId`) | `features/workouts/data/adapters/decodeRows.ts`, `features/exercises/domain/schemas/CatalogPayloadSchema.ts` |
| Retry and timeout | no Effect `Schedule` yet: the app calls no server. TanStack retries an `HttpError` on `HTTP_RETRY_BUDGET`, waiting `httpRetryDelayMs` (a `Retry-After`, capped at a minute), and never re-runs another app error | `features/core/query/queryClient.ts` |
| Testing with Layers | `itEffect` with fake Layers for use cases, `makeMigratedSqliteLayer` for Live Layers, `advanceClock` for debounces and backoffs, `renderWithLayer` for facades and ViewModels | `features/watch-sync/useCases/__tests__/installWatchSync.test.ts`, `features/workouts/data/repositories/__tests__/legacyRows.test.ts` |
| Ten mistakes agents make | all of them apply; the ones Kinetiq has actually paid for are below | |
| Cheat sheet | as is | |

## Kinetiq specifics

- **Streams and daemon fibers** (not in the primer): the watch push is debounced with
  `Stream.debounce` over a sliding `Queue` fed by the `RoutineEvents` `PubSub`
  (`features/watch-sync/useCases/installWatchSync.ts`), and the settings autosave is a
  `Layer.scopedDiscard` stream (`features/settings/data/services/settingsAutosaveLive.ts`). Work
  started from a native callback runs through `Runtime.runFork` of the captured runtime, never a
  second runtime.
- **Mutable Layer state** is a `Ref` made when the Layer builds: `SchemaStatus` keeps the last
  migration report, `WatchBackgroundSyncLive` whether the install succeeded.
- **Best-effort steps** go through `logBackgroundFailure(task)` from `core/logger`, which logs
  everything but an interruption and succeeds; see Exceptions in `docs/ARCHITECTURE.md` for where
  that is allowed.
- **Failing after doing the work**: when a step's failure must not stop the next one but must
  still be reported, take it with `Effect.either`, carry on, and fail with it at the end
  (`features/notifications/useCases/syncTrainingReminder.ts`).
- **Order Layer definitions in tests**: jest compiles `const` to `var`, so a fake Layer built at
  `describe` time from a helper declared lower in the file captures `undefined` and fails as a
  "not iterable" defect. Declare the fakes above the `describe`, or make the test layer a
  function declaration.
