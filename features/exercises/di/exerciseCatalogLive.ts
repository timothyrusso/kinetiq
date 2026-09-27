import { Effect, Layer } from 'effect';
import type { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import type { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';
import type { CatalogSource } from '@/features/exercises/domain/services/CatalogSource';
import { ExerciseCatalog } from '@/features/exercises/domain/services/ExerciseCatalog';
import { getExercise } from '@/features/exercises/useCases/getExercise';
import { installBundledCatalogIfMissing } from '@/features/exercises/useCases/installBundledCatalogIfMissing';
import { maybeRefreshCatalog } from '@/features/exercises/useCases/maybeRefreshCatalog';
import { searchExercises } from '@/features/exercises/useCases/searchExercises';

type CatalogServices = CatalogRepository | CatalogSource | BundledCatalog;

/** `ExerciseCatalog` over this feature's own use cases and the services they read. */
export const ExerciseCatalogLive = Layer.effect(
  ExerciseCatalog,
  Effect.map(Effect.context<CatalogServices>(), services => {
    const run = <A, E>(effect: Effect.Effect<A, E, CatalogServices>) => Effect.provide(effect, services);
    return {
      installBundledIfMissing: run(installBundledCatalogIfMissing),
      refreshIfStale: online => run(maybeRefreshCatalog(online)),
      find: (id, language) =>
        run(getExercise(id, language)).pipe(Effect.catchTag('ExerciseNotFound', () => Effect.succeed(undefined))),
      search: (name, language) =>
        run(searchExercises({ query: name, categoryId: null, equipmentId: null, muscleId: null }, language)).pipe(
          Effect.map(page => page.items),
        ),
    };
  }),
);
