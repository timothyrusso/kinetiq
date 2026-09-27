import { type AppServicesOf, makeAppRuntime } from '@timothyrusso/effect-core';
import { Layer } from 'effect';
import { ConfigLive } from '@/features/core/config';
import type { AppError } from '@/features/core/error';
import { HapticsLive } from '@/features/core/haptics';
import { LoggerLive } from '@/features/core/logger';
import { RoutineUsageLive } from '@/features/core/runtime/bridges/routineUsageLive';
import { SqliteLive } from '@/features/core/sqlite';
import { ExercisesLive } from '@/features/exercises';
import { NotificationsLive } from '@/features/notifications';
import { RoutinesLive } from '@/features/routines';
import { SettingsLive } from '@/features/settings';
import { WatchBridgeLive } from '@/features/watch-bridge';
import { WorkoutsLive } from '@/features/workouts';

/** Every Layer the core concerns provide. */
const CoreLive = Layer.mergeAll(LoggerLive, ConfigLive, SqliteLive, HapticsLive);

/**
 * Every feature's Layer. A feature adds its `<Feature>Live` from its `index.ts` here; a Layer that
 * needs a core service (`SqliteClient`, `AppConfig`) gets it from `CoreLive`.
 */
export const FeaturesLive = Layer.mergeAll(
  SettingsLive,
  NotificationsLive,
  WatchBridgeLive,
  ExercisesLive,
  RoutinesLive,
  WorkoutsLive,
  RoutineUsageLive.pipe(Layer.provide(RoutinesLive)),
);

/** Every feature's Layer, over the core ones. */
export const AppLayer = FeaturesLive.pipe(Layer.provideMerge(CoreLive));

/**
 * The app's one runtime. Only `app/_layout.tsx` (to mount the provider) and the bootstrap
 * (to boot it) import it.
 */
export const runtime = makeAppRuntime(AppLayer);

/** Every service the runtime provides: what a facade's Effect may need. */
export type AppServices = AppServicesOf<typeof runtime>;

declare module '@timothyrusso/effect-core/react' {
  interface Register {
    services: AppServices;
    error: AppError;
  }
}
