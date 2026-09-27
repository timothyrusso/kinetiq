import { type AppServicesOf, makeAppRuntime } from '@timothyrusso/effect-core';
import { Layer } from 'effect';
import { BootstrapLive } from '@/features/bootstrap';
import { ConfigLive } from '@/features/core/config';
import type { AppError } from '@/features/core/error';
import { HapticsLive } from '@/features/core/haptics';
import { LoggerLive } from '@/features/core/logger';
import { SqliteLive } from '@/features/core/sqlite';
import { ExercisesLive } from '@/features/exercises';
import { HomeLive } from '@/features/home';
import { NotificationsLive } from '@/features/notifications';
import { RoutinesLive } from '@/features/routines';
import { SettingsLive } from '@/features/settings';
import { TransferLive } from '@/features/transfer';
import { WatchBridgeLive } from '@/features/watch-bridge';
import { WatchSyncLive } from '@/features/watch-sync';
import { WorkoutsLive } from '@/features/workouts';

/** Every Layer the core concerns provide. */
const CoreLive = Layer.mergeAll(LoggerLive, ConfigLive, SqliteLive, HapticsLive);

/** The features up to tier 2, and `routines`, which the ports above them are filled over. */
const FoundationLive = Layer.mergeAll(SettingsLive, NotificationsLive, WatchBridgeLive, ExercisesLive, RoutinesLive);

/** The workouts, with their port onto the routines filled by `home`, above both. */
const WorkoutsWithRoutinesLive = WorkoutsLive.pipe(Layer.provideMerge(HomeLive));

/**
 * Every feature's Layer. A feature adds its `<Feature>Live` from its `index.ts` here; a Layer that
 * needs a core service (`SqliteClient`, `AppConfig`) gets it from `CoreLive`, and a tier-4 Layer
 * gets the services of the features below it.
 */
export const FeaturesLive = Layer.mergeAll(WatchSyncLive, TransferLive, BootstrapLive).pipe(
  Layer.provideMerge(WorkoutsWithRoutinesLive),
  Layer.provideMerge(FoundationLive),
);

/** Every feature's Layer, over the core ones. */
export const AppLayer = FeaturesLive.pipe(Layer.provideMerge(CoreLive));

/**
 * The app's one runtime. Only `app/_layout.tsx` imports it, to mount the provider; the bootstrap
 * runs on it through the boundary hooks.
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
